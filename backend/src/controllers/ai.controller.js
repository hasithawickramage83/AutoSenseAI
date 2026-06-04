import { analyzeDamage } from "../services/ai.service.js";
import { prisma } from "../config/db.js";
import {
  addActivityLog,
  severityFromPartCount,
  buildDamages,
  buildRecommendations,
} from "../utils/activityLog.js";

export const previewDamage = async (req, res) => {
  try {
    const { vehicle, description, text } = req.body;

    const inputText =
      text?.trim() ||
      [vehicle?.trim(), description?.trim()].filter(Boolean).join(". ");

    if (!inputText) {
      return res.status(400).json({ error: "Vehicle description or damage text is required" });
    }

    const aiResult = await analyzeDamage(inputText);
    const parts = aiResult.parts || [];
    const damages = buildDamages(parts);
    const recommendations = buildRecommendations(parts);

    res.json({
      aiResult,
      vehicle: vehicle?.trim() || aiResult.vehicleModel || "Unknown vehicle",
      parts,
      damages,
      recommendations,
      severity: severityFromPartCount(parts.length),
    });
  } catch (error) {
    console.error("previewDamage error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const processDamage = async (req, res) => {
  try {
    const { vehicle, description, text, selectedParts } = req.body;
    const workshopId = req.user.userId;

    const inputText =
      text?.trim() ||
      [vehicle?.trim(), description?.trim()].filter(Boolean).join(". ");

    if (!inputText) {
      return res.status(400).json({ error: "Vehicle description or damage text is required" });
    }

    if (!Array.isArray(selectedParts) || selectedParts.length === 0) {
      return res.status(400).json({ error: "Select at least one part for the quotation" });
    }

    const aiResult = await analyzeDamage(inputText);
    const selectedSet = new Set(selectedParts.map((p) => String(p).toLowerCase()));
    const filteredParts = (aiResult.parts || []).filter((p) =>
      selectedSet.has(String(p).toLowerCase()),
    );

    if (filteredParts.length === 0) {
      return res.status(400).json({ error: "None of the selected parts were found in the analysis" });
    }

    const filteredAiResult = { ...aiResult, parts: filteredParts };
    const parts = filteredParts.map((p) => ({
      name: p,
      qty: 1,
      price: 0,
    }));
    const damages = buildDamages(filteredParts);
    const recommendations = buildRecommendations(filteredParts);
    const severity = severityFromPartCount(parts.length);
    const labourCost = 350 + parts.length * 120;

    const saved = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.create({
        data: {
          workshopId,
          vehicle: vehicle?.trim() || aiResult.vehicleModel || "Unknown vehicle",
          description: description?.trim() || inputText,
          inputText,
          aiResult: filteredAiResult,
          parts,
          damages,
          recommendations,
          severity,
          labourCost,
          status: "Pending",
        },
      });

      await tx.damageReport.create({
        data: {
          quotationId: quotation.id,
          inputText,
          aiResult: filteredAiResult,
        },
      });

      return { quotation };
    });

    await addActivityLog(
      workshopId,
      `Quotation submitted for ${saved.quotation.vehicle} — ${parts.length} part(s), severity ${severity}`,
      "ai",
    );

    res.json({
      aiResult: filteredAiResult,
      quotation: saved.quotation,
    });
  } catch (error) {
    console.error("processDamage error:", error);
    res.status(500).json({ error: error.message });
  }
};
