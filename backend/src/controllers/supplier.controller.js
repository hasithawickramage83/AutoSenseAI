import { prisma } from "../config/db.js";
import { hybridEngine } from "../services/hybrid.engine.js";
import {
  addActivityLog,
  buildQuotationParts,
} from "../utils/activityLog.js";

function mapQuotation(q) {
  return {
    id: q.id,
    workshopId: q.workshopId,
    workshopName: q.workshop?.name ?? "",
    vehicle: q.vehicle,
    description: q.description,
    damages: q.damages,
    severity: q.severity,
    recommendations: q.recommendations,
    parts: q.parts,
    labourCost: q.labourCost,
    status: q.status,
    createdAt: q.createdAt.getTime(),
  };
}

function mapInvoice(inv) {
  const lineItems = inv.lineItems ?? [];
  return {
    id: inv.id,
    quotationId: inv.quotationId,
    workshopName: inv.workshop?.name ?? inv.quotation?.workshop?.name ?? "",
    vehicle: inv.quotation?.vehicle ?? "",
    parts: lineItems.map((line) => ({
      name: line.partName,
      qty: line.quantity ?? 1,
      price: line.price,
    })),
    labourCost: inv.labourCost,
    total: inv.total,
    status: inv.status,
    createdAt: inv.createdAt.getTime(),
  };
}

function groupPurchaseOrders(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.quotationId || row.id;
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        quotationId: row.quotationId,
        workshopName: row.quotation?.workshop?.name ?? "",
        vehicle: row.quotation?.vehicle ?? "",
        vendorEmail: row.vendorEmail,
        urgency: row.urgency,
        status: row.status,
        createdAt: row.createdAt.getTime(),
        parts: [],
      });
    }
    const group = groups.get(key);
    group.parts.push({
      id: row.id,
      name: row.partName,
      qty: row.quantity,
      price: row.price,
    });
    if (row.status === "Sent") group.status = "Sent";
  }
  return [...groups.values()];
}

