import { analyzeDamage } from "../services/ai.service.js";
import { hybridEngine } from "../services/hybrid.engine.js";
import { prisma } from "../config/db.js";

export const repairAgent = async (text) => {
  const ai = await analyzeDamage(text);
  const result = await hybridEngine(ai);

  await prisma.damageReport.create({
    data: {
      inputText: text,
      aiResult: ai,
    },
  });

  return { ai, result };
};