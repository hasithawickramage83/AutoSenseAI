import crypto from "crypto";
import { prisma } from "../config/db.js";
import { addActivityLog } from "../utils/activityLog.js";
import { sendVendorQuotationRequestEmail } from "./email.service.js";
import { parseIntId } from "../utils/parseId.js";

const REQUEST_STATUSES = ["Pending", "Sent", "Opened", "Responded", "Expired"];

export function generateVendorToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function vendorResponseUrl(token) {
  const base = (process.env.APP_URL || "http://localhost:8080").replace(/\/$/, "");
  return `${base}/vendor-quotation-response/${token}`;
}

export function expiryDate(days = Number(process.env.VENDOR_QUOTATION_EXPIRY_DAYS || 7)) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function quotationVehicleDetails(quotation) {
  const ai = quotation?.aiResult;
  if (ai && typeof ai === "object" && ai.vehicleNumber) {
    return {
      vehicleModel: String(ai.vehicleModel ?? "").trim(),
      vehicleNumber: String(ai.vehicleNumber).trim(),
    };
  }

  const vehicle = String(quotation?.vehicle ?? "").trim();
  const match = vehicle.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (match) {
    return {
      vehicleModel: match[1].trim(),
      vehicleNumber: match[2].trim(),
    };
  }

  return { vehicleModel: "", vehicleNumber: vehicle };
}

export async function logRequestActivity(requestId, message, type = "system") {
  return prisma.vendorQuotationRequestActivity.create({
    data: { requestId, message, type },
  });
}

export async function notifySuppliers(message, type = "system", excludeUserId = null) {
  const suppliers = await prisma.user.findMany({ where: { role: "SUPPLIER" } });
  for (const s of suppliers) {
    if (excludeUserId != null && s.id === excludeUserId) continue;
    await addActivityLog(s.id, message, type);
  }
}

export async function notifyAdmins(message, type = "system") {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
  for (const a of admins) {
    await addActivityLog(a.id, message, type);
  }
}

export async function markExpiredRequests() {
  const now = new Date();
  const expired = await prisma.vendorQuotationRequest.findMany({
    where: {
      status: { in: ["Pending", "Sent", "Opened"] },
      expiresAt: { lt: now },
    },
  });
  for (const row of expired) {
    await prisma.vendorQuotationRequest.update({
      where: { id: row.id },
      data: { status: "Expired" },
    });
    await logRequestActivity(row.id, "Quotation request expired", "system");
  }
  return expired.length;
}

export function buildComparison(requests) {
  const responded = requests.filter((r) => r.response && r.status === "Responded");
  const partMap = new Map();

  for (const req of requests) {
    for (const p of req.parts) {
      if (!partMap.has(p.partName)) {
        partMap.set(p.partName, { partName: p.partName, quantity: p.quantity });
      }
    }
  }

  const items = [...partMap.values()].map(({ partName, quantity }) => {
    const offers = responded
      .map((req) => {
        const line = (req.response.lineItems ?? []).find((l) => l.partName === partName);
        if (line == null || line.unitPrice == null) return null;
        const unitPrice = Number(line.unitPrice);
        return {
          requestId: req.id,
          vendorId: req.vendorId,
          vendorName: req.vendor.companyName,
          unitPrice,
          lineTotal: unitPrice * quantity,
        };
      })
      .filter(Boolean);

    const lowest =
      offers.length > 0
        ? offers.reduce((a, b) => (a.unitPrice <= b.unitPrice ? a : b))
        : null;

    return {
      partName,
      quantity,
      offers,
      lowestVendorId: lowest?.vendorId ?? null,
      lowestVendorName: lowest?.vendorName ?? null,
      lowestPrice: lowest?.unitPrice ?? null,
    };
  });

  const vendorTotals = responded.map((req) => {
    let total = 0;
    for (const p of req.parts) {
      const line = (req.response.lineItems ?? []).find((l) => l.partName === p.partName);
      if (line?.unitPrice != null) {
        total += Number(line.unitPrice) * p.quantity;
      }
    }
    return {
      vendorId: req.vendorId,
      vendorName: req.vendor.companyName,
      requestId: req.id,
      total,
      respondedAt: req.respondedAt?.getTime() ?? req.response.submittedAt.getTime(),
    };
  });

  const overallCheapest =
    vendorTotals.length > 0
      ? vendorTotals.reduce((a, b) => (a.total <= b.total ? a : b))
      : null;

  const bestMixTotal = items.reduce(
    (sum, i) => sum + (i.lowestPrice ?? 0) * i.quantity,
    0,
  );

  const highestSingleVendorTotal =
    vendorTotals.length > 0 ? Math.max(...vendorTotals.map((v) => v.total)) : 0;
  const savingsVsHighest =
    overallCheapest != null ? Math.max(0, highestSingleVendorTotal - overallCheapest.total) : 0;
  const savingsBestMix =
    overallCheapest != null ? Math.max(0, overallCheapest.total - bestMixTotal) : 0;

  const allResponded =
    requests.length > 0 && requests.every((r) => r.status === "Responded" || r.status === "Expired");

  return {
    items,
    vendorTotals,
    overallCheapest,
    bestMixTotal,
    recommendedVendor: overallCheapest,
    savingsVsHighest,
    savingsBestMix,
    allResponded,
    respondedCount: responded.length,
    totalRequests: requests.length,
  };
}

