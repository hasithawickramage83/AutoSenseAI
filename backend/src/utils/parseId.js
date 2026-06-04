/** Parse route/body id for integer primary keys (User, Part, Stock, etc.). */
export function parseIntId(value) {
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}
