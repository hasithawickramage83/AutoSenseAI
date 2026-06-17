import { prisma } from "../config/db.js";
import { processQuotationById } from "../services/quotation.processor.js";
import { sendInvoiceEmail } from "../services/email.service.js";
import { addActivityLog } from "../utils/activityLog.js";
import { parseIntId } from "../utils/parseId.js";
import { nextQuotationId } from "../utils/documentIds.js";
import {
  evaluateInvoiceStock,
  formatLineItemsWithStock,
} from "../services/invoiceStock.service.js";
import {
  dispatchVendorQuotationRequests,
  mapRequest,
} from "../services/vendorQuotation.service.js";

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
    source: q.source ?? "WORKSHOP",
    createdAt: q.createdAt.getTime(),
    invoiceId: q.invoice?.id,
    poId: q.purchaseOrders?.[0]?.id,
  };
}

async function mapInvoice(inv) {
  const lineItems = inv.lineItems ?? [];
  const isDraft = inv.status !== "Sent";
  const stock =
    isDraft ? await evaluateInvoiceStock(lineItems) : { stockReady: true, items: [] };

  return {
    id: inv.id,
    quotationId: inv.quotationId,
    workshopName: inv.workshop?.name ?? inv.quotation?.workshop?.name ?? "",
    vehicle: inv.quotation?.vehicle ?? "",
    parts: lineItems.map((line) => ({
      name: line.partName,
      qty: line.quantity ?? 1,
      price: line.price,
      stockId: line.stockId != null ? String(line.stockId) : undefined,
    })),
    labourCost: inv.labourCost,
    total: inv.total,
    status: inv.status,
    stockReady: stock.stockReady,
    awaitingStock: isDraft && !stock.stockReady,
    stockItems: stock.items,
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

function mapStockRow(s) {
  return {
    id: s.id,
    partId: s.partId,
    partName: s.part.name,
    vehicleModel: s.part.vehicleModel.name,
    description: s.part.description,
    quantity: s.quantity,
    price: s.price,
  };
}

function buildStockWhere({ search, vehicleModel, partName }) {
  const where = { part: { activeStatus: 1 } };

  if (vehicleModel && vehicleModel !== "all") {
    where.part.vehicleModel = { name: vehicleModel };
  }
  if (partName && partName !== "all") {
    where.part.name = partName;
  }

  const terms = String(search ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length > 0) {
    where.AND = terms.map((term) => ({
      OR: [
        { part: { name: { contains: term, mode: "insensitive" } } },
        { part: { vehicleModel: { name: { contains: term, mode: "insensitive" } } } },
        { part: { description: { contains: term, mode: "insensitive" } } },
      ],
    }));
  }

  return where;
}

export const getStock = async (req, res) => {
  try {
    const { search, vehicleModel, partName, limit, offset } = req.query;
    const hasBrowseParams =
      limit != null ||
      offset != null ||
      search != null ||
      (vehicleModel != null && vehicleModel !== "all") ||
      (partName != null && partName !== "all");

    if (!hasBrowseParams) {
      const rows = await prisma.stock.findMany({
        where: { part: { activeStatus: 1 } },
        include: {
          part: { include: { vehicleModel: true } },
        },
        orderBy: [{ part: { vehicleModel: { name: "asc" } } }, { part: { name: "asc" } }],
      });
      return res.json(rows.map(mapStockRow));
    }

    const where = buildStockWhere({ search, vehicleModel, partName });
    const limitNum = Math.min(200, Math.max(1, parseInt(String(limit ?? 50), 10) || 50));
    const offsetNum = Math.max(0, parseInt(String(offset ?? 0), 10) || 0);

    const [total, rows] = await Promise.all([
      prisma.stock.count({ where }),
      prisma.stock.findMany({
        where,
        include: {
          part: { include: { vehicleModel: true } },
        },
        orderBy: [{ part: { vehicleModel: { name: "asc" } } }, { part: { name: "asc" } }],
        take: limitNum,
        skip: offsetNum,
      }),
    ]);

    res.json({
      data: rows.map(mapStockRow),
      total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getStockFilters = async (_req, res) => {
  try {
    const [vehicleModels, partNames] = await Promise.all([
      prisma.vehicleModel.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
      prisma.part.findMany({
        where: { activeStatus: 1 },
        distinct: ["name"],
        orderBy: { name: "asc" },
        select: { name: true },
      }),
    ]);
    res.json({
      vehicleModels: vehicleModels.map((m) => m.name),
      partNames: partNames.map((p) => p.name),
    });
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
        ? await mapInvoice({ ...saved.invoice, workshop: quotation.workshop, quotation })
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
    res.json(await Promise.all(rows.map(mapInvoice)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const listWorkshops = async (_req, res) => {
  try {
    const rows = await prisma.user.findMany({
      where: { role: "WORKSHOP" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    });
    res.json(rows.map((w) => ({ id: String(w.id), name: w.name, email: w.email })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createCustomQuotation = async (req, res) => {
  try {
    const supplierId = supplierIdFromReq(req);
    const { vehicle, description, parts, vendorIds, images, emailMode, primaryVendorId, vehicleModel, vehicleNumber } = req.body;

    const modelName = vehicleModel?.trim();
    const regNumber = vehicleNumber?.trim();

    if (!regNumber) {
      return res.status(400).json({ error: "Vehicle number is required" });
    }
    if (!modelName) {
      return res.status(400).json({ error: "Vehicle model is required" });
    }
    if (!Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({
        error: "At least one catalog part is required",
      });
    }
    if (!Array.isArray(vendorIds) || vendorIds.length === 0) {
      return res.status(400).json({ error: "Select at least one vendor" });
    }

    if (emailMode === "bcc" && vendorIds.length > 1 && !primaryVendorId) {
      return res.status(400).json({ error: "Select a primary vendor as the To recipient" });
    }

    const stockIds = parts
      .map((p) => parseIntId(p.stockId) ?? parseInt(String(p.stockId), 10))
      .filter((id) => Number.isFinite(id));

    const stockRows = await prisma.stock.findMany({
      where: { id: { in: stockIds } },
      include: { part: { include: { vehicleModel: true } } },
    });
    if (stockRows.length === 0) {
      return res.status(400).json({ error: "No valid stock items selected" });
    }

    const stockById = new Map(stockRows.map((s) => [s.id, s]));
    const quotationParts = [];
    const partRows = [];
    const aiPartNames = [];

    for (const row of parts) {
      const stockId = parseIntId(row.stockId) ?? parseInt(String(row.stockId), 10);
      const stock = stockById.get(stockId);
      if (!stock) continue;
      const qty = Math.max(1, Number(row.qty ?? row.quantity ?? 1));
      const partLabel = `${stock.part.vehicleModel.name} ${stock.part.name}`;
      quotationParts.push({
        name: partLabel,
        qty,
        price: Number(stock.price),
        stockId: stock.id,
      });
      partRows.push({ partName: partLabel, quantity: qty });
      aiPartNames.push(stock.part.name);
    }

    if (quotationParts.length === 0) {
      return res.status(400).json({ error: "No valid parts in request" });
    }

    const vehicleModelFromStock = stockRows[0].part.vehicleModel.name;
    const resolvedModel = modelName || vehicleModelFromStock;
    const vehicleDisplay = `${resolvedModel} - ${regNumber}`;
    const aiResult = {
      vehicleModel: resolvedModel,
      vehicleNumber: regNumber,
      parts: aiPartNames,
    };

    const saved = await prisma.$transaction(async (tx) => {
      const quotationId = await nextQuotationId(tx);
      return tx.quotation.create({
        data: {
          id: quotationId,
          workshopId: null,
          vehicle: vehicleDisplay,
          description: description?.trim() || `Supplier custom quotation for ${vehicleDisplay}`,
          inputText: description?.trim() || "Supplier custom quotation",
          aiResult,
          parts: quotationParts,
          damages: [],
          recommendations: [],
          severity: "Medium",
          labourCost: 0,
          status: "Vendor Quote",
          source: "SUPPLIER",
        },
      });
    });

    const imagePayload = Array.isArray(images)
      ? images
          .filter((img) => img?.dataUrl || img?.data)
          .slice(0, 10)
          .map((img) => ({
            name: String(img.name ?? "image").trim() || "image",
            dataUrl: String(img.dataUrl ?? img.data),
          }))
      : [];

    const { created } = await dispatchVendorQuotationRequests({
      quotationId: saved.id,
      vendorIds,
      partRows,
      supplierId,
      quotation: saved,
      images: imagePayload,
      emailMode: emailMode === "bcc" ? "bcc" : "separate",
      primaryVendorId,
    });

    const quotationRow = await prisma.quotation.findUnique({
      where: { id: saved.id },
      include: { workshop: true, invoice: true, purchaseOrders: true },
    });

    await addActivityLog(
      supplierId,
      `Custom quotation ${saved.id} sent to ${created.length} vendor(s)`,
      "user",
    );

    const sentCount = created.filter((r) => r.status === "Sent").length;
    const emailNote =
      sentCount < created.length
        ? ` (${created.length - sentCount} vendor email(s) could not be sent — requests saved with secure links)`
        : "";

    res.status(201).json({
      message: `Custom quotation ${saved.id} created and sent to ${created.length} vendor(s)${emailNote}`,
      quotation: mapQuotation(quotationRow),
      requests: created.map(mapRequest),
      emailsSent: sentCount,
      emailsFailed: created.length - sentCount,
    });
  } catch (error) {
    console.error("createCustomQuotation error:", error);
    if (
      error.message.includes("not found") ||
      error.message.includes("already have") ||
      error.message.includes("No active vendors")
    ) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { lineItems } = req.body;

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    if (existing.status === "Sent") {
      return res.status(400).json({ error: "Sent invoices cannot be edited" });
    }

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ error: "At least one line item is required" });
    }

    const items = [];
    for (const l of lineItems) {
      const stockId = parseIntId(l.stockId) ?? (l.stockId != null ? Number(l.stockId) : null);
      if (!stockId) {
        return res.status(400).json({ error: "Each line item must select a part from stock" });
      }

      const stock = await prisma.stock.findUnique({
        where: { id: stockId },
        include: { part: { include: { vehicleModel: true } } },
      });
      if (!stock) {
        return res.status(400).json({ error: `Stock item not found` });
      }

      const partLabel = `${stock.part.vehicleModel.name} ${stock.part.name}`;
      items.push({
        partName: partLabel,
        quantity: Math.max(1, Number(l.qty ?? l.quantity ?? 1)),
        price: Number(l.price ?? stock.price),
        stockId: stock.id,
      });
    }

    const total = items.reduce((sum, l) => sum + l.price * l.quantity, 0);

    const updated = await prisma.invoice.update({
      where: { id },
      data: { lineItems: items, labourCost: 0, total },
      include: {
        workshop: true,
        quotation: { include: { workshop: true } },
      },
    });

    res.json(await mapInvoice(updated));
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

    const stockCheck = await evaluateInvoiceStock(existing.lineItems);
    if (!stockCheck.stockReady) {
      const missing = stockCheck.items
        .filter((i) => !i.inStock)
        .map((i) => `${i.partName} (need ${i.requiredQty}, have ${i.availableQty})`);
      return res.status(400).json({
        error: `Cannot send invoice — parts not in stock: ${missing.join("; ")}`,
        awaitingStock: true,
        stockItems: stockCheck.items,
      });
    }

    const lineItems = formatLineItemsWithStock(existing.lineItems, stockCheck.items);
    const total = lineItems.reduce((sum, l) => sum + l.price * l.quantity, 0);

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of stockCheck.items) {
        if (item.stockId) {
          await tx.stock.update({
            where: { id: item.stockId },
            data: { quantity: { decrement: item.requiredQty } },
          });
        }
      }

      return tx.invoice.update({
        where: { id },
        data: {
          lineItems,
          labourCost: 0,
          total,
          status: "Sent",
        },
        include: {
          workshop: true,
          quotation: { include: { workshop: true } },
        },
      });
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
      `Invoice ${id} sent by supplier — NZD $${total.toFixed(2)}`,
      "system",
    );
    await addActivityLog(supplierId, `Invoice ${id} sent to ${existing.workshop.name}`, "system");

    res.json(await mapInvoice(updated));
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
