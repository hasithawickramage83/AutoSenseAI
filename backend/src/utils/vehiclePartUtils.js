function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip a leading vehicle make/model prefix from a part label. */
export function barePartName(partLabel, vehicleModel) {
  let label = String(partLabel ?? "").trim();
  const model = String(vehicleModel ?? "").trim();
  if (!label) return "";
  if (!model) return label;

  const exact = new RegExp(`^${escapeRegex(model)}\\s+`, "i");
  if (exact.test(label)) {
    return label.replace(exact, "").trim();
  }

  const tokens = model.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const make = tokens[0];
    const loose = new RegExp(`^${escapeRegex(make)}\\s+\\S+\\s+`, "i");
    if (loose.test(label)) {
      return label.replace(loose, "").trim();
    }
  }

  return label;
}

/** Prefix a bare or AI-generated part name with the exact catalog vehicle model. */
export function partLabelWithModel(partLabel, vehicleModel) {
  const model = String(vehicleModel ?? "").trim();
  if (!model) return String(partLabel ?? "").trim();
  const bare = barePartName(partLabel, model);
  return bare ? `${model} ${bare}` : model;
}

export function normalizePartsList(parts, vehicleModel) {
  return (parts ?? [])
    .map((part) => partLabelWithModel(part, vehicleModel))
    .filter(Boolean);
}
