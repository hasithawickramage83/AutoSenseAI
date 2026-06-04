import { prisma } from "../config/db.js";
import { processQuotationById } from "../services/quotation.processor.js";
import { sendInvoiceEmail } from "../services/email.service.js";
import { addActivityLog } from "../utils/activityLog.js";
import { parseIntId } from "../utils/parseId.js";

function supplierIdFromReq(req) {
  return parseIntId(req.user.userId) ?? Number(req.user.userId);
}

function mapQuotation(q) {
  return {
    id: q.id,
    workshopId: q.workshopId,
    workshopName: q.workshop?.name ?? "",
    vehicle: q.vehicle,
    description: q.description ?? "",
    damages: q.damages ?? [],
    severity: q.severity,
    recommendations: q.recommendations ?? [],
    parts: q.parts ?? [],
    labourCost: q.labourCost,
    status: q.status,
    createdAt: q.createdAt.getTime(),
    invoiceId: q.invoice?.id,
    poId: q.purchaseOrders?.[0]?.id,
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
      include: { workshop: true, invoice: true, purchaseOrders: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map(mapQuotation));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllQuotations = async (req, res) => {
  try {
    const rows = await prisma.quotation.findMany({
      include: { workshop: true, invoice: true, purchaseOrders: true },
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
    const supplierId = supplierIdFromReq(req);

    const saved = await processQuotationById(id, { actorUserId: supplierId });

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { workshop: true, invoice: true, purchaseOrders: true },
    });

    res.json({
      quotation: mapQuotation(quotation),
      invoice: saved.invoice
        ? mapInvoice({ ...saved.invoice, workshop: quotation.workshop, quotation })
        : null,
      purchaseOrders: groupPurchaseOrders(
        saved.purchaseOrders.map((po) => ({
          ...po,
          quotation: { ...quotation, workshop: quotation.workshop },
        })),
      ),
      allInStock: saved.allInStock,
      autoSent: saved.autoSent,
    });
  } catch (error) {
    console.error("processQuotation error:", error);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("already")) {
      return res.status(400).json({ error: error.message });
    }
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
    const supplierId = supplierIdFromReq(req);

    const existing = await prisma.invoice.findUnique({
      where: { id },
      include: { workshop: true, quotation: true },
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

    try {
      await sendInvoiceEmail({
        to: existing.workshop.email,
        workshopName: existing.workshop.name,
        invoice: updated,
      });
    } catch (err) {
      console.error("sendInvoiceEmail error:", err);
    }

    if (existing.quotation && existing.quotation.status === "PO Raised") {
      await prisma.quotation.update({
        where: { id: existing.quotationId },
        data: { status: "Invoiced" },
      });
    }

    await addActivityLog(
      existing.workshopId,
      `Invoice ${id} sent by supplier — NZD $${existing.total.toFixed(2)}`,
      "system",
    );
    await addActivityLog(supplierId, `Invoice ${id} sent to ${existing.workshop.name}`, "system");

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
    const supplierId = supplierIdFromReq(req);

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
      `Purchase order for quotation ${quotationId} sent to ${rows[0].vendorEmail}`,
      "system",
    );
    if (workshop) {
      await addActivityLog(
        workshop.id,
        `Purchase order received for quotation ${quotationId}`,
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
