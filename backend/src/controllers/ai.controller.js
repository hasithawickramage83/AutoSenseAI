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
import {
  buildValidationResult,
  findClarificationsInPartLabels,
  findAmbiguousMentionsInDescription,
  mergeClarificationLists,
} from "../utils/damagePartValidation.js";

function resolveVehicleModel(body) {
  return (body.vehicleModel ?? body.vehicle)?.trim() || null;
}

function resolveVehicleNumber(body) {
  return body.vehicleNumber?.trim() || null;
}

function formatVehicleDisplay(vehicleModel, vehicleNumber) {
  if (!vehicleModel) return vehicleNumber || "";
  if (!vehicleNumber) return vehicleModel;
  return `${vehicleModel} - ${vehicleNumber}`;
}

function buildAiInput(vehicleModel, vehicleNumber, description, text) {
  const model = vehicleModel?.trim();
  const reg = vehicleNumber?.trim();
  const desc = description?.trim();
  if (text?.trim()) return text.trim();

  const vehicleLabel = model && reg ? `${model} (${reg})` : model || reg || "";
  if (vehicleLabel && desc) return `Vehicle: ${vehicleLabel}. ${desc}`;
  if (vehicleLabel) return `Vehicle: ${vehicleLabel}`;
  return desc || "";
}

function validateVehicleDetails(body) {
  const vehicleModel = resolveVehicleModel(body);
  const vehicleNumber = resolveVehicleNumber(body);

  if (!vehicleModel) {
    return { error: "Select vehicle make and model" };
  }
  if (!vehicleNumber) {
    return { error: "Vehicle number is required" };
  }

  return {
    vehicleModel,
    vehicleNumber: vehicleNumber.toUpperCase(),
    vehicleDisplay: formatVehicleDisplay(vehicleModel, vehicleNumber.toUpperCase()),
  };
}

function buildDamageAnalysis(aiResult, vehicleModel, description = "") {
  const bareParts = aiResult.parts || [];
  const validation = buildValidationResult(
    bareParts,
    aiResult.clarificationsNeeded || [],
    description,
  );
  const parts = normalizePartsList(validation.validParts, vehicleModel);
  const damages = buildDamages(parts);
  const recommendations = buildRecommendations(parts);

  return {
    parts,
    damages,
    recommendations,
    clarificationsNeeded: validation.clarifications,
    canSubmit: validation.canSubmit,
    severity: severityFromPartCount(parts.length),
    normalizedAiResult: {
      ...aiResult,
      vehicleModel,
      parts,
      clarificationsNeeded: validation.clarifications,
    },
  };
}

export const previewDamage = async (req, res) => {
  try {
    const { description, text } = req.body;
    const vehicleDetails = validateVehicleDetails(req.body);
    if (vehicleDetails.error) {
      return res.status(400).json({ error: vehicleDetails.error });
    }

    const { vehicleModel, vehicleNumber } = vehicleDetails;
    const inputText = buildAiInput(vehicleModel, vehicleNumber, description, text);

    if (!inputText) {
      return res.status(400).json({ error: "Vehicle details and damage description are required" });
    }

    const aiResult = await analyzeDamage(inputText, vehicleModel);
    const analysis = buildDamageAnalysis(
      { ...aiResult, vehicleModel, vehicleNumber },
      vehicleModel,
      description?.trim() || "",
    );

    res.json({
      aiResult: analysis.normalizedAiResult,
      vehicle: vehicleDetails.vehicleDisplay,
      vehicleModel,
      vehicleNumber,
      parts: analysis.parts,
      damages: analysis.damages,
      recommendations: analysis.recommendations,
      clarificationsNeeded: analysis.clarificationsNeeded,
      canSubmit: analysis.canSubmit,
      severity: analysis.severity,
    });
  } catch (error) {
    console.error("previewDamage error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const processDamage = async (req, res) => {
  try {
    const { description, text, selectedParts } = req.body;
    const workshopId = parseIntId(req.user.userId) ?? Number(req.user.userId);
    const vehicleDetails = validateVehicleDetails(req.body);
    if (vehicleDetails.error) {
      return res.status(400).json({ error: vehicleDetails.error });
    }

    const { vehicleModel, vehicleNumber, vehicleDisplay } = vehicleDetails;
    const inputText = buildAiInput(vehicleModel, vehicleNumber, description, text);

    if (!inputText) {
      return res.status(400).json({ error: "Vehicle details and damage description are required" });
    }

    if (!Array.isArray(selectedParts) || selectedParts.length === 0) {
      return res.status(400).json({ error: "Select at least one part for the quotation" });
    }

    const aiResult = await analyzeDamage(inputText, vehicleModel);
    const analysis = buildDamageAnalysis(
      { ...aiResult, vehicleModel, vehicleNumber },
      vehicleModel,
      description?.trim() || "",
    );

    const selectedSet = new Set(
      selectedParts.map((p) => String(p).toLowerCase()),
    );
    const filteredParts = analysis.parts.filter((p) =>
      selectedSet.has(String(p).toLowerCase()),
    );

    if (filteredParts.length === 0) {
      return res.status(400).json({ error: "None of the selected parts were found in the analysis" });
    }

    const submitClarifications = mergeClarificationLists(
      analysis.clarificationsNeeded,
      findClarificationsInPartLabels(filteredParts, vehicleModel),
      findAmbiguousMentionsInDescription(description?.trim() || ""),
    );

    if (submitClarifications.length > 0) {
      return res.status(400).json({
        error: "Damage description is incomplete — clarify the parts below before submitting",
        clarificationsNeeded: submitClarifications,
        canSubmit: false,
      });
    }

    const filteredAiResult = {
      vehicleModel,
      vehicleNumber,
      parts: filteredParts,
      clarificationsNeeded: [],
    };
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
          vehicle: vehicleDisplay,
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
