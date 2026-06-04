export const normalizePart = (text) => {
  return text
    .toLowerCase()
    .replace(/front|rear|left|right|side|upper|lower/g, "")
    .replace(/\s+/g, " ")
    .trim();
};