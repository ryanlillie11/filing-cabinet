import type { CategoryKey, HouseSystemKey } from "./taxonomy";

export type DocumentStatus =
  | "processing"
  | "pending_review"
  | "filed"
  | "needs_attention"
  | "split"
  | "discarded";

export interface DocumentRow {
  id: string;
  status: DocumentStatus;
  source: "upload" | "email";
  category: CategoryKey | null;
  house_system: HouseSystemKey | null;
  vendor: string | null;
  vendor_normalized: string | null;
  doc_date: string | null;
  date_source: "document" | "upload" | null;
  amount: number | null;
  invoice_open: boolean;
  warranty_expiration: string | null;
  description: string | null;
  ai_confidence: number | null;
  low_confidence: boolean;
  proposed_subfolder: string | null;
  from_previous_owner: boolean;
  equipment_label: string | null;
  raw_extracted_text: string | null;
  original_filename: string | null;
  filename: string | null;
  mime_type: string | null;
  drive_file_id: string | null;
  drive_link: string | null;
  drive_folder_path: string | null;
  storage_path: string | null;
  content_hash: string | null;
  possible_duplicate_of: string | null;
  parent_upload_id: string | null;
  page_range: string | null;
  upload_date: string;
  created_at: string;
  updated_at: string;
}

/** Fields the review queue / edit form may change. */
export type EditableFields = Partial<
  Pick<
    DocumentRow,
    | "category"
    | "house_system"
    | "vendor"
    | "doc_date"
    | "amount"
    | "invoice_open"
    | "warranty_expiration"
    | "description"
    | "proposed_subfolder"
    | "from_previous_owner"
    | "equipment_label"
  >
>;
