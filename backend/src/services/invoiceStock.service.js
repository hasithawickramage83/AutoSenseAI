import { prisma } from "../config/db.js";
import { normalizePart } from "../utils/normalizePart.js";
import { barePartName } from "../utils/vehiclePartUtils.js";

/** Resolve catalog stock for an invoice line (by stockId or part name). */
export async function findStockForLine(line, options = {}) {
  if (line.stockId != null) {
    return prisma.stock.findUnique({
      where: { id: Number(line.stockId) },
      include: { part: { include: { vehicleModel: true } } },
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

  const cleanPart = normalizePart(partHint);
  if (!cleanPart) return null;

  return prisma.stock.findFirst({
    where: {
      part: {
        name: { contains: cleanPart, mode: "insensitive" },
        activeStatus: 1,
        ...(vehicleHint
          ? {
              vehicleModel: {
                name: { equals: vehicleHint, mode: "insensitive" },
              },
            }
          : {}),
      },
    },
    include: { part: { include: { vehicleModel: true } } },
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
