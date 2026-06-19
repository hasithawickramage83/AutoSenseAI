const SIDE_MARKERS =
  /\b(left|right|lh|rh|driver(?:\s*side)?|passenger(?:\s*side)?|nearside|offside)\b/i;
const FRONT_REAR_MARKERS = /\b(front|rear|back)\b/i;

/**
 * Catalog-aligned parts that must specify left or right.
 * "side" alone (e.g. "side mirror") is NOT treated as left/right.
 */
export const SIDE_REQUIRED_PATTERNS = [
  { pattern: /\bhead\s*lights?\b/i, label: "headlight" },
  { pattern: /\btail\s*lights?\b/i, label: "tail light" },
  { pattern: /\btaillights?\b/i, label: "tail light" },
  { pattern: /\bfog\s*lights?\b/i, label: "fog light" },
  { pattern: /\bindicators?\b/i, label: "indicator" },
  { pattern: /\bturn\s*signals?\b/i, label: "turn signal" },
  { pattern: /\bblinkers?\b/i, label: "indicator" },
  { pattern: /\b(?:side\s+)?mirrors?\b/i, label: "side mirror" },
  { pattern: /\bwing\s*mirrors?\b/i, label: "side mirror" },
  { pattern: /\brear\s*view\s*mirrors?\b/i, label: "side mirror" },
  { pattern: /\bdoors?\b/i, label: "door" },
  { pattern: /\bfenders?\b/i, label: "fender" },
  { pattern: /\bquarter\s*panels?\b/i, label: "quarter panel" },
  { pattern: /\b(?:alloy\s*)?wheels?\b/i, label: "wheel" },
  { pattern: /\brims?\b/i, label: "wheel" },
  { pattern: /\b(?:side\s+)?skirts?\b/i, label: "side skirt" },
  { pattern: /\bpillars?\b/i, label: "pillar" },
  { pattern: /\bwheel\s*arches?\b/i, label: "wheel arch" },
  { pattern: /\bwheel\s*arch\s*liners?\b/i, label: "wheel arch liner" },
  { pattern: /\bmud\s*flaps?\b/i, label: "mud flap" },
  { pattern: /\bmouldings?\b/i, label: "moulding" },
  { pattern: /\bdoor\s*handles?\b/i, label: "door handle" },
  { pattern: /\bdoor\s*glass\b/i, label: "door glass" },
  { pattern: /\bquarter\s*glass\b/i, label: "quarter glass" },
  { pattern: /\broof\s*rails?\b/i, label: "roof rail" },
  { pattern: /\bchassis\s*rails?\b/i, label: "chassis rail" },
  { pattern: /\brunning\s*lights?\b/i, label: "running light" },
  { pattern: /\bdrls?\b/i, label: "running light" },
  { pattern: /\breflectors?\b/i, label: "reflector" },
];

/** Parts that must include front or rear when not already side-qualified. */
const FRONT_REAR_REQUIRED_PATTERNS = [
  { pattern: /\bbumpers?\b/i, label: "bumper" },
  { pattern: /\bgrilles?\b/i, label: "grille" },
  { pattern: /\bgrills?\b/i, label: "grille" },
  { pattern: /\bemblems?\b/i, label: "emblem" },
  { pattern: /\bchrome\s*trim\b/i, label: "chrome trim" },
  { pattern: /\bbumper\s*sensors?\b/i, label: "bumper sensor" },
  { pattern: /\bparking\s*cameras?\b/i, label: "parking camera" },
  { pattern: /\bnumber\s*plates?\b/i, label: "number plate" },
  { pattern: /\brego\s*plates?\b/i, label: "number plate" },
  { pattern: /\blicense\s*plates?\b/i, label: "number plate" },
];

export const SYMMETRIC_PARTS_PROMPT_LIST =
  "headlight, tail light, fog light, indicator, side mirror, door, fender, quarter panel, wheel, side skirt, pillar, wheel arch, mud flap, moulding, door handle, door glass, roof rail, running light, reflector";

function hasSideQualifier(text) {
  return SIDE_MARKERS.test(text);
}

function hasFrontRearQualifier(text) {
  return FRONT_REAR_MARKERS.test(text);
}

function buildSideClarification(mentioned, label) {
  return {
    mentioned,
    partType: label,
    field: "side",
    reason: `${label} must specify left or right`,
    prompt: `Please specify whether the damaged ${label} is the left or right side (e.g. "left ${label}").`,
  };
}

function buildPositionClarification(mentioned, label) {
  return {
    mentioned,
    partType: label,
    field: "position",
    reason: `${label} must specify front or rear`,
    prompt: `Please specify whether the damaged ${label} is at the front or rear (e.g. "front ${label}").`,
  };
}

