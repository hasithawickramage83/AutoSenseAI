import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface LineItem {
  name: string;
  qty: number;
  price: number;
}

interface QuotationPdfData {
  id: string;
  workshopName: string;
  vehicle: string;
  description: string;
  parts: LineItem[];
  damages: string[];
  recommendations: string[];
  severity: string;
  labourCost: number;
  createdAt: number;
}

interface InvoicePdfData {
  id: string;
  quotationId: string;
  workshopName: string;
  vehicle?: string;
  parts: LineItem[];
  labourCost: number;
  total: number;
  createdAt: number;
}

interface PurchaseOrderPdfData {
  id: string;
  quotationId?: string | null;
  workshopName: string;
  vehicle?: string;
  vendorEmail: string;
  urgency: string;
  parts: LineItem[];
  createdAt: number;
}

function fmt(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function addHeader(doc: jsPDF, title: string) {
  doc.setFontSize(18);
  doc.setTextColor(30, 64, 175);
  doc.text("AutoSense AI Platform", 14, 20);
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(title, 14, 30);
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 34, 196, 34);
}

export function downloadQuotationPdf(q: QuotationPdfData) {
  const doc = new jsPDF();
  addHeader(doc, "Quotation Request");
  let y = 42;

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Request ID: ${q.id}`, 14, y);
  y += 6;
  doc.text(`Workshop: ${q.workshopName}`, 14, y);
  y += 6;
  doc.text(`Vehicle: ${q.vehicle}`, 14, y);
  y += 6;
  doc.text(`Severity: ${q.severity}`, 14, y);
  y += 6;
  doc.text(`Date: ${new Date(q.createdAt).toLocaleString()}`, 14, y);
  y += 10;

  doc.setTextColor(30, 41, 59);
  doc.text("Description:", 14, y);
  y += 6;
  const descLines = doc.splitTextToSize(q.description, 180);
  doc.setTextColor(71, 85, 105);
  doc.text(descLines, 14, y);
  y += descLines.length * 5 + 8;

  autoTable(doc, {
    startY: y,
    head: [["Part", "Qty", "Est. Price (NZD)"]],
    body: q.parts.map((p) => [p.name, String(p.qty), fmt(p.price)]),
    theme: "grid",
    headStyles: { fillColor: [30, 64, 175] },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  if (q.damages.length > 0) {
    doc.setTextColor(30, 41, 59);
    doc.text("Damages:", 14, y);
    y += 6;
    doc.setTextColor(71, 85, 105);
    q.damages.forEach((d) => {
      doc.text(`• ${d}`, 18, y);
      y += 5;
    });
    y += 4;
  }

  if (q.recommendations.length > 0) {
    doc.setTextColor(30, 41, 59);
    doc.text("Recommendations:", 14, y);
    y += 6;
    doc.setTextColor(71, 85, 105);
    q.recommendations.forEach((r) => {
      doc.text(`• ${r}`, 18, y);
      y += 5;
    });
  }

  doc.save(`quotation-${q.id}.pdf`);
}

export function downloadInvoicePdf(inv: InvoicePdfData) {
  const doc = new jsPDF();
  addHeader(doc, "Invoice");

  let y = 42;
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Invoice ID: ${inv.id}`, 14, y);
  y += 6;
  doc.text(`Quotation: ${inv.quotationId}`, 14, y);
  y += 6;
  doc.text(`Workshop: ${inv.workshopName}`, 14, y);
  y += 6;
  if (inv.vehicle) {
    doc.text(`Vehicle: ${inv.vehicle}`, 14, y);
    y += 6;
  }
  doc.text(`Date: ${new Date(inv.createdAt).toLocaleString()}`, 14, y);
  y += 10;

  const partsTotal = inv.parts.reduce((s, p) => s + p.price * p.qty, 0);

  autoTable(doc, {
    startY: y,
    head: [["Part", "Qty", "Unit Price", "Subtotal"]],
    body: [
      ...inv.parts.map((p) => [
        p.name,
        String(p.qty),
        fmt(p.price),
        fmt(p.price * p.qty),
      ]),
      ["Labour", "—", "—", fmt(inv.labourCost)],
      ["Total", "", "", fmt(inv.total)],
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 64, 175] },
    footStyles: { fillColor: [241, 245, 249] },
  });

  doc.save(`invoice-${inv.id}.pdf`);
}

