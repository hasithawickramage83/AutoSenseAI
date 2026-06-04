import bcrypt from "bcryptjs";
import { prisma } from "../config/db.js";
import { parseIntId } from "../utils/parseId.js";

const VALID_ROLES = ["ADMIN", "WORKSHOP", "SUPPLIER"];

function sanitizeUser(user) {
  const { password: _password, ...safe } = user;
  return safe;
}

function normalizeRole(role) {
  const upper = String(role ?? "").toUpperCase();
  return VALID_ROLES.includes(upper) ? upper : null;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export const listUsers = async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(users.map(sanitizeUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        role: normalizedRole,
      },
    });

    res.status(201).json({ message: "User created", user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const id = parseIntId(req.params.id);
    if (id == null) return res.status(400).json({ message: "Invalid user id" });
    const { name, email, role, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "User not found" });
    }

    const data = {};
    if (name?.trim()) data.name = name.trim();
    if (email?.trim()) data.email = email.trim().toLowerCase();
    if (role !== undefined) {
      const normalizedRole = normalizeRole(role);
      if (!normalizedRole) {
        return res.status(400).json({ message: "Invalid role" });
      }
      data.role = normalizedRole;
    }
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({ where: { id }, data });
    res.json({ message: "User updated", user: sanitizeUser(user) });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "Email already in use" });
    }
    res.status(500).json({ error: err.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const id = parseIntId(req.params.id);
    if (id == null) return res.status(400).json({ message: "Invalid user id" });

    if (id === Number(req.user.userId)) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "User not found" });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Vehicle Models ──────────────────────────────────────────────────────────

export const listVehicleModels = async (_req, res) => {
  try {
    const models = await prisma.vehicleModel.findMany({
      include: { _count: { select: { parts: true } } },
      orderBy: { name: "asc" },
    });
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createVehicleModel = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    const model = await prisma.vehicleModel.create({
      data: { name: name.trim() },
    });
    res.status(201).json(model);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "Vehicle model already exists" });
    }
    res.status(500).json({ error: err.message });
  }
};

export const updateVehicleModel = async (req, res) => {
  try {
    const id = parseIntId(req.params.id);
    if (id == null) return res.status(400).json({ message: "Invalid vehicle model id" });
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    const model = await prisma.vehicleModel.update({
      where: { id },
      data: { name: name.trim() },
    });
    res.json(model);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Vehicle model not found" });
    }
    if (err.code === "P2002") {
      return res.status(400).json({ message: "Vehicle model name already exists" });
    }
    res.status(500).json({ error: err.message });
  }
};

