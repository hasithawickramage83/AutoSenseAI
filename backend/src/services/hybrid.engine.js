import { prisma } from "../config/db.js";
import { normalizePart } from "../utils/normalizePart.js";

export const hybridEngine = async (aiResult) => {
  const result = {
    invoice: [],
    purchaseOrders: []
  };

  const { vehicleModel, parts } = aiResult;

  for (let part of parts) {

    console.log("Part:", part);
    // console.log("Vehicle:", vehicleModel);

    const cleanPart = normalizePart(part);

    const stockItem = await prisma.stock.findFirst({
      where: {
        part: {
          name: {
            contains: cleanPart,
            mode: "insensitive"
          },
          vehicleModel: {
            name: {
              contains: vehicleModel || "",
              mode: "insensitive"
            }
          },
          activeStatus: 1
        }
      },
      include: {
        part: {
          include: {
            vehicleModel: true
          }
        }
      }
    });

    // ALWAYS generate invoice
    result.invoice.push({
      partName: `${vehicleModel || "Unknown"} ${cleanPart}`,
      quantity: 1,
      price: stockItem ? stockItem.price : 150
    });

    // IF NOT AVAILABLE → create PO
    if (!stockItem || stockItem.quantity <= 0) {
      result.purchaseOrders.push({
        partName: `${vehicleModel || "Unknown"} ${cleanPart}`,
        quantity: 1,
        status: "PENDING"
      });
    }
  }

  return result;
};