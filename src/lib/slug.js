export function normalizeSalonSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w\u0600-\u06FF_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

