/** Ensure Neon pooler URLs use Prisma-compatible pgbouncer mode. */
export function withPgBouncer(url) {
  if (!url) return url;
  if (url.includes("pgbouncer=true")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}pgbouncer=true`;
}

/** Derive Neon direct (non-pooler) URL from a pooler DATABASE_URL. */
export function directDatabaseUrl(url) {
  if (!url) return url;
  return url
    .replace("-pooler.", ".")
    .replace(/[?&]pgbouncer=true/g, "")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");
}

export function resolveDatabaseUrls() {
  const pooled = withPgBouncer(process.env.DATABASE_URL);
  const direct = process.env.DIRECT_URL || directDatabaseUrl(process.env.DATABASE_URL);
  return { pooled, direct };
}
