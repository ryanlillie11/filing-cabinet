import { CATEGORIES, type CategoryKey } from "./taxonomy";

function cleanVendorWords(vendor: string): string[] {
  const stripped = vendor
    .replace(/[,.]?\s*\b(llc|inc|corp|co|ltd|llp|pllc|plc|company|incorporated)\b\.?/gi, "")
    .replace(/[^a-zA-Z0-9\s&-]/g, "")
    .trim();
  if (!stripped) return ["Unknown"];
  const words = stripped.split(/[\s&-]+/).filter(Boolean);
  return words.map((w) =>
    w === w.toUpperCase() && w.length > 3
      ? w.charAt(0) + w.slice(1).toLowerCase() // de-yell ALLCAPS words
      : w.charAt(0).toUpperCase() + w.slice(1)
  );
}

/** Clean + concatenate a vendor name for the strict Category_Date_Vendor filename convention. */
export function normalizeVendor(vendor: string): string {
  return cleanVendorWords(vendor).join("").slice(0, 40);
}

/** Clean but keep spaces — for the human-readable manual naming convention. */
export function displayVendor(vendor: string): string {
  return cleanVendorWords(vendor).join(" ").slice(0, 60);
}

function sanitizeFilename(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extensionFor(mimeType: string): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  return "bin";
}

/**
 * Build the filed filename. Manuals use a simple human-readable convention
 * ("Hayward AQR-15 Chlorinator Manual.pdf") rather than the strict
 * Category_Date_Vendor pattern, since a manual has no meaningful document
 * date and the point is to recognize it at a glance.
 */
export function standardFilename(opts: {
  category: CategoryKey;
  date: string; // YYYY-MM-DD
  vendor: string; // raw/display vendor, e.g. "Hayward Pool Products"
  vendorNormalized: string; // concatenated, e.g. "HaywardPoolProducts"
  mimeType: string;
  equipmentLabel?: string | null;
  disambiguator?: number;
}): string {
  const ext = extensionFor(opts.mimeType);

  if (opts.category === "manual") {
    const vendorDisplay = displayVendor(opts.vendor);
    const label = opts.equipmentLabel?.trim();
    const base = label ? `${vendorDisplay} ${label} Manual` : `${vendorDisplay} Manual`;
    const suffix = opts.disambiguator && opts.disambiguator > 1 ? ` ${opts.disambiguator}` : "";
    return `${sanitizeFilename(base)}${suffix}.${ext}`;
  }

  const prefix = CATEGORIES[opts.category].filePrefix;
  const suffix = opts.disambiguator && opts.disambiguator > 1 ? `_${opts.disambiguator}` : "";
  return `${prefix}_${opts.date}_${opts.vendorNormalized || "Unknown"}${suffix}.${ext}`;
}
