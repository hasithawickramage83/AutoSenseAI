const PREFIX = {
  quotation: "QTN",
  invoice: "INV",
  purchaseOrder: "PO",
};

/**
 * Next document number: PREFIX + 6-digit zero-padded integer (e.g. QTN000001).
 */
export async function nextDocumentId(prisma, model, kind) {
  const prefix = PREFIX[kind];
  if (!prefix) throw new Error(`Unknown document kind: ${kind}`);

  const rows = await prisma[model].findMany({
    select: { id: true },
    orderBy: { id: "desc" },
    take: 200,
  });

  const re = new RegExp(`^${prefix}(\\d{6})$`);
  let max = 0;
  for (const row of rows) {
    const match = String(row.id).match(re);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }

  return `${prefix}${String(max + 1).padStart(6, "0")}`;
}

export const nextQuotationId = (prisma) => nextDocumentId(prisma, "quotation", "quotation");
export const nextInvoiceId = (prisma) => nextDocumentId(prisma, "invoice", "invoice");
export const nextPurchaseOrderId = (prisma) => nextDocumentId(prisma, "purchaseOrder", "purchaseOrder");
