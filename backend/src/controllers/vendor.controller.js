import { prisma } from "../config/db.js";
import { parseIntId } from "../utils/parseId.js";
import { addActivityLog } from "../utils/activityLog.js";

function mapVendor(v) {
  return {
    id: String(v.id),
    companyName: v.companyName,
    contactPerson: v.contactPerson,
    email: v.email,
    address: v.address ?? "",
    contactNumber: v.contactNumber ?? "",
    status: v.status,
    createdAt: v.createdAt.getTime(),
    updatedAt: v.updatedAt.getTime(),
  };
}

export const listVendors = async (req, res) => {
  try {
    const {
      search = "",
      status = "all",
      sort = "companyName",
      order = "asc",
      page = "1",
      limit = "10",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    const q = String(search).trim();
    if (q) {
      where.OR = [
        { companyName: { contains: q, mode: "insensitive" } },
        { contactPerson: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }
    if (status === "ACTIVE" || status === "INACTIVE") {
      where.status = status;
    }

    const sortField = ["companyName", "email", "createdAt", "status"].includes(sort)
      ? sort
      : "companyName";
    const sortOrder = order === "desc" ? "desc" : "asc";

    const [total, rows] = await Promise.all([
      prisma.vendor.count({ where }),
      prisma.vendor.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limitNum,
      }),
    ]);

    res.json({
      data: rows.map(mapVendor),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getVendor = async (req, res) => {
  try {
    const id = parseIntId(req.params.id);
    if (id == null) return res.status(400).json({ message: "Invalid vendor id" });

    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    res.json(mapVendor(vendor));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createVendor = async (req, res) => {
  try {
    const { companyName, contactPerson, email, address, contactNumber, status } = req.body;

    if (!companyName?.trim() || !contactPerson?.trim() || !email?.trim()) {
      return res.status(400).json({
        message: "Company name, contact person, and email are required",
      });
    }

    const vendor = await prisma.vendor.create({
      data: {
        companyName: companyName.trim(),
        contactPerson: contactPerson.trim(),
        email: email.trim().toLowerCase(),
        address: address?.trim() || null,
        contactNumber: contactNumber?.trim() || null,
        status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      },
    });

    await notifyAdminsVendorChange(req.user.userId, `Vendor added: ${vendor.companyName}`, "system");

    res.status(201).json(mapVendor(vendor));
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "A vendor with this email already exists" });
    }
    res.status(500).json({ error: err.message });
  }
};

export const updateVendor = async (req, res) => {
  try {
    const id = parseIntId(req.params.id);
    if (id == null) return res.status(400).json({ message: "Invalid vendor id" });

    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Vendor not found" });

    const { companyName, contactPerson, email, address, contactNumber, status } = req.body;
    const data = {};
    if (companyName?.trim()) data.companyName = companyName.trim();
    if (contactPerson?.trim()) data.contactPerson = contactPerson.trim();
    if (email?.trim()) data.email = email.trim().toLowerCase();
    if (address !== undefined) data.address = address?.trim() || null;
    if (contactNumber !== undefined) data.contactNumber = contactNumber?.trim() || null;
    if (status === "ACTIVE" || status === "INACTIVE") data.status = status;

    const vendor = await prisma.vendor.update({ where: { id }, data });

    const msg =
      status === "INACTIVE" && existing.status !== "INACTIVE"
        ? `Vendor deactivated: ${vendor.companyName}`
        : `Vendor updated: ${vendor.companyName}`;
    await notifyAdminsVendorChange(req.user.userId, msg, "system");

    res.json(mapVendor(vendor));
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "Email already in use" });
    }
    res.status(500).json({ error: err.message });
  }
};

export const deleteVendor = async (req, res) => {
  try {
    const id = parseIntId(req.params.id);
    if (id == null) return res.status(400).json({ message: "Invalid vendor id" });

    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Vendor not found" });

    const pending = await prisma.vendorQuotationRequest.count({
      where: { vendorId: id, status: { in: ["Pending", "Sent", "Opened"] } },
    });
    if (pending > 0) {
      return res.status(400).json({
        message: "Cannot delete vendor with active quotation requests. Deactivate instead.",
      });
    }

    await prisma.vendor.delete({ where: { id } });
    await notifyAdminsVendorChange(
      req.user.userId,
      `Vendor deleted: ${existing.companyName}`,
      "system",
    );

    res.json({ message: "Vendor deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

async function notifyAdminsVendorChange(actorUserId, message, type) {
  const actorId = parseIntId(actorUserId) ?? Number(actorUserId);
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
  for (const a of admins) {
    if (a.id === actorId) {
      await addActivityLog(a.id, message, type);
    } else {
      await addActivityLog(a.id, message, type);
    }
  }
}