export async function getRequestsForQuotation(quotationId) {
  await markExpiredRequests();
  return prisma.vendorQuotationRequest.findMany({
    where: { quotationId },
    include: {
      vendor: true,
      parts: true,
      response: true,
      activities: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function mapRequest(row) {
  return {
    id: row.id,
    quotationId: row.quotationId,
    vendorId: row.vendorId,
    vendorName: row.vendor.companyName,
    vendorEmail: row.vendor.email,
    status: row.status,
    token: row.token,
    expiresAt: row.expiresAt.getTime(),
    sentAt: row.sentAt?.getTime() ?? null,
    openedAt: row.openedAt?.getTime() ?? null,
    respondedAt: row.respondedAt?.getTime() ?? null,
    createdAt: row.createdAt.getTime(),
    parts: row.parts.map((p) => ({ id: p.id, partName: p.partName, quantity: p.quantity })),
    response: row.response
      ? {
          id: row.response.id,
          estimatedDeliveryTime: row.response.estimatedDeliveryTime,
          remarks: row.response.remarks,
          lineItems: row.response.lineItems,
          submittedAt: row.response.submittedAt.getTime(),
        }
      : null,
    activities: (row.activities ?? []).map((a) => ({
      id: a.id,
      message: a.message,
      type: a.type,
      createdAt: a.createdAt.getTime(),
    })),
  };
}

export async function dispatchVendorQuotationRequests({
  quotationId,
  vendorIds,
  partRows,
  supplierId,
  quotation,
  images,
  emailMode = "separate",
  primaryVendorId,
}) {
  const vendorIdInts = vendorIds
    .map((id) => parseIntId(id) ?? parseInt(String(id), 10))
    .filter((id) => Number.isFinite(id));

  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIdInts }, status: "ACTIVE" },
  });
  if (vendors.length === 0) {
    throw new Error("No active vendors found for selection");
  }

  const pending = [];
  for (const vendor of vendors) {
    const existing = await prisma.vendorQuotationRequest.findUnique({
      where: { quotationId_vendorId: { quotationId, vendorId: vendor.id } },
    });
    if (existing && ["Pending", "Sent", "Opened"].includes(existing.status)) {
      continue;
    }

    const token = generateVendorToken();
    const request = await prisma.vendorQuotationRequest.create({
      data: {
        quotationId,
        vendorId: vendor.id,
        requestedById: supplierId,
        token,
        status: "Pending",
        expiresAt: expiryDate(),
        parts: { create: partRows },
      },
      include: { vendor: true, parts: true },
    });

    await logRequestActivity(request.id, "Quotation request created", "system");

    pending.push({
      vendor,
      request,
      responseUrl: vendorResponseUrl(token),
    });
  }

  if (pending.length === 0) {
    throw new Error("All selected vendors already have active requests for this quotation");
  }

  const useBcc = emailMode === "bcc" && pending.length > 1;
  const created = [];
  const { vehicleModel, vehicleNumber } = quotationVehicleDetails(quotation);

  if (useBcc) {
    const primaryId =
      parseIntId(primaryVendorId) ?? parseInt(String(primaryVendorId ?? ""), 10);
    const primaryEntry = pending.find((p) => p.vendor.id === primaryId);
    if (!primaryEntry) {
      throw new Error("Select a primary vendor as the To recipient");
    }

    const bcc = pending
      .filter((p) => p.vendor.id !== primaryId)
      .map((p) => p.vendor.email);
    const vendorLinks = pending.map((p) => ({
      companyName: p.vendor.companyName,
      responseUrl: p.responseUrl,
    }));

    const emailResult = await sendVendorQuotationRequestEmail({
      to: primaryEntry.vendor.email,
      bcc,
      companyName: primaryEntry.vendor.companyName,
      vehicleModel,
      vehicleNumber,
      quotationNumber: quotation.id,
      parts: partRows,
      responseUrl: primaryEntry.responseUrl,
      images,
      vendorLinks,
      batchEmail: true,
    });

    for (const entry of pending) {
      const updated = await prisma.vendorQuotationRequest.update({
        where: { id: entry.request.id },
        data: {
          status: emailResult.sent ? "Sent" : "Pending",
          sentAt: emailResult.sent ? new Date() : null,
        },
        include: { vendor: true, parts: true, response: true, activities: true },
      });

      const recipientLabel =
        entry.vendor.id === primaryId
          ? `To: ${entry.vendor.email}`
          : `BCC: ${entry.vendor.email}`;

      await logRequestActivity(
        entry.request.id,
        emailResult.sent
          ? `Quotation request emailed (${recipientLabel})`
          : `Email not sent (${emailResult.reason ?? "webhook error"}) — link: ${entry.responseUrl}`,
        "system",
      );

      created.push(updated);
    }
  } else {
    for (const entry of pending) {
      const emailResult = await sendVendorQuotationRequestEmail({
        to: entry.vendor.email,
        companyName: entry.vendor.companyName,
        vehicleModel,
        vehicleNumber,
        quotationNumber: quotation.id,
        parts: partRows,
        responseUrl: entry.responseUrl,
        images,
      });

      const updated = await prisma.vendorQuotationRequest.update({
        where: { id: entry.request.id },
        data: {
          status: emailResult.sent ? "Sent" : "Pending",
          sentAt: emailResult.sent ? new Date() : null,
        },
        include: { vendor: true, parts: true, response: true, activities: true },
      });

      await logRequestActivity(
        entry.request.id,
        emailResult.sent
          ? `Quotation request emailed to ${entry.vendor.email}`
          : `Email not sent (${emailResult.reason ?? "webhook error"}) — link: ${entry.responseUrl}`,
        "system",
      );

      created.push(updated);
    }
  }

  await notifySuppliers(
    `Vendor quotation requests sent for ${quotation.id} (${created.length} vendor(s))`,
    "system",
    supplierId,
  );

  return { created };
}

export async function listQuotationsForVendorComparison() {
  await markExpiredRequests();
  const rows = await prisma.vendorQuotationRequest.findMany({
    include: { quotation: { include: { workshop: true } } },
    orderBy: { createdAt: "desc" },
  });
  const seen = new Map();
  for (const row of rows) {
    if (!seen.has(row.quotationId)) {
      const q = row.quotation;
      seen.set(row.quotationId, {
        id: q.id,
        vehicle: q.vehicle,
        status: q.status,
        source: q.source ?? "WORKSHOP",
        workshopName: q.workshop?.name ?? "",
        description: q.description,
        createdAt: q.createdAt.getTime(),
      });
    }
  }
  return [...seen.values()];
}

export { REQUEST_STATUSES };
