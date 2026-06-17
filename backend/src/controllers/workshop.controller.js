import { prisma } from "../config/db.js";
import { addActivityLog, severityFromPartCount } from "../utils/activityLog.js";
import { parseIntId } from "../utils/parseId.js";

function workshopIdFromReq(req) {
  return parseIntId(req.user.userId) ?? Number(req.user.userId);
}

function mapQuotation(q) {
  return {
    id: q.id,
    workshopId: q.workshopId,
    workshopName: q.workshop?.name ?? "",
    vehicle: q.vehicle,
    description: q.description,
    photos: [],
    damages: q.damages,
    severity: q.severity,
    recommendations: q.recommendations,
    parts: q.parts,
    labourCost: q.labourCost,
    status: q.status,
    createdAt: q.createdAt.getTime(),
    invoiceId: q.invoice?.id,
    poId: q.purchaseOrders?.[0]?.id,
  };
}

function mapInvoice(inv) {
  const lineItems = inv.lineItems ?? [];
  return {
    id: inv.id,
    quotationId: inv.quotationId,
    workshopName: inv.workshop?.name ?? inv.quotation?.workshop?.name ?? "",
    vehicle: inv.quotation?.vehicle ?? "",
    parts: lineItems.map((line) => ({
      name: line.partName,
      qty: line.quantity ?? 1,
      price: line.price,
    })),
    labourCost: inv.labourCost,
    total: inv.total,
    status: inv.status,
    createdAt: inv.createdAt.getTime(),
  };
}

export const getQuotations = async (req, res) => {
  try {
    const workshopId = workshopIdFromReq(req);
    const rows = await prisma.quotation.findMany({
      where: { workshopId },
      include: {
        workshop: true,
        invoice: true,
        purchaseOrders: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map(mapQuotation));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getInvoices = async (req, res) => {
  try {
    const workshopId = workshopIdFromReq(req);
    const rows = await prisma.invoice.findMany({
      where: { workshopId, status: "Sent" },
      include: {
        workshop: true,
        quotation: { include: { workshop: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map(mapInvoice));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getHistory = async (req, res) => {
  try {
    const workshopId = workshopIdFromReq(req);
    const rows = await prisma.activityLog.findMany({
      where: { userId: workshopId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(
      rows.map((l) => ({
        id: String(l.id),
        message: l.message,
        type: l.type,
        createdAt: l.createdAt.getTime(),
      })),
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateQuotation = async (req, res) => {
  try {
    const workshopId = workshopIdFromReq(req);
    const { id } = req.params;
    const { vehicle, description, parts } = req.body;

    const existing = await prisma.quotation.findFirst({
      where: { id, workshopId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    if (existing.status !== "Pending") {
      return res.status(400).json({ error: "Only pending quotations can be edited" });
    }

    const partList = (parts || existing.parts).map((p) => ({
      name: p.name,
      qty: p.qty ?? 1,
      price: p.price ?? 0,
    }));

    const updated = await prisma.quotation.update({
      where: { id },
      data: {
        vehicle: vehicle ?? existing.vehicle,
        description: description ?? existing.description,
        parts: partList,
        damages: partList.map((p) => p.name.toLowerCase()),
        severity: severityFromPartCount(partList.length),
        labourCost: 350 + partList.length * 120,
      },
      include: {
        workshop: true,
        invoice: true,
        purchaseOrders: true,
      },
    });

    await addActivityLog(workshopId, `Quotation ${id} updated`, "user");

    res.json(mapQuotation(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteQuotation = async (req, res) => {
  try {
    const workshopId = workshopIdFromReq(req);
    const { id } = req.params;

    const existing = await prisma.quotation.findFirst({
      where: { id, workshopId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    if (existing.status !== "Pending") {
      return res.status(400).json({ error: "Only pending quotations can be deleted" });
    }

    await prisma.$transaction([
      prisma.damageReport.deleteMany({ where: { quotationId: id } }),
      prisma.purchaseOrder.deleteMany({ where: { quotationId: id } }),
      prisma.invoice.deleteMany({ where: { quotationId: id } }),
      prisma.quotation.delete({ where: { id } }),
    ]);

    await addActivityLog(workshopId, `Quotation ${id} deleted`, "user");

    res.json({ message: "Quotation deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const listVehicleModels = async (_req, res) => {
  try {
    const models = await prisma.vehicleModel.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    res.json(models.map((m) => ({ id: String(m.id), name: m.name })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
