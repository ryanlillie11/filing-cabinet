import { CATEGORIES, type CategoryKey } from "./taxonomy";

/** Clean a vendor name for use in a filename: drop legal suffixes, no yelling. */
export function normalizeVendor(vendor: string): string {
  const stripped = vendor
    .replace(/[,.]?\s*\b(llc|inc|corp|co|ltd|llp|pllc|plc|company|incorporated)\b\.?/gi, "")
    .replace(/[^a-zA-Z0-9\s&-]/g, "")
    .trim();
  if (!stripped) return "Unknown";
  const words = stripped.split(/[\s&-]+/).filter(Boolean);
  const cased = words.map((w) =>
    w === w.toUpperCase() && w.length > 3
      ? w.charAt(0) + w.slice(1).toLowerCase() // de-yell ALLCAPS words
      : w.charAt(0).toUpperCase() + w.slice(1)
  );
  return cased.join("").slice(0, 40);
}

export function extensionFor(mimeType: string): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  return "bin";
}

/** Build the standardized filename: {Category}_{YYYY-MM-DD}_{Vendor}.{ext} */
export function standardFilename(
  category: CategoryKey,
  date: string, // YYYY-MM-DD
  vendorNormalized: string,
  mimeType: string,
  disambiguator?: number
): string {
  const prefix = CATEGORIES[category].filePrefix;
  const suffix = disambiguator && disambiguator > 1 ? `_${disambiguator}` : "";
  return `${prefix}_${date}_${vendorNormalized || "Unknown"}${suffix}.${extensionFor(mimeType)}`;
}
