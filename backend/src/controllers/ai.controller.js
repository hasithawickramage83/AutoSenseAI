import { analyzeDamage } from "../services/ai.service.js";
import { prisma } from "../config/db.js";
import { processQuotationById } from "../services/quotation.processor.js";
import {
  addActivityLog,
  severityFromPartCount,
  buildDamages,
  buildRecommendations,
} from "../utils/activityLog.js";
import { nextQuotationId } from "../utils/documentIds.js";
import { parseIntId } from "../utils/parseId.js";
import { normalizePartsList } from "../utils/vehiclePartUtils.js";

function resolveVehicleModel(vehicle) {
  return vehicle?.trim() || null;
}

function buildAiInput(vehicle, description, text) {
  const model = resolveVehicleModel(vehicle);
  const desc = description?.trim();
  if (text?.trim()) return text.trim();
  if (model && desc) return `Vehicle model: ${model}. ${desc}`;
  if (model) return `Vehicle model: ${model}`;
  return desc || "";
}

export const previewDamage = async (req, res) => {
  try {
    const { vehicle, description, text } = req.body;
    const vehicleModel = resolveVehicleModel(vehicle);

    const inputText = buildAiInput(vehicle, description, text);

    if (!inputText) {
      return res.status(400).json({ error: "Vehicle model and damage description are required" });
    }
    if (!vehicleModel) {
      return res.status(400).json({ error: "Select a vehicle make / model" });
    }

    const aiResult = await analyzeDamage(inputText, vehicleModel);
    const parts = normalizePartsList(aiResult.parts || [], vehicleModel);
    const normalizedAiResult = { ...aiResult, vehicleModel, parts };
    const damages = buildDamages(parts);
    const recommendations = buildRecommendations(parts);

    res.json({
      aiResult: normalizedAiResult,
      vehicle: vehicleModel,
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
    const workshopId = parseIntId(req.user.userId) ?? Number(req.user.userId);
    const vehicleModel = resolveVehicleModel(vehicle);

    const inputText = buildAiInput(vehicle, description, text);

    if (!inputText) {
      return res.status(400).json({ error: "Vehicle model and damage description are required" });
    }
    if (!vehicleModel) {
      return res.status(400).json({ error: "Select a vehicle make / model" });
    }

    if (!Array.isArray(selectedParts) || selectedParts.length === 0) {
      return res.status(400).json({ error: "Select at least one part for the quotation" });
    }

    const aiResult = await analyzeDamage(inputText, vehicleModel);
    const normalizedParts = normalizePartsList(aiResult.parts || [], vehicleModel);
    const selectedSet = new Set(
      selectedParts.map((p) => String(p).toLowerCase()),
    );
    const filteredParts = normalizedParts.filter((p) =>
      selectedSet.has(String(p).toLowerCase()),
    );

    if (filteredParts.length === 0) {
      return res.status(400).json({ error: "None of the selected parts were found in the analysis" });
    }

    const filteredAiResult = { vehicleModel, parts: filteredParts };
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
      const quotationId = await nextQuotationId(tx);
      const quotation = await tx.quotation.create({
        data: {
          id: quotationId,
          workshopId,
          vehicle: vehicleModel,
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

    let processing = null;
    try {
      processing = await processQuotationById(saved.quotation.id, { actorUserId: workshopId });
    } catch (procErr) {
      console.error("Auto-process quotation error:", procErr);
    }

    const quotationRow = processing
      ? await prisma.quotation.findUnique({
          where: { id: saved.quotation.id },
          include: { invoice: true, purchaseOrders: true },
        })
      : saved.quotation;

    res.json({
      aiResult: filteredAiResult,
      quotation: quotationRow ?? saved.quotation,
      processing: processing
        ? {
            allInStock: processing.allInStock,
            autoSent: processing.autoSent,
            invoiceId: processing.invoice?.id,
            quotationStatus: processing.quotation?.status,
            purchaseOrderCount: processing.purchaseOrders?.length ?? 0,
          }
        : null,
    });
  } catch (error) {
    console.error("processDamage error:", error);
    res.status(500).json({ error: error.message });
  }
};
