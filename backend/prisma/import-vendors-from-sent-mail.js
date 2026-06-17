import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { directDatabaseUrl } from "../src/config/databaseUrl.js";

dotenv.config();

const seedUrl = process.env.DIRECT_URL || directDatabaseUrl(process.env.DATABASE_URL);
const prisma = new PrismaClient({
  datasources: {
    db: { url: seedUrl },
  },
});

const OWN_DOMAINS = ["ceylonautomobile.co.nz"];
const SKIP_LOCAL_PARTS = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "mailer-daemon",
  "postmaster",
]);

function normalizeAppPassword(pass) {
  return String(pass ?? "").replace(/\s+/g, "");
}

function isOwnOrSkippedEmail(email) {
  const normalized = email.toLowerCase().trim();
  if (!normalized.includes("@")) return true;
  const [local, domain] = normalized.split("@");
  if (SKIP_LOCAL_PARTS.has(local)) return true;
  if (OWN_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return true;
  return false;
}

function titleCase(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function deriveVendorFields(email, displayName) {
  const normalized = email.toLowerCase().trim();
  const name = displayName?.trim() || "";
  const local = normalized.split("@")[0] ?? "";
  const domain = normalized.split("@")[1] ?? "";

  let contactPerson = name;
  let companyName = name;

  if (!name) {
    contactPerson = titleCase(local.replace(/[._-]+/g, " "));
    const domainRoot = domain.replace(/^www\./i, "").split(".")[0] ?? "Vendor";
    companyName = titleCase(domainRoot.replace(/[-_]+/g, " "));
  }

  if (!contactPerson) contactPerson = companyName;
  if (!companyName) companyName = contactPerson;

  return {
    email: normalized,
    contactPerson,
    companyName,
  };
}

function normalizeAddressList(field) {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (Array.isArray(field.value)) return field.value;
  if (field.address) return [field];
  return [];
}

function collectAddressesFromParsed(parsed) {
  const found = new Map();

  const groups = [parsed.to, parsed.cc, parsed.bcc];

  for (const group of groups) {
    for (const entry of normalizeAddressList(group)) {
      const address = entry?.address?.toLowerCase().trim();
      if (!address || isOwnOrSkippedEmail(address)) continue;
      if (!found.has(address)) {
        found.set(address, deriveVendorFields(address, entry?.name));
      }
    }
  }

  return found;
}

async function fetchSentRecipients() {
  const user = process.env.SMTP_USER || process.env.IMAP_USER;
  const pass = normalizeAppPassword(process.env.SMTP_PASS || process.env.IMAP_PASS);
  const host = process.env.IMAP_HOST || "imap.gmail.com";
  const port = Number(process.env.IMAP_PORT || 993);

  if (!user || !pass) {
    throw new Error("SMTP_USER and SMTP_PASS (or IMAP_USER/IMAP_PASS) are required in .env");
  }

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const recipients = new Map();

  await client.connect();

  const lock = await client.getMailboxLock("[Gmail]/Sent Mail");
  try {
    const total = client.mailbox.exists ?? 0;
    console.log(`Reading ${total} message(s) from Sent Mail for ${user}…`);

    for await (const message of client.fetch("1:*", {
      envelope: true,
      source: true,
      uid: true,
    })) {
      try {
        const parsed = await simpleParser(message.source);
        const parsedRecipients = collectAddressesFromParsed(parsed);
        for (const [email, fields] of parsedRecipients) {
          if (!recipients.has(email)) recipients.set(email, fields);
        }
      } catch {
        for (const field of ["to", "cc", "bcc"]) {
          const list = message.envelope?.[field] ?? [];
          for (const entry of list) {
            const address = entry?.address?.toLowerCase().trim();
            if (!address || isOwnOrSkippedEmail(address)) continue;
            if (!recipients.has(address)) {
              recipients.set(address, deriveVendorFields(address, entry?.name));
            }
          }
        }
      }
    }
  } finally {
    lock.release();
  }

  await client.logout();
  return recipients;
}

async function upsertVendors(recipients) {
  let created = 0;
  let skipped = 0;

  for (const vendor of recipients.values()) {
    const existing = await prisma.vendor.findUnique({ where: { email: vendor.email } });
    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.vendor.create({
      data: {
        companyName: vendor.companyName,
        contactPerson: vendor.contactPerson,
        email: vendor.email,
        status: "ACTIVE",
      },
    });
    created += 1;
  }

  return { created, skipped, total: recipients.size };
}

async function main() {
  const recipients = await fetchSentRecipients();
  console.log(`Found ${recipients.size} unique recipient email address(es).`);

  const result = await upsertVendors(recipients);
  console.log(
    `Vendor import complete: ${result.created} created, ${result.skipped} already existed, ${result.total} total unique recipients.`,
  );
}

main()
  .catch((err) => {
    console.error("Import failed:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
