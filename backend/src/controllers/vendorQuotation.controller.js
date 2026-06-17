import { prisma } from "../config/db.js";
import { parseIntId } from "../utils/parseId.js";
import {
  buildComparison,
  dispatchVendorQuotationRequests,
  getRequestsForQuotation,
  listQuotationsForVendorComparison,
  logRequestActivity,
  mapRequest,
  markExpiredRequests,
  notifySuppliers,
} from "../services/vendorQuotation.service.js";

function supplierIdFromReq(req) {
  return parseIntId(req.user.userId) ?? Number(req.user.userId);
}

export const listActiveVendors = async (_req, res) => {
  try {
    const rows = await prisma.vendor.findMany({
      where: { status: "ACTIVE" },
      orderBy: { companyName: "asc" },
    });
    res.json(
      rows.map((v) => ({
        id: String(v.id),
        companyName: v.companyName,
        contactPerson: v.contactPerson,
        email: v.email,
      })),
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const sendVendorQuotationRequests = async (req, res) => {
  try {
    const supplierId = supplierIdFromReq(req);
    const { quotationId, vendorIds, parts } = req.body;

    if (!quotationId || !Array.isArray(vendorIds) || vendorIds.length === 0) {
      return res.status(400).json({ message: "Quotation and at least one vendor are required" });
    }
    if (!Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ message: "Select at least one part" });
    }

    const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } });
    if (!quotation) return res.status(404).json({ message: "Quotation not found" });

    const partRows = parts.map((p) => ({
      partName: String(p.partName ?? p.name).trim(),
      quantity: Math.max(1, Number(p.quantity ?? p.qty ?? 1)),
    }));

    const { created } = await dispatchVendorQuotationRequests({
      quotationId,
      vendorIds,
      partRows,
      supplierId,
      quotation,
    });

    res.status(201).json({
      message: `${created.length} vendor quotation request(s) created`,
      requests: created.map(mapRequest),
    });
  } catch (err) {
    console.error("sendVendorQuotationRequests error:", err);
    if (err.message.includes("not found") || err.message.includes("already have")) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
};

