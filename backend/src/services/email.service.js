import axios from "axios";

const COMPANY_NAME = "Ceylon Automobile";
const COMPANY_WEBSITE = "https://ceylonautomobile.co.nz/";
const COMPANY_ADDRESS = "13 Cranwell Street, Henderson, Auckland 0612";
const COMPANY_PHONE = "021 214 7160";

const DEFAULT_FROM = "sales@ceylonautomobile.co.nz";

function companyContactText() {
  return [
    COMPANY_NAME,
    COMPANY_WEBSITE,
    COMPANY_ADDRESS,
    `Phone: ${COMPANY_PHONE}`,
  ].join("\n");
}

function companyContactHtml() {
  return `
    <div style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;">
      <p style="margin:0 0 8px;">Best regards,</p>
      <p style="margin:0;font-weight:600;">${COMPANY_NAME}</p>
      <p style="margin:4px 0 0;">
        <a href="${COMPANY_WEBSITE}" style="color:#dc2626;text-decoration:none;">${COMPANY_WEBSITE}</a>
      </p>
      <p style="margin:4px 0 0;color:#64748b;font-size:14px;">${COMPANY_ADDRESS}</p>
      <p style="margin:4px 0 0;color:#64748b;font-size:14px;">Phone: ${COMPANY_PHONE}</p>
    </div>
  `;
}

function emailFrom() {
  return process.env.EMAIL_FROM || DEFAULT_FROM;
}

function webhookUrl() {
  return process.env.EMAIL_WEBHOOK_URL?.trim() || null;
}

async function postEmailWebhook(payload) {
  const url = webhookUrl();
  if (!url) {
    console.warn("[email] EMAIL_WEBHOOK_URL not configured — email skipped for", payload.to);
    return { sent: false, reason: "webhook_not_configured" };
  }

  try {
    await axios.post(url, payload, {
      timeout: 30_000,
      headers: { "Content-Type": "application/json" },
    });
    return { sent: true };
  } catch (error) {
    const message = error.response?.data
      ? `${error.message} — ${JSON.stringify(error.response.data)}`
      : error.message;
    console.error("[email] webhook send failed:", message);
    return { sent: false, reason: message };
  }
}

export async function sendInvoiceEmail({ to, workshopName, invoice }) {
  const lines = (invoice.lineItems ?? []).map(
    (l) => `  • ${l.partName} x${l.quantity ?? 1} — NZD $${Number(l.price).toFixed(2)}`,
  );

  const text = [
    `Hello ${workshopName},`,
    "",
    `Your repair invoice ${invoice.id} is ready.`,
    "",
    "Line items:",
    ...lines,
    "",
    `Labour: NZD $${Number(invoice.labourCost).toFixed(2)}`,
    `Total: NZD $${Number(invoice.total).toFixed(2)}`,
    "",
    "Thank you for using Vehicle Workshop Repair Center.",
  ].join("\n");

  return postEmailWebhook({
    type: "invoice",
    from: emailFrom(),
    to,
    subject: `Invoice ${invoice.id} — NZD $${Number(invoice.total).toFixed(2)}`,
    text,
    workshopName,
    invoice: {
      id: invoice.id,
      labourCost: invoice.labourCost,
      total: invoice.total,
      lineItems: invoice.lineItems ?? [],
    },
  });
}

function formatPartList(parts) {
  return parts
    .map((p, i) => `${i + 1}. ${p.partName}${p.quantity > 1 ? ` (Qty: ${p.quantity})` : ""}`)
    .join("\n");
}

function formatVehicleSubject(vehicleModel, vehicleNumber) {
  const model = vehicleModel?.trim();
  const number = vehicleNumber?.trim() || "—";
  return model
    ? `${model} – Vehicle No. ${number}`
    : `Vehicle No. ${number}`;
}

function formatVehicleBody(vehicleModel, vehicleNumber) {
  const model = vehicleModel?.trim();
  const number = vehicleNumber?.trim() || "—";
  return model
    ? `Vehicle Model ${model}, Vehicle No. ${number}`
    : `Vehicle No. ${number}`;
}

