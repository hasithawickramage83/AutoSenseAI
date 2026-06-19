import { prisma } from "../config/db.js";
import { normalizePart } from "../utils/normalizePart.js";
import { barePartName } from "../utils/vehiclePartUtils.js";
import { buildVehicleModelFilter } from "../utils/vehicleCatalog.js";

const stockInclude = {
  part: { include: { vehicleModel: { include: { make: true } } } },
};

function partWhereWithVehicle(vehicleHint) {
  const vehicleModel = buildVehicleModelFilter(vehicleHint);
  return vehicleModel ? { vehicleModel } : {};
}

async function findBestStock(partWhere) {
  return prisma.stock.findFirst({
    where: { part: partWhere },
    orderBy: [{ quantity: "desc" }, { price: "desc" }, { id: "asc" }],
    include: stockInclude,
  });
}

/** Resolve catalog stock for an invoice line (by stockId or part name). */
export async function findStockForLine(line, options = {}) {
  if (line.stockId != null) {
    return prisma.stock.findUnique({
      where: { id: Number(line.stockId) },
      include: stockInclude,
    });
  }

  const partName = String(line.partName ?? line.name ?? "");
  const vehicleModel =
    options.vehicleModel?.trim() || line.vehicleModel?.trim() || "";

  let partHint;
  let vehicleHint;

  if (vehicleModel) {
    vehicleHint = vehicleModel;
    partHint = barePartName(partName, vehicleModel);
  } else {
    const tokens = partName.trim().split(/\s+/);
    vehicleHint = tokens.length > 1 ? tokens.slice(0, 2).join(" ") : "";
    partHint =
      tokens.length > 1
        ? tokens.slice(2).join(" ") || tokens[tokens.length - 1]
        : partName;
  }

  partHint = partHint.trim();
  if (!partHint) return null;

  const vehicleClause = partWhereWithVehicle(vehicleHint);
  const basePartWhere = {
    activeStatus: 1,
    ...vehicleClause,
  };

  const exact = await findBestStock({
    ...basePartWhere,
    name: { equals: partHint, mode: "insensitive" },
  });
  if (exact) return exact;

  const contains = await findBestStock({
    ...basePartWhere,
    name: { contains: partHint, mode: "insensitive" },
  });
  if (contains) return contains;

  const cleanPart = normalizePart(partHint);
  if (!cleanPart) return null;

  return findBestStock({
    ...basePartWhere,
    name: { contains: cleanPart, mode: "insensitive" },
  });
}

export async function evaluateInvoiceStock(lineItems) {
  const items = [];
  let stockReady = true;

  for (const line of lineItems ?? []) {
    const requiredQty = Math.max(1, Number(line.quantity ?? line.qty ?? 1));
    const stock = await findStockForLine(line);
    const availableQty = stock?.quantity ?? 0;
    const inStock = Boolean(stock && availableQty >= requiredQty);
    if (!inStock) stockReady = false;

    items.push({
      partName: line.partName ?? line.name,
      requiredQty,
      availableQty,
      inStock,
      stockId: stock?.id ?? null,
      catalogPrice: stock ? Number(stock.price) : 0,
    });
  }

  return { stockReady, items };
}

export function formatLineItemsWithStock(lineItems, stockItems) {
  return (lineItems ?? []).map((line, i) => {
    const evalRow = stockItems[i];
    return {
      partName: line.partName ?? line.name,
      quantity: evalRow?.requiredQty ?? line.quantity ?? 1,
      price: evalRow?.catalogPrice ?? Number(line.price),
      stockId: evalRow?.stockId ?? line.stockId ?? null,
    };
  });
}
