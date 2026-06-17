import { prisma } from "../config/db.js";
import { findStockForLine } from "./invoiceStock.service.js";

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
    const stockItem = await findStockForLine(
      { partName: part },
      { vehicleModel: vehicleModel || "" },
    );

    const catalogPrice = stockItem ? Number(stockItem.price) : 0;
    const inStock = Boolean(stockItem && stockItem.quantity > 0);
    const partName = String(part).trim();

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

/** Build invoice/PO split from explicit quotation parts (supplier custom quotes). */
export async function hybridEngineFromParts(quotationParts, vehicleModel = "") {
  const result = {
    invoice: [],
    purchaseOrders: [],
    allInStock: true,
  };

  for (const row of quotationParts) {
    const partName = String(row.name ?? row.partName);
    const quantity = Math.max(1, Number(row.qty ?? row.quantity ?? 1));
    const stock = await findStockForLine(
      { partName, stockId: row.stockId ?? null },
      { vehicleModel },
    );
    const catalogPrice = stock ? Number(stock.price) : Number(row.price ?? 0);
    const inStock = Boolean(stock && stock.quantity >= quantity);

    result.invoice.push({
      partName,
      quantity,
      price: inStock ? catalogPrice : 0,
      inStock,
      stockId: stock?.id ?? null,
    });

    if (!inStock) {
      result.allInStock = false;
      result.purchaseOrders.push({
        partName,
        quantity,
        price: catalogPrice,
        stockId: stock?.id ?? null,
      });
    }
  }

  return result;
}