export const getStock = async (req, res) => {
  try {
    const rows = await prisma.stock.findMany({
      include: {
        part: { include: { vehicleModel: true } },
      },
      orderBy: { part: { name: "asc" } },
    });
    res.json(
      rows.map((s) => ({
        id: s.id,
        partId: s.partId,
        partName: s.part.name,
        vehicleModel: s.part.vehicleModel.name,
        description: s.part.description,
        quantity: s.quantity,
        price: s.price,
      })),
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getQuotations = async (req, res) => {
  try {
    const rows = await prisma.quotation.findMany({
      where: { status: { in: ["Pending", "Processing"] } },
      include: { workshop: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map(mapQuotation));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const processQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const supplierId = req.user.userId;

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { workshop: true },
    });

    if (!quotation) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    if (!["Pending", "Processing"].includes(quotation.status)) {
      return res.status(400).json({ error: "Quotation already processed" });
    }

    const aiResult = quotation.aiResult;
    const result = await hybridEngine(aiResult);
    const parts = buildQuotationParts(result.invoice);
    const labourCost = quotation.labourCost;
    const partsTotal = parts.reduce((sum, p) => sum + p.price * p.qty, 0);
    const invoiceTotal = partsTotal + labourCost;
    const hasPO = result.purchaseOrders.length > 0;
    const status = hasPO ? "PO Raised" : "Invoiced";
    const urgency =
      quotation.severity === "High"
        ? "Critical"
        : quotation.severity === "Medium"
          ? "Urgent"
          : "Standard";

    const saved = await prisma.$transaction(async (tx) => {
      const updated = await tx.quotation.update({
        where: { id },
        data: { parts, status: "Processing" },
      });

      let invoice = null;
      if (result.invoice.length > 0) {
        invoice = await tx.invoice.create({
          data: {
            quotationId: id,
            workshopId: quotation.workshopId,
            lineItems: result.invoice.map((l) => ({
              partName: l.partName,
              quantity: l.quantity ?? 1,
              price: l.price,
            })),
            labourCost,
            total: invoiceTotal,
            status: "Draft",
          },
        });
      }

      const purchaseOrders = [];
      for (const po of result.purchaseOrders) {
        const stockItem = await tx.stock.findFirst({
          where: {
            part: {
              name: { contains: po.partName.split(" ").slice(1).join(" "), mode: "insensitive" },
            },
          },
        });
        const row = await tx.purchaseOrder.create({
          data: {
            quotationId: id,
            partName: po.partName,
            quantity: po.quantity,
            price: stockItem?.price ?? 150,
            status: "Draft",
            vendorEmail: "vendor@nzparts-supply.co.nz",
            urgency,
          },
        });
        purchaseOrders.push(row);
      }

      await tx.quotation.update({ where: { id }, data: { status } });

      return { quotation: updated, invoice, purchaseOrders };
    });

    await addActivityLog(
      supplierId,
      `Processed quotation ${id.slice(0, 8)} for ${quotation.workshop.name}`,
      "ai",
    );

    res.json({
      quotation: mapQuotation({ ...saved.quotation, workshop: quotation.workshop, status }),
      invoice: saved.invoice ? mapInvoice({ ...saved.invoice, workshop: quotation.workshop, quotation }) : null,
      purchaseOrders: groupPurchaseOrders(
        saved.purchaseOrders.map((po) => ({ ...po, quotation: { ...quotation, workshop: quotation.workshop } })),
      ),
    });
  } catch (error) {
    console.error("processQuotation error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getInvoices = async (req, res) => {
  try {
    const rows = await prisma.invoice.findMany({
      include: {
        workshop: true,
        quotation: { include: { workshop: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map(mapInvoice));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { lineItems, labourCost } = req.body;

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    if (existing.status === "Sent") {
      return res.status(400).json({ error: "Sent invoices cannot be edited" });
    }

    const items = (lineItems ?? existing.lineItems).map((l) => ({
      partName: l.name ?? l.partName,
      quantity: l.qty ?? l.quantity ?? 1,
      price: Number(l.price),
    }));
    const partsTotal = items.reduce((sum, l) => sum + l.price * l.quantity, 0);
    const labour = labourCost ?? existing.labourCost;
    const total = partsTotal + labour;

    const updated = await prisma.invoice.update({
      where: { id },
      data: { lineItems: items, labourCost: labour, total },
      include: {
        workshop: true,
        quotation: { include: { workshop: true } },
      },
    });

    res.json(mapInvoice(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const sendInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const supplierId = req.user.userId;

    const existing = await prisma.invoice.findUnique({
      where: { id },
      include: { workshop: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    if (existing.status === "Sent") {
      return res.status(400).json({ error: "Invoice already sent" });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: "Sent" },
      include: {
        workshop: true,
        quotation: { include: { workshop: true } },
      },
    });

    await addActivityLog(
      existing.workshopId,
      `Invoice ${id.slice(0, 8)} sent by supplier — NZD $${existing.total.toFixed(2)}`,
      "system",
    );
    await addActivityLog(supplierId, `Invoice ${id.slice(0, 8)} sent to ${existing.workshop.name}`, "system");

    res.json(mapInvoice(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPurchaseOrders = async (req, res) => {
  try {
    const rows = await prisma.purchaseOrder.findMany({
      include: { quotation: { include: { workshop: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(groupPurchaseOrders(rows));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updatePurchaseOrderGroup = async (req, res) => {
  try {
    const { quotationId } = req.params;
    const { parts, vendorEmail, urgency } = req.body;

    if (!Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: "Parts array is required" });
    }

    for (const part of parts) {
      const existing = await prisma.purchaseOrder.findFirst({
        where: { id: part.id, quotationId },
      });
      if (!existing) continue;
      if (existing.status === "Sent") {
        return res.status(400).json({ error: "Sent purchase orders cannot be edited" });
      }
      const data = {
        partName: part.name,
        quantity: part.qty,
        price: Number(part.price),
      };
      if (vendorEmail != null) data.vendorEmail = vendorEmail;
      if (urgency != null) data.urgency = urgency;
      await prisma.purchaseOrder.update({
        where: { id: part.id },
        data,
      });
    }

    const rows = await prisma.purchaseOrder.findMany({
      where: { quotationId },
      include: { quotation: { include: { workshop: true } } },
    });
    res.json(groupPurchaseOrders(rows)[0] ?? null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const sendPurchaseOrderGroup = async (req, res) => {
  try {
    const { quotationId } = req.params;
    const supplierId = req.user.userId;

    const rows = await prisma.purchaseOrder.findMany({
      where: { quotationId },
      include: { quotation: { include: { workshop: true } } },
    });

    if (rows.length === 0) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    if (rows.some((r) => r.status === "Sent")) {
      return res.status(400).json({ error: "Purchase order already sent" });
    }

    await prisma.purchaseOrder.updateMany({
      where: { quotationId },
      data: { status: "Sent" },
    });

    const workshop = rows[0].quotation?.workshop;
    await addActivityLog(
      supplierId,
      `Purchase order for quotation ${quotationId.slice(0, 8)} sent to ${rows[0].vendorEmail}`,
      "system",
    );
    if (workshop) {
      await addActivityLog(
        workshop.id,
        `Purchase order received for quotation ${quotationId.slice(0, 8)}`,
        "system",
      );
    }

    const updated = await prisma.purchaseOrder.findMany({
      where: { quotationId },
      include: { quotation: { include: { workshop: true } } },
    });
    res.json(groupPurchaseOrders(updated)[0] ?? null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