export const deleteVehicleModel = async (req, res) => {
  try {
    const id = parseIntId(req.params.id);
    if (id == null) return res.status(400).json({ message: "Invalid vehicle model id" });

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

// ─── Parts ───────────────────────────────────────────────────────────────────

export const listParts = async (_req, res) => {
  try {
    const parts = await prisma.part.findMany({
      where: { activeStatus: 1 },
      include: {
        vehicleModel: true,
        stocks: true,
      },
      orderBy: { name: "asc" },
    });
    res.json(parts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createPart = async (req, res) => {
  try {
    const { name, description, vehicleModelId: rawModelId } = req.body;
    const vehicleModelId = parseIntId(rawModelId);

    if (!name?.trim() || vehicleModelId == null) {
      return res.status(400).json({ message: "Name and vehicle model are required" });
    }

    const model = await prisma.vehicleModel.findUnique({ where: { id: vehicleModelId } });
    if (!model) {
      return res.status(400).json({ message: "Vehicle model not found" });
    }

    const part = await prisma.part.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        vehicleModelId,
      },
      include: { vehicleModel: true, stocks: true },
    });

    res.status(201).json(part);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updatePart = async (req, res) => {
  try {
    const id = parseIntId(req.params.id);
    if (id == null) return res.status(400).json({ message: "Invalid part id" });
    const { name, description, vehicleModelId: rawModelId } = req.body;

    const data = {};
    if (name?.trim()) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (rawModelId != null) {
      const vehicleModelId = parseIntId(rawModelId);
      if (vehicleModelId == null) {
        return res.status(400).json({ message: "Invalid vehicle model id" });
      }
      const model = await prisma.vehicleModel.findUnique({ where: { id: vehicleModelId } });
      if (!model) {
        return res.status(400).json({ message: "Vehicle model not found" });
      }
      data.vehicleModelId = vehicleModelId;
    }

    const part = await prisma.part.update({
      where: { id },
      data,
      include: { vehicleModel: true, stocks: true },
    });
    res.json(part);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Part not found" });
    }
    res.status(500).json({ error: err.message });
  }
};

export const deletePart = async (req, res) => {
  try {
    const id = parseIntId(req.params.id);
    if (id == null) return res.status(400).json({ message: "Invalid part id" });

    const part = await prisma.part.update({
      where: { id },
      data: { activeStatus: 0 },
    });

    res.json({ message: "Part marked as inactive", part });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Part not found" });
    }
    res.status(500).json({ error: err.message });
  }
};

// ─── Stock ───────────────────────────────────────────────────────────────────

export const listStock = async (_req, res) => {
  try {
    const data = await prisma.stock.findMany({
      include: {
        part: {
          include: { vehicleModel: true },
        },
      },
      orderBy: { part: { name: "asc" } },
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createStock = async (req, res) => {
  try {
    const { partId: rawPartId, quantity, price } = req.body;
    const partId = parseIntId(rawPartId);

    if (partId == null || quantity == null || price == null) {
      return res.status(400).json({ message: "Part, quantity, and price are required" });
    }

    const part = await prisma.part.findUnique({ where: { id: partId } });
    if (!part || part.activeStatus !== 1) {
      return res.status(400).json({ message: "Part not found or inactive" });
    }

    const existing = await prisma.stock.findUnique({ where: { partId } });
    if (existing) {
      return res.status(400).json({ message: "Stock already exists for this part. Use update instead." });
    }

    const stock = await prisma.stock.create({
      data: {
        partId,
        quantity: Number(quantity),
        price: Number(price),
      },
      include: { part: { include: { vehicleModel: true } } },
    });

    res.status(201).json(stock);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateStock = async (req, res) => {
  try {
    const id = parseIntId(req.params.id);
    if (id == null) return res.status(400).json({ message: "Invalid stock id" });
    const { quantity, price } = req.body;

    const data = {};
    if (quantity != null) data.quantity = Number(quantity);
    if (price != null) data.price = Number(price);

    const stock = await prisma.stock.update({
      where: { id },
      data,
      include: { part: { include: { vehicleModel: true } } },
    });

    res.json(stock);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Stock record not found" });
    }
    res.status(500).json({ error: err.message });
  }
};

export const upsertStockByPart = async (req, res) => {
  try {
    const { partId: rawPartId, quantity, price } = req.body;
    const partId = parseIntId(rawPartId);

    if (partId == null || quantity == null || price == null) {
      return res.status(400).json({ message: "Part, quantity, and price are required" });
    }

    const stock = await prisma.stock.upsert({
      where: { partId },
      update: { quantity: Number(quantity), price: Number(price) },
      create: { partId, quantity: Number(quantity), price: Number(price) },
      include: { part: { include: { vehicleModel: true } } },
    });

    res.json(stock);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteStock = async (req, res) => {
  try {
    const id = parseIntId(req.params.id);
    if (id == null) return res.status(400).json({ message: "Invalid stock id" });
    await prisma.stock.delete({ where: { id } });
    res.json({ message: "Stock deleted" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Stock record not found" });
    }
    res.status(500).json({ error: err.message });
  }
};

// Legacy alias
export const getInventory = listStock;

export const getInventoryDashboard = async (_req, res) => {
  try {
    const rows = await prisma.stock.findMany({
      include: { part: { include: { vehicleModel: true } } },
      orderBy: { part: { name: "asc" } },
    });

    const items = rows.map((s) => ({
      id: s.id,
      partId: s.partId,
      partName: s.part.name,
      vehicleModel: s.part.vehicleModel.name,
      quantity: s.quantity,
      price: s.price,
      value: s.quantity * s.price,
      availability:
        s.quantity <= 0 ? "out" : s.quantity <= 2 ? "low" : "ok",
    }));

    const outOfStock = items.filter((i) => i.availability === "out").length;
    const lowStock = items.filter((i) => i.availability === "low").length;

    res.json({
      totalSkus: items.length,
      inStock: items.length - outOfStock,
      outOfStock,
      lowStock,
      totalValue: items.reduce((sum, i) => sum + i.value, 0),
      items,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