export const listVendorQuotationRequests = async (req, res) => {
  try {
    await markExpiredRequests();
    const { quotationId, status, page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (quotationId) where.quotationId = String(quotationId);
    if (status && status !== "all") where.status = String(status);

    const [total, rows] = await Promise.all([
      prisma.vendorQuotationRequest.count({ where }),
      prisma.vendorQuotationRequest.findMany({
        where,
        include: {
          vendor: true,
          parts: true,
          response: true,
          quotation: true,
          activities: { orderBy: { createdAt: "desc" }, take: 5 },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
    ]);

    res.json({
      data: rows.map((r) => ({
        ...mapRequest(r),
        vehicle: r.quotation.vehicle,
      })),
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const listVendorComparisonQuotations = async (_req, res) => {
  try {
    res.json(await listQuotationsForVendorComparison());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getVendorQuotationComparison = async (req, res) => {
  try {
    const { quotationId } = req.params;
    const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } });
    if (!quotation) return res.status(404).json({ message: "Quotation not found" });

    const requests = await getRequestsForQuotation(quotationId);
    const comparison = buildComparison(requests);

    res.json({
      quotation: {
        id: quotation.id,
        vehicle: quotation.vehicle,
        status: quotation.status,
        source: quotation.source ?? "WORKSHOP",
      },
      requests: requests.map(mapRequest),
      comparison,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Public — load vendor response form */
export const getVendorResponseForm = async (req, res) => {
  try {
    const { token } = req.params;
    await markExpiredRequests();

    const request = await prisma.vendorQuotationRequest.findUnique({
      where: { token },
      include: { vendor: true, parts: true, quotation: true, response: true },
    });

    if (!request) {
      return res.status(404).json({ message: "Invalid or expired quotation link" });
    }
    if (request.status === "Expired" || request.expiresAt < new Date()) {
      if (request.status !== "Expired") {
        await prisma.vendorQuotationRequest.update({
          where: { id: request.id },
          data: { status: "Expired" },
        });
      }
      return res.status(410).json({ message: "This quotation request has expired" });
    }
    if (request.response) {
      return res.status(400).json({ message: "Quotation already submitted" });
    }

    if (request.status === "Sent") {
      await prisma.vendorQuotationRequest.update({
        where: { id: request.id },
        data: { status: "Opened", openedAt: new Date() },
      });
      await logRequestActivity(request.id, "Vendor opened quotation form", "vendor");
    }

    res.json({
      vendorName: request.vendor.companyName,
      vehicleNumber: request.quotation.vehicle,
      quotationNumber: request.quotation.id,
      expiresAt: request.expiresAt.getTime(),
      parts: request.parts.map((p) => ({
        partName: p.partName,
        quantity: p.quantity,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Public — submit vendor response */
export const submitVendorResponse = async (req, res) => {
  try {
    const { token } = req.params;
    const { lineItems, estimatedDeliveryTime, remarks } = req.body;

    await markExpiredRequests();

    const request = await prisma.vendorQuotationRequest.findUnique({
      where: { token },
      include: { vendor: true, parts: true, quotation: true, response: true },
    });

    if (!request) {
      return res.status(404).json({ message: "Invalid quotation link" });
    }
    if (request.status === "Expired" || request.expiresAt < new Date()) {
      return res.status(410).json({ message: "This quotation request has expired" });
    }
    if (request.response) {
      return res.status(400).json({ message: "Quotation already submitted" });
    }

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ message: "Part prices are required" });
    }

    const normalized = [];
    for (const part of request.parts) {
      const submitted = lineItems.find(
        (l) => String(l.partName).trim().toLowerCase() === part.partName.toLowerCase(),
      );
      const unitPrice = Number(submitted?.unitPrice);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(400).json({
          message: `Valid unit price required for ${part.partName}`,
        });
      }
      normalized.push({
        partName: part.partName,
        quantity: part.quantity,
        unitPrice,
      });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.vendorQuotationResponse.create({
        data: {
          requestId: request.id,
          estimatedDeliveryTime: estimatedDeliveryTime?.trim() || null,
          remarks: remarks?.trim() || null,
          lineItems: normalized,
        },
      });
      await tx.vendorQuotationRequest.update({
        where: { id: request.id },
        data: { status: "Responded", respondedAt: now },
      });
      await tx.vendorQuotationRequestActivity.create({
        data: {
          requestId: request.id,
          message: `Quotation submitted by ${request.vendor.companyName}`,
          type: "vendor",
        },
      });
    });

    const allRequests = await getRequestsForQuotation(request.quotationId);
    const comparison = buildComparison(allRequests);
    const prevComparison = buildComparison(
      allRequests.filter((r) => r.id !== request.id || !r.response),
    );

    await notifySuppliers(
      `Vendor quotation received from ${request.vendor.companyName} for ${request.quotationId}`,
      "system",
    );

    const newCheapest =
      comparison.overallCheapest &&
      (!prevComparison.overallCheapest ||
        comparison.overallCheapest.total < prevComparison.overallCheapest.total);
    if (newCheapest) {
      await notifySuppliers(
        `New lowest vendor quotation: ${comparison.overallCheapest.vendorName} (NZD $${comparison.overallCheapest.total.toFixed(2)}) for ${request.quotationId}`,
        "system",
      );
    }

    if (comparison.allResponded) {
      await notifySuppliers(
        `All vendors have responded for quotation ${request.quotationId}`,
        "system",
      );
    }

    res.json({ message: "Quotation submitted successfully. Thank you!" });
  } catch (err) {
    console.error("submitVendorResponse error:", err);
    res.status(500).json({ error: err.message });
  }
};