/** Parse data-URL or raw base64 image payloads for webhook attachments. */
export function buildImageAttachments(images = []) {
  const attachments = [];
  for (const img of images) {
    const dataUrl = String(img?.dataUrl ?? img?.data ?? "").trim();
    if (!dataUrl) continue;

    let filename = String(img?.name ?? "image").trim() || "image";
    let contentType = "image/jpeg";
    let base64 = dataUrl;

    if (dataUrl.startsWith("data:")) {
      const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
      if (!match) continue;
      contentType = match[1];
      base64 = match[2];
      if (!filename.includes(".")) {
        const ext = contentType.split("/")[1]?.split("+")[0] ?? "jpg";
        filename = `${filename}.${ext}`;
      }
    }

    try {
      attachments.push({ filename, contentType, contentBase64: base64 });
    } catch {
      // skip invalid image payload
    }
  }
  return attachments;
}

export async function sendVendorQuotationRequestEmail({
  to,
  bcc,
  companyName,
  vehicleModel,
  vehicleNumber,
  quotationNumber,
  parts,
  responseUrl,
  images,
  vendorLinks,
  batchEmail = false,
}) {
  const vehicleLabel = formatVehicleSubject(vehicleModel, vehicleNumber);
  const vehicleBody = formatVehicleBody(vehicleModel, vehicleNumber);
  const subject = `Quotation Request – ${vehicleLabel} – Quotation No. ${quotationNumber}`;

  const greeting = batchEmail ? "Dear Supplier," : `Dear ${companyName},`;
  const greetingHtml = batchEmail
    ? "<p>Dear Supplier,</p>"
    : `<p>Dear ${companyName},</p>`;

  const linksText = `\n${responseUrl}`;
  const linksHtml = `<p><a href="${responseUrl}" style="color:#dc2626;font-weight:600;">Submit Quotation</a></p>`;

  const text = [
    greeting,
    "",
    "I hope you are doing well.",
    "",
    `We would like to request a quotation for the following parts for ${vehicleBody}, under Quotation No. ${quotationNumber}.`,
    "",
    formatPartList(parts),
    "",
    "Kindly provide your best possible pricing for the above items by completing the quotation form provided through the secure link below or reply to this email with the pricing for the above items.",
    linksText,
    "",
    "Thank you for your support. We look forward to your prompt response.",
    "",
    "Best regards,",
    "",
    companyContactText(),
  ].join("\n");

  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;line-height:1.5;max-width:640px;">`,
    greetingHtml,
    "<p>I hope you are doing well.</p>",
    `<p>We would like to request a quotation for the following parts for <strong>${vehicleBody}</strong>, under <strong>Quotation No. ${quotationNumber}</strong>.</p>`,
    "<ul>",
    ...parts.map(
      (p) =>
        `<li>${p.partName}${p.quantity > 1 ? ` (Qty: ${p.quantity})` : ""}</li>`,
    ),
    "</ul>",
    "<p>Kindly provide your best possible pricing for the above items by completing the quotation form through the secure link below or reply to this email with the pricing for the above items.</p>",
    linksHtml,
    "<p>Thank you for your support. We look forward to your prompt response.</p>",
    companyContactHtml(),
    "</div>",
  ].join("");

  const attachments = buildImageAttachments(images);
  const attachmentNote =
    attachments.length > 0
      ? `\n\n${attachments.length} reference image(s) attached to this email.`
      : "";
  const attachmentHtml =
    attachments.length > 0
      ? `<p><em>${attachments.length} reference image(s) attached to this email.</em></p>`
      : "";

  return postEmailWebhook({
    type: "vendor_quotation",
    from: emailFrom(),
    to,
    bcc: bcc?.length ? bcc : undefined,
    subject,
    text: text + attachmentNote,
    html: html + attachmentHtml,
    companyName: batchEmail ? "Supplier" : companyName,
    vehicleModel: vehicleModel?.trim() || undefined,
    vehicleNumber,
    quotationNumber,
    responseUrl,
    parts,
    attachments,
    vendorLinks: vendorLinks ?? undefined,
    batchEmail,
  });
}
