import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendInvoiceEmail({ to, workshopName, invoice }) {
  const transport = createTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@autosense.nz";

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

  if (!transport) {
    console.warn("[email] SMTP not configured — invoice email skipped for", to);
    return { sent: false, reason: "smtp_not_configured" };
  }

  await transport.sendMail({
    from,
    to,
    subject: `Invoice ${invoice.id} — NZD $${Number(invoice.total).toFixed(2)}`,
    text,
  });

  return { sent: true };
}