function matchAmbiguity(partName) {
  const text = String(partName ?? "").trim();
  if (!text) return null;

  for (const { pattern, label } of SIDE_REQUIRED_PATTERNS) {
    if (!pattern.test(text)) continue;
    if (hasSideQualifier(text)) continue;
    return buildSideClarification(text, label);
  }

  for (const { pattern, label } of FRONT_REAR_REQUIRED_PATTERNS) {
    if (!pattern.test(text)) continue;
    if (hasFrontRearQualifier(text) || hasSideQualifier(text)) continue;
    return buildPositionClarification(text, label);
  }

  return null;
}

/** Scan raw damage description for vague part mentions (e.g. "tail light cracked"). */
export function findAmbiguousMentionsInDescription(description = "") {
  const text = String(description ?? "").trim();
  if (!text) return [];

  const lower = text.toLowerCase();
  const clarifications = [];
  const seen = new Set();

  const addIssue = (issue) => {
    const key = `${issue.partType}:${issue.mentioned.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    clarifications.push(issue);
  };

  for (const { pattern, label } of SIDE_REQUIRED_PATTERNS) {
    const re = new RegExp(pattern.source, "gi");
    let match;
    while ((match = re.exec(lower)) !== null) {
      const start = Math.max(0, match.index - 40);
      const end = Math.min(lower.length, match.index + match[0].length + 40);
      const context = lower.slice(start, end);
      if (hasSideQualifier(context)) continue;
      addIssue(buildSideClarification(match[0], label));
    }
  }

  for (const { pattern, label } of FRONT_REAR_REQUIRED_PATTERNS) {
    const re = new RegExp(pattern.source, "gi");
    let match;
    while ((match = re.exec(lower)) !== null) {
      const start = Math.max(0, match.index - 40);
      const end = Math.min(lower.length, match.index + match[0].length + 40);
      const context = lower.slice(start, end);
      if (hasFrontRearQualifier(context) || hasSideQualifier(context)) continue;
      addIssue(buildPositionClarification(match[0], label));
    }
  }

  return clarifications;
}

function normalizeClarification(entry) {
  if (!entry || typeof entry !== "object") return null;
  const mentioned = String(entry.mentioned ?? entry.part ?? "").trim();
  if (!mentioned) return null;

  const fromRules = matchAmbiguity(mentioned);
  return {
    mentioned,
    partType: entry.partType ?? fromRules?.partType ?? mentioned,
    field: entry.field ?? fromRules?.field ?? "detail",
    reason: entry.reason ?? fromRules?.reason ?? "More detail is required",
    prompt:
      entry.prompt ??
      fromRules?.prompt ??
      `Please clarify the damaged part: "${mentioned}".`,
  };
}

export function mergeClarificationLists(...lists) {
  const merged = [];
  const seen = new Set();

  for (const list of lists) {
    for (const entry of list ?? []) {
      const normalized = normalizeClarification(entry);
      if (!normalized) continue;
      const key = `${normalized.partType}:${normalized.mentioned.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(normalized);
    }
  }

  return merged;
}

/** Validate bare part names from AI; split complete vs needs clarification. */
export function validateDamageParts(bareParts = []) {
  const clarifications = [];
  const validParts = [];
  const seen = new Set();

  for (const raw of bareParts) {
    const part = String(raw ?? "").trim();
    if (!part) continue;

    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const issue = matchAmbiguity(part);
    if (issue) {
      clarifications.push(issue);
    } else {
      validParts.push(part);
    }
  }

  return { validParts, clarifications };
}

export function buildValidationResult(
  bareParts = [],
  aiClarifications = [],
  description = "",
) {
  const { validParts, clarifications: partClarifications } = validateDamageParts(bareParts);
  const descriptionClarifications = findAmbiguousMentionsInDescription(description);
  const clarifications = mergeClarificationLists(
    aiClarifications,
    partClarifications,
    descriptionClarifications,
  );

  return {
    validParts,
    clarifications,
    canSubmit: clarifications.length === 0 && validParts.length > 0,
  };
}

/** Reject full catalog-style part labels (with vehicle prefix) on submit. */
export function findClarificationsInPartLabels(partLabels = [], vehicleModel = "") {
  const issues = [];

  for (const label of partLabels) {
    const text = String(label ?? "").trim();
    if (!vehicleModel) {
      const issue = matchAmbiguity(text);
      if (issue) issues.push(issue);
      continue;
    }

    const escaped = vehicleModel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const bare = text.replace(new RegExp(`^${escaped}\\s+`, "i"), "").trim() || text;
    const issue = matchAmbiguity(bare);
    if (issue) {
      issues.push({ ...issue, mentioned: bare, fullLabel: text });
    }
  }

  return issues;
}
