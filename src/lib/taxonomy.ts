// Document taxonomy: categories, house systems, and the Drive folder mapping.

export const CATEGORY_KEYS = [
  "manual",
  "warranty",
  "invoice_paid",
  "invoice_open",
  "receipt",
  "permit",
  "insurance",
  "contractor_estimate",
  "renovation_record",
  "tax_expense",
  "correspondence",
  "uncategorized",
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const HOUSE_SYSTEM_KEYS = [
  "pool",
  "hot_tub",
  "hvac",
  "roof",
  "basement",
  "kitchen",
  "plumbing",
  "electrical",
  "exterior_landscaping",
  "sheds",
  "general",
] as const;

export type HouseSystemKey = (typeof HOUSE_SYSTEM_KEYS)[number];

export const CATEGORIES: Record<
  CategoryKey,
  { label: string; filePrefix: string; folder: string }
> = {
  manual: { label: "Manual / spec sheet", filePrefix: "Manual", folder: "Manuals" },
  warranty: { label: "Warranty", filePrefix: "Warranty", folder: "Warranties" },
  invoice_paid: { label: "Invoice (paid)", filePrefix: "Invoice", folder: "Invoices & Receipts" },
  invoice_open: { label: "Invoice (OPEN)", filePrefix: "Invoice", folder: "Invoices & Receipts" },
  receipt: { label: "Receipt", filePrefix: "Receipt", folder: "Invoices & Receipts" },
  permit: { label: "Permit / municipal", filePrefix: "Permit", folder: "Permits & Municipal" },
  insurance: { label: "Insurance", filePrefix: "Insurance", folder: "Insurance" },
  contractor_estimate: {
    label: "Contractor estimate / contract",
    filePrefix: "Estimate",
    folder: "Contractor & Renovation Docs",
  },
  renovation_record: {
    label: "Renovation record",
    filePrefix: "Renovation",
    folder: "Contractor & Renovation Docs",
  },
  tax_expense: {
    label: "Tax-relevant expense",
    filePrefix: "TaxExpense",
    folder: "Tax-Relevant Home Expenses",
  },
  correspondence: {
    label: "Correspondence / misc",
    filePrefix: "Correspondence",
    folder: "Correspondence",
  },
  uncategorized: { label: "Uncategorized", filePrefix: "Doc", folder: "Uncategorized" },
};

export const HOUSE_SYSTEMS: Record<HouseSystemKey, { label: string; systemFolder?: string }> = {
  pool: { label: "Pool", systemFolder: "Pool & Hot Tub" },
  hot_tub: { label: "Hot Tub", systemFolder: "Pool & Hot Tub" },
  hvac: { label: "HVAC", systemFolder: "HVAC" },
  roof: { label: "Roof" },
  basement: { label: "Basement" },
  kitchen: { label: "Kitchen", systemFolder: "Kitchen Appliances" },
  plumbing: { label: "Plumbing", systemFolder: "Water Heater, Sump, Plumbing" },
  electrical: { label: "Electrical" },
  exterior_landscaping: { label: "Exterior / Landscaping" },
  sheds: { label: "Sheds" },
  general: { label: "General / Whole-House" },
};

/**
 * Resolve the Drive folder path segments (under the root folder) for a doc.
 * Manuals for a recognized appliance system file under
 * "Appliances & Systems/<System>", matching the proposed tree; everything
 * else files by category. A model-proposed subfolder nests one level deeper.
 */
export function folderPathFor(
  category: CategoryKey,
  houseSystem: HouseSystemKey | null,
  proposedSubfolder?: string | null
): string[] {
  let segments: string[];
  const systemFolder = houseSystem ? HOUSE_SYSTEMS[houseSystem]?.systemFolder : undefined;
  if (category === "manual" && systemFolder) {
    segments = ["Appliances & Systems", systemFolder];
  } else {
    segments = [CATEGORIES[category].folder];
  }
  if (proposedSubfolder && category !== "uncategorized") {
    segments.push(proposedSubfolder.replace(/[/\\]/g, "-").trim());
  }
  return segments;
}
