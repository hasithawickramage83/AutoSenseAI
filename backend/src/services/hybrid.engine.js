import { prisma } from "../config/db.js";
import { normalizePart } from "../utils/normalizePart.js";

/**
 * Match parts to supplier stock. Invoice includes all requested parts.
 * In-stock lines use catalog price; out-of-stock lines use $0 on the invoice.
 * POs are created only for unavailable parts (price from DB or 0).
 */
export const hybridEngine = async (aiResult) => {
  const result = {
    invoice: [],
    purchaseOrders: [],
    allInStock: true,
  };

  const { vehicleModel, parts } = aiResult;

  for (const part of parts) {
    const cleanPart = normalizePart(part);

    const stockItem = await prisma.stock.findFirst({
      where: {
        part: {
          name: {
            contains: cleanPart,
            mode: "insensitive",
          },
          vehicleModel: {
            name: {
              contains: vehicleModel || "",
              mode: "insensitive",
            },
          },
          activeStatus: 1,
        },
      },
      include: {
        part: {
          include: {
            vehicleModel: true,
          },
        },
      },
    });

    const catalogPrice = stockItem ? Number(stockItem.price) : 0;
    const inStock = Boolean(stockItem && stockItem.quantity > 0);
    const partName = `${vehicleModel || "Unknown"} ${cleanPart}`;

    result.invoice.push({
      partName,
      quantity: 1,
      price: inStock ? catalogPrice : 0,
      inStock,
      stockId: stockItem?.id ?? null,
    });

    if (!inStock) {
      result.allInStock = false;
      result.purchaseOrders.push({
        partName,
        quantity: 1,
        price: catalogPrice,
        stockId: stockItem?.id ?? null,
      });
    }
  }

  return result;
};
