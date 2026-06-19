import { prisma } from "../config/db.js";
import { parseIntId } from "../utils/parseId.js";
import { mapVehicleModel } from "../utils/vehicleCatalog.js";
import { addActivityLog } from "../utils/activityLog.js";

function parseIdList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((v) => parseIntId(v)).filter((id) => id != null))];
}

async function notifyAdminsVendorRegistration(message) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
  for (const a of admins) {
    await addActivityLog(a.id, message, "system");
  }
}

export const getPublicVendorCatalog = async (_req, res) => {
  try {
    const makes = await prisma.vehicleMake.findMany({
      include: {
        models: { orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    });

    res.json({
      makes: makes.map((m) => ({
        id: String(m.id),
        name: m.name,
        models: m.models.map((model) => mapVehicleModel({ ...model, make: m })),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const registerVendorPublic = async (req, res) => {
  try {
    const {
      companyName,
      contactPerson,
      email,
      address,
      contactNumber,
      makeIds = [],
      vehicleModelIds = [],
    } = req.body;

    if (!companyName?.trim() || !contactPerson?.trim() || !email?.trim()) {
      return res.status(400).json({
        message: "Company name, contact person, and email are required",
      });
    }

    const parsedMakeIds = parseIdList(makeIds);
    const parsedModelIds = parseIdList(vehicleModelIds);

    if (parsedMakeIds.length === 0 && parsedModelIds.length === 0) {
      return res.status(400).json({
        message: "Select at least one vehicle make or model you supply",
      });
    }

    const existing = await prisma.vendor.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (existing) {
      return res.status(400).json({
        message: "A vendor with this email is already registered. Contact the administrator.",
      });
    }

    if (parsedMakeIds.length > 0) {
      const count = await prisma.vehicleMake.count({ where: { id: { in: parsedMakeIds } } });
      if (count !== parsedMakeIds.length) {
        return res.status(400).json({ message: "One or more vehicle makes are invalid" });
      }
    }

    if (parsedModelIds.length > 0) {
      const count = await prisma.vehicleModel.count({ where: { id: { in: parsedModelIds } } });
      if (count !== parsedModelIds.length) {
        return res.status(400).json({ message: "One or more vehicle models are invalid" });
      }
    }

    const vendor = await prisma.vendor.create({
      data: {
        companyName: companyName.trim(),
        contactPerson: contactPerson.trim(),
        email: email.trim().toLowerCase(),
        address: address?.trim() || null,
        contactNumber: contactNumber?.trim() || null,
        status: "ACTIVE",
        makes: parsedMakeIds.length
          ? { create: parsedMakeIds.map((makeId) => ({ makeId })) }
          : undefined,
        vehicleModels: parsedModelIds.length
          ? { create: parsedModelIds.map((vehicleModelId) => ({ vehicleModelId })) }
          : undefined,
      },
      include: {
        makes: { include: { make: true } },
        vehicleModels: { include: { vehicleModel: { include: { make: true } } } },
      },
    });

    await notifyAdminsVendorRegistration(
      `New vendor self-registration: ${vendor.companyName} (${vendor.email})`,
    );

    res.status(201).json({
      message: "Registration submitted successfully. You will be contacted once approved.",
      vendorId: String(vendor.id),
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "A vendor with this email already exists" });
    }
    res.status(500).json({ error: err.message });
  }
};
