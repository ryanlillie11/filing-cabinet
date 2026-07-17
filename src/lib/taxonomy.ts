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
  "home_purchase",
  "mortgage",
  "home_inspection",
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
  home_purchase: {
    label: "Home Purchase / Closing",
    filePrefix: "Closing",
    folder: "Home Purchase & Mortgage",
  },
  mortgage: {
    label: "Mortgage / Bank",
    filePrefix: "Mortgage",
    folder: "Home Purchase & Mortgage",
  },
  home_inspection: {
    label: "Home Inspection",
    filePrefix: "Inspection",
    folder: "Home Purchase & Mortgage",
  },
  uncategorized: { label: "Uncategorized", filePrefix: "Doc", folder: "Uncategorized" },
};

/** Categories that share the "Home Purchase & Mortgage" folder — used to
 *  group them into one dashboard section (closing docs, bank/mortgage
 *  paperwork, and the home inspection report(s) from the purchase). */
export const HOME_PURCHASE_CATEGORIES: CategoryKey[] = [
  "home_purchase",
  "mortgage",
  "home_inspection",
];

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

export const HISTORICAL_FOLDER = "Historical (Previous Owner)";
export const MANUALS_SUBFOLDER = "Manuals";

/**
 * Resolve the Drive folder path segments (under the root folder) for a doc.
 * Manuals for a recognized appliance system file under
 * "Appliances & Systems/<System>/Manuals" (its own "manual section"), matching
 * the proposed tree; everything else files by category. Docs flagged
 * from_previous_owner file into a "Historical (Previous Owner)" bucket for
 * that system (or nested under the category folder if there's no system)
 * instead — historical takes priority over the Manuals subfolder so the two
 * stay peer sections rather than nested. A model-proposed subfolder nests one
 * level deeper.
 */
export function folderPathFor(
  category: CategoryKey,
  houseSystem: HouseSystemKey | null,
  proposedSubfolder?: string | null,
  fromPreviousOwner?: boolean
): string[] {
  let segments: string[];
  const systemFolder = houseSystem ? HOUSE_SYSTEMS[houseSystem]?.systemFolder : undefined;

  if (fromPreviousOwner) {
    segments = systemFolder
      ? ["Appliances & Systems", systemFolder, HISTORICAL_FOLDER]
      : [CATEGORIES[category].folder, HISTORICAL_FOLDER];
  } else if (category === "manual" && systemFolder) {
    segments = ["Appliances & Systems", systemFolder, MANUALS_SUBFOLDER];
  } else {
    segments = [CATEGORIES[category].folder];
  }

  if (proposedSubfolder && category !== "uncategorized") {
    segments.push(proposedSubfolder.replace(/[/\\]/g, "-").trim());
  }
  return segments;
}
