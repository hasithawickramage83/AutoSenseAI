import { prisma } from "../config/db.js";

export async function addActivityLog(userId, message, type = "system") {
  return prisma.activityLog.create({
    data: { userId, message, type },
  });
}

export function severityFromPartCount(count) {
  if (count >= 3) return "High";
  if (count === 2) return "Medium";
  return "Low";
}

export function buildQuotationParts(invoiceLines) {
  return invoiceLines.map((line) => ({
    name: line.partName,
    qty: line.quantity ?? 1,
    price: line.price,
  }));
}

export function buildDamages(parts) {
  return (parts || []).map((p) =>
    String(p)
      .replace(/^(front|rear|left|right)\s+/i, "")
      .trim(),
  );
}

export function buildRecommendations(parts) {
  return (parts || []).map((p) => `Replace ${p}`);
}
