import { prisma } from "../config/db.js";
import { parseIntId } from "../utils/parseId.js";
import { mapVehicleModel } from "../utils/vehicleCatalog.js";

const makeInclude = {
  _count: { select: { models: true, vendors: true } },
};

export const listVehicleMakes = async (_req, res) => {
  try {
    const makes = await prisma.vehicleMake.findMany({
      include: makeInclude,
      orderBy: { name: "asc" },
    });
    res.json(
      makes.map((m) => ({
        id: String(m.id),
        name: m.name,
        modelCount: m._count.models,
        vendorCount: m._count.vendors,
      })),
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createVehicleMake = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: "Make name is required" });
    }

    const make = await prisma.vehicleMake.create({
      data: { name: name.trim() },
      include: makeInclude,
    });
    res.status(201).json({
      id: String(make.id),
      name: make.name,
      modelCount: make._count.models,
      vendorCount: make._count.vendors,
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "Vehicle make already exists" });
    }
    res.status(500).json({ error: err.message });
  }
};

export const updateVehicleMake = async (req, res) => {
  try {
    const id = parseIntId(req.params.id);
    if (id == null) return res.status(400).json({ message: "Invalid make id" });
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: "Make name is required" });
    }

    const make = await prisma.vehicleMake.update({
      where: { id },
      data: { name: name.trim() },
      include: makeInclude,
    });
    res.json({
      id: String(make.id),
      name: make.name,
      modelCount: make._count.models,
      vendorCount: make._count.vendors,
    });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Vehicle make not found" });
    }
    if (err.code === "P2002") {
      return res.status(400).json({ message: "Vehicle make already exists" });
    }
    res.status(500).json({ error: err.message });
  }
};

export const deleteVehicleMake = async (req, res) => {
  try {
    const id = parseIntId(req.params.id);
    if (id == null) return res.status(400).json({ message: "Invalid make id" });

    const modelCount = await prisma.vehicleModel.count({ where: { makeId: id } });
    if (modelCount > 0) {
      return res.status(400).json({
        message: "Cannot delete make with linked vehicle models. Remove models first.",
      });
    }

    await prisma.vehicleMake.delete({ where: { id } });
    res.json({ message: "Vehicle make deleted" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Vehicle make not found" });
    }
    res.status(500).json({ error: err.message });
  }
};

export const listCatalogVehicleModels = async (req, res) => {
  try {
    const makeId = parseIntId(req.query.makeId);
    const where = makeId != null ? { makeId } : {};

    const models = await prisma.vehicleModel.findMany({
      where,
      include: {
        make: true,
        _count: { select: { parts: true, vendors: true } },
      },
      orderBy: [{ make: { name: "asc" } }, { name: "asc" }],
    });
    res.json(models.map(mapVehicleModel));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createCatalogVehicleModel = async (req, res) => {
  try {
    const makeId = parseIntId(req.body.makeId);
    const { name } = req.body;
    if (makeId == null) return res.status(400).json({ message: "Make is required" });
    if (!name?.trim()) return res.status(400).json({ message: "Model name is required" });

    const make = await prisma.vehicleMake.findUnique({ where: { id: makeId } });
    if (!make) return res.status(400).json({ message: "Vehicle make not found" });

    const model = await prisma.vehicleModel.create({
      data: { makeId, name: name.trim() },
      include: {
        make: true,
        _count: { select: { parts: true, vendors: true } },
      },
    });
    res.status(201).json(mapVehicleModel(model));
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "This model already exists for the selected make" });
    }
    res.status(500).json({ error: err.message });
  }
};

export const updateCatalogVehicleModel = async (req, res) => {
  try {
    const id = parseIntId(req.params.id);
    if (id == null) return res.status(400).json({ message: "Invalid model id" });

    const makeId = req.body.makeId != null ? parseIntId(req.body.makeId) : undefined;
    const { name } = req.body;
    const data = {};
    if (makeId != null) data.makeId = makeId;
    if (name?.trim()) data.name = name.trim();

    if (!Object.keys(data).length) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const model = await prisma.vehicleModel.update({
      where: { id },
      data,
      include: {
        make: true,
        _count: { select: { parts: true, vendors: true } },
      },
    });
    res.json(mapVehicleModel(model));
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Vehicle model not found" });
    }
    if (err.code === "P2002") {
      return res.status(400).json({ message: "This model already exists for the selected make" });
    }
    res.status(500).json({ error: err.message });
  }
};

export const deleteCatalogVehicleModel = async (req, res) => {
  try {
    const id = parseIntId(req.params.id);
    if (id == null) return res.status(400).json({ message: "Invalid model id" });

    const partCount = await prisma.part.count({
      where: { vehicleModelId: id, activeStatus: 1 },
    });
    if (partCount > 0) {
      return res.status(400).json({
        message: "Cannot delete vehicle model with linked parts. Remove or reassign parts first.",
      });
    }

    await prisma.vehicleModel.delete({ where: { id } });
    res.json({ message: "Vehicle model deleted" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Vehicle model not found" });
    }
    res.status(500).json({ error: err.message });
  }
};
