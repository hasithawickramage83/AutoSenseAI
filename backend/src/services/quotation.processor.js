import { prisma } from "../config/db.js";
import { hybridEngine } from "./hybrid.engine.js";
import { sendInvoiceEmail } from "./email.service.js";
import { addActivityLog, buildQuotationParts } from "../utils/activityLog.js";
import { nextInvoiceId, nextPurchaseOrderId } from "../utils/documentIds.js";
import { parseIntId } from "../utils/parseId.js";

async function resolveSupplierActorId(preferredId) {
  const actorId = preferredId != null ? (parseIntId(preferredId) ?? preferredId) : null;
  if (actorId != null) {
    const user = await prisma.user.findUnique({ where: { id: actorId } });
    if (user?.role === "SUPPLIER") return actorId;
  }
  const supplier = await prisma.user.findFirst({ where: { role: "SUPPLIER" } });
  return supplier?.id ?? actorId ?? null;
}

export async function processQuotationById(quotationId, { actorUserId = null } = {}) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { workshop: true, invoice: true },
  });

  if (!quotation) {
    throw new Error("Quotation not found");
  }

  if (!["Pending", "Processing"].includes(quotation.status)) {
    throw new Error("Quotation already processed");
  }

  if (quotation.invoice) {
    throw new Error("Quotation already has an invoice");
  }

  const aiResult = quotation.aiResult;
  const result = await hybridEngine(aiResult);
  const parts = buildQuotationParts(result.invoice);
  const labourCost = quotation.labourCost;
  const partsTotal = parts.reduce((sum, p) => sum + p.price * p.qty, 0);
  const invoiceTotal = partsTotal + labourCost;
  const hasPO = result.purchaseOrders.length > 0;
  const allInStock = result.allInStock;
  const urgency =
    quotation.severity === "High"
      ? "Critical"
      : quotation.severity === "Medium"
        ? "Urgent"
        : "Standard";

  const invoiceStatus = allInStock ? "Sent" : "Draft";
  const quotationStatus = hasPO ? "PO Raised" : "Invoiced";

  const saved = await prisma.$transaction(async (tx) => {
    await tx.quotation.update({
      where: { id: quotationId },
      data: { parts, status: "Processing" },
    });

    const invoiceId = await nextInvoiceId(tx);
    const invoice = await tx.invoice.create({
      data: {
        id: invoiceId,
        quotationId,
        workshopId: quotation.workshopId,
        lineItems: result.invoice.map((l) => ({
          partName: l.partName,
          quantity: l.quantity ?? 1,
          price: l.price,
        })),
        labourCost,
        total: invoiceTotal,
        status: invoiceStatus,
      },
    });

    const purchaseOrders = [];
    for (const po of result.purchaseOrders) {
      const poId = await nextPurchaseOrderId(tx);
      const row = await tx.purchaseOrder.create({
        data: {
          id: poId,
          quotationId,
          partName: po.partName,
          quantity: po.quantity,
          price: po.price ?? 0,
          status: "Draft",
          vendorEmail: process.env.PO_VENDOR_EMAIL || "vendor@nzparts-supply.co.nz",
          urgency,
        },
      });
      purchaseOrders.push(row);
    }

    if (allInStock) {
      for (const line of result.invoice) {
        if (line.inStock && line.stockId) {
          await tx.stock.update({
            where: { id: line.stockId },
            data: { quantity: { decrement: line.quantity ?? 1 } },
          });
        }
      }
    }

    const updatedQuotation = await tx.quotation.update({
      where: { id: quotationId },
      data: { status: quotationStatus },
      include: { workshop: true },
    });

    return { quotation: updatedQuotation, invoice, purchaseOrders };
  });

  const supplierActorId = await resolveSupplierActorId(actorUserId);

  if (allInStock) {
    let emailResult = { sent: false };
    try {
      emailResult = await sendInvoiceEmail({
        to: quotation.workshop.email,
        workshopName: quotation.workshop.name,
        invoice: saved.invoice,
      });
    } catch (err) {
      console.error("sendInvoiceEmail error:", err);
    }

    await addActivityLog(
      quotation.workshopId,
      `Invoice ${saved.invoice.id} sent automatically — NZD $${saved.invoice.total.toFixed(2)}${
        emailResult.sent ? " (emailed)" : ""
      }`,
      "system",
    );
    await addActivityLog(
      supplierActorId,
      `Auto-processed quotation ${quotationId} — invoice sent to ${quotation.workshop.name}`,
      "ai",
    );
    await addActivityLog(
      quotation.workshopId,
      `Quotation ${quotationId} completed — all parts in stock`,
      "system",
    );
  } else {
    await addActivityLog(
      supplierActorId,
      `Auto-processed quotation ${quotationId} — invoice queued, ${saved.purchaseOrders.length} PO(s) for missing stock`,
      "ai",
    );
    await addActivityLog(
      quotation.workshopId,
      `Quotation ${quotationId} — awaiting supplier parts (${saved.purchaseOrders.length} item(s) on order)`,
      "system",
    );
  }

  return {
    quotation: saved.quotation,
    invoice: saved.invoice,
    purchaseOrders: saved.purchaseOrders,
    allInStock,
    autoSent: allInStock,
    emailSent: allInStock,
  };
}