export function downloadPurchaseOrderPdf(po: PurchaseOrderPdfData) {
  const doc = new jsPDF();
  addHeader(doc, "Purchase Order");

  let y = 42;
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`PO ID: ${po.id}`, 14, y);
  y += 6;
  if (po.quotationId) {
    doc.text(`Quotation: ${po.quotationId}`, 14, y);
    y += 6;
  }
  doc.text(`Workshop: ${po.workshopName}`, 14, y);
  y += 6;
  if (po.vehicle) {
    doc.text(`Vehicle: ${po.vehicle}`, 14, y);
    y += 6;
  }
  doc.text(`Vendor: ${po.vendorEmail}`, 14, y);
  y += 6;
  doc.text(`Urgency: ${po.urgency}`, 14, y);
  y += 6;
  doc.text(`Date: ${new Date(po.createdAt).toLocaleString()}`, 14, y);
  y += 10;

  const total = po.parts.reduce((s, p) => s + p.price * p.qty, 0);

  autoTable(doc, {
    startY: y,
    head: [["Part", "Qty", "Unit Price", "Subtotal"]],
    body: [
      ...po.parts.map((p) => [
        p.name,
        String(p.qty),
        fmt(p.price),
        fmt(p.price * p.qty),
      ]),
      ["Total", "", "", fmt(total)],
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 64, 175] },
  });

  doc.save(`purchase-order-${po.id}.pdf`);
}

export interface VendorComparisonPdfData {
  quotationId: string;
  vehicle: string;
  comparison: {
    items: {
      partName: string;
      quantity: number;
      offers: { vendorName: string; unitPrice: number }[];
      lowestVendorName: string | null;
      lowestPrice: number | null;
    }[];
    vendorTotals: { vendorName: string; total: number }[];
    recommendedVendor: { vendorName: string; total: number } | null;
    bestMixTotal: number;
    savingsVsHighest: number;
  };
}

export function downloadVendorComparisonPdf(data: VendorComparisonPdfData) {
  const doc = new jsPDF();
  addHeader(doc, "Vendor Quotation Comparison");

  let y = 42;
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Quotation: ${data.quotationId}`, 14, y);
  y += 6;
  doc.text(`Vehicle: ${data.vehicle}`, 14, y);
  y += 6;
  if (data.comparison.recommendedVendor) {
    doc.text(
      `Recommended: ${data.comparison.recommendedVendor.vendorName} — ${fmt(data.comparison.recommendedVendor.total)}`,
      14,
      y,
    );
    y += 6;
  }
  doc.text(`Best mix total: ${fmt(data.comparison.bestMixTotal)}`, 14, y);
  y += 10;

  for (const item of data.comparison.items) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`${item.partName} (×${item.quantity})`, 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);

    autoTable(doc, {
      startY: y,
      head: [["Vendor", "Unit Price", "Lowest"]],
      body: item.offers.map((o) => [
        o.vendorName,
        fmt(o.unitPrice),
        o.vendorName === item.lowestVendorName ? "Yes" : "",
      ]),
      theme: "grid",
      headStyles: { fillColor: [30, 64, 175] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  if (data.comparison.vendorTotals.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Vendor", "Total"]],
      body: [
        ...data.comparison.vendorTotals.map((v) => [
          v.vendorName +
            (v.vendorName === data.comparison.recommendedVendor?.vendorName ? " ★" : ""),
          fmt(v.total),
        ]),
        ["Best item-by-item mix", fmt(data.comparison.bestMixTotal)],
      ],
      theme: "grid",
      headStyles: { fillColor: [30, 64, 175] },
    });
  }

  doc.save(`vendor-comparison-${data.quotationId}.pdf`);
}
