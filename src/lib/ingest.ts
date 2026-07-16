import { createHash, randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { classifyFile, type ExtractedDoc } from "./claude";
import { normalizeVendor, standardFilename } from "./naming";
import { folderPathFor } from "./taxonomy";
import { availableFilename, resolveFolder, updateDriveFile, uploadToDrive } from "./drive";
import { logActivity, STAGING_BUCKET, supabase } from "./supabase";
import type { DocumentRow } from "./types";

const LOW_CONFIDENCE_THRESHOLD = 0.7;

export const ACCEPTED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function stageFile(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const path = `${randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase()
    .storage.from(STAGING_BUCKET)
    .upload(path, buffer, { contentType: mimeType });
  if (error) throw new Error(`Staging upload failed: ${error.message}`);
  return path;
}

export async function readStagedFile(path: string): Promise<Buffer> {
  const { data, error } = await supabase().storage.from(STAGING_BUCKET).download(path);
  if (error || !data) throw new Error(`Staging download failed: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

/** Step 1 of the pipeline: stage the raw file and create a `processing` row. */
export async function ingestFile(opts: {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  source: "upload" | "email";
}): Promise<DocumentRow> {
  const { buffer, mimeType, filename, source } = opts;
  if (!ACCEPTED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType} (PDF, JPG, PNG only)`);
  }
  const contentHash = sha256(buffer);
  const storagePath = await stageFile(buffer, mimeType, filename);

  const { data, error } = await supabase()
    .from("documents")
    .insert({
      status: "processing",
      source,
      original_filename: filename,
      mime_type: mimeType,
      content_hash: contentHash,
      storage_path: storagePath,
    })
    .select()
    .single();
  if (error) throw error;

  await logActivity(data.id, "ingested", { filename, source, mimeType });
  return data as DocumentRow;
}

function applyExtraction(doc: ExtractedDoc, uploadDate: string) {
  const docDate = doc.doc_date ?? uploadDate.slice(0, 10);
  return {
    category: doc.category,
    house_system: doc.house_system,
    vendor: doc.vendor,
    vendor_normalized: normalizeVendor(doc.vendor),
    doc_date: docDate,
    date_source: doc.doc_date ? "document" : "upload",
    amount: doc.amount,
    invoice_open: doc.invoice_open,
    warranty_expiration: doc.warranty_expiration,
    description: doc.description,
    proposed_subfolder: doc.proposed_subfolder,
    ai_confidence: doc.confidence,
    low_confidence: doc.confidence < LOW_CONFIDENCE_THRESHOLD || doc.category === "uncategorized",
    raw_extracted_text: doc.extracted_text,
    status: "pending_review" as const,
  };
}

/** Flag likely duplicates: exact content hash, or vendor+date+amount match. */
async function flagDuplicate(row: DocumentRow): Promise<void> {
  const db = supabase();
  let match: { id: string } | null = null;

  const { data: hashMatch } = await db
    .from("documents")
    .select("id")
    .eq("content_hash", row.content_hash)
    .neq("id", row.id)
    .not("status", "in", '("discarded","split")')
    .limit(1)
    .maybeSingle();
  match = hashMatch;

  if (!match && row.vendor_normalized && row.doc_date && row.amount != null) {
    const { data: metaMatch } = await db
      .from("documents")
      .select("id")
      .eq("vendor_normalized", row.vendor_normalized)
      .eq("doc_date", row.doc_date)
      .eq("amount", row.amount)
      .neq("id", row.id)
      .not("status", "in", '("discarded","split")')
      .limit(1)
      .maybeSingle();
    match = metaMatch;
  }

  if (match) {
    await db.from("documents").update({ possible_duplicate_of: match.id }).eq("id", row.id);
    await logActivity(row.id, "duplicate_flagged", { duplicate_of: match.id });
  }
}

/** Split page range [start,end] (1-indexed inclusive) into its own PDF. */
async function splitPdf(buffer: Buffer, start: number, end: number): Promise<Buffer> {
  const src = await PDFDocument.load(buffer);
  const out = await PDFDocument.create();
  const indices = [];
  for (let i = start - 1; i <= Math.min(end - 1, src.getPageCount() - 1); i++) indices.push(i);
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return Buffer.from(await out.save());
}

/**
 * Step 2: classify a staged `processing` row. Handles multi-document scans by
 * splitting into child rows. Returns the rows now awaiting review.
 */
export async function classifyDocument(row: DocumentRow): Promise<DocumentRow[]> {
  const db = supabase();
  const buffer = await readStagedFile(row.storage_path!);

  let extracted: ExtractedDoc[];
  try {
    extracted = await classifyFile(buffer, row.mime_type!);
  } catch (err) {
    await db.from("documents").update({ status: "needs_attention" }).eq("id", row.id);
    await logActivity(row.id, "error", { stage: "classify", message: String(err) });
    throw err;
  }

  const results: DocumentRow[] = [];

  if (extracted.length === 1 || row.mime_type !== "application/pdf") {
    const doc = extracted[0];
    const { data, error } = await db
      .from("documents")
      .update(applyExtraction(doc, row.upload_date))
      .eq("id", row.id)
      .select()
      .single();
    if (error) throw error;
    await logActivity(row.id, "classified", {
      category: doc.category,
      vendor: doc.vendor,
      confidence: doc.confidence,
      documents_found: extracted.length,
    });
    await flagDuplicate(data as DocumentRow);
    const { data: fresh } = await db.from("documents").select().eq("id", row.id).single();
    results.push(fresh as DocumentRow);
  } else {
    // Multi-document scan: one child row + split file per detected document.
    for (const doc of extracted) {
      const start = doc.page_start ?? 1;
      const end = doc.page_end ?? start;
      const childBuffer = await splitPdf(buffer, start, end);
      const childName = `${row.original_filename?.replace(/\.pdf$/i, "") ?? "scan"}_p${start}-${end}.pdf`;
      const childPath = await stageFile(childBuffer, "application/pdf", childName);

      const { data: child, error } = await db
        .from("documents")
        .insert({
          source: row.source,
          original_filename: childName,
          mime_type: "application/pdf",
          content_hash: sha256(childBuffer),
          storage_path: childPath,
          parent_upload_id: row.id,
          page_range: `[${start},${end}]`,
          upload_date: row.upload_date,
          ...applyExtraction(doc, row.upload_date),
        })
        .select()
        .single();
      if (error) throw error;
      await logActivity(child.id, "classified", {
        category: doc.category,
        vendor: doc.vendor,
        confidence: doc.confidence,
        split_from: row.id,
      });
      await flagDuplicate(child as DocumentRow);
      const { data: fresh } = await db.from("documents").select().eq("id", child.id).single();
      results.push(fresh as DocumentRow);
    }
    await db.from("documents").update({ status: "split" }).eq("id", row.id);
    await logActivity(row.id, "split", { into: results.map((r) => r.id) });
  }

  return results;
}

/** Step 3: on confirm — file to Drive, index, clean up staging. */
export async function fileDocument(id: string): Promise<DocumentRow> {
  const db = supabase();
  const { data: row, error } = await db.from("documents").select().eq("id", id).single();
  if (error) throw error;
  const doc = row as DocumentRow;
  if (doc.status === "filed") return doc;
  if (!doc.category || !doc.doc_date || !doc.storage_path) {
    throw new Error("Document is missing category, date, or staged file");
  }

  const buffer = await readStagedFile(doc.storage_path);
  const segments = folderPathFor(doc.category, doc.house_system, doc.proposed_subfolder);
  const folder = await resolveFolder(segments);
  const desired = standardFilename(
    doc.category,
    doc.doc_date,
    doc.vendor_normalized || normalizeVendor(doc.vendor ?? "Unknown"),
    doc.mime_type ?? "application/pdf"
  );
  const finalName = await availableFilename(folder.id, desired);
  const uploaded = await uploadToDrive(folder.id, finalName, doc.mime_type!, buffer);

  const { data: updated, error: upErr } = await db
    .from("documents")
    .update({
      status: "filed",
      filename: finalName,
      drive_file_id: uploaded.fileId,
      drive_link: uploaded.webViewLink,
      drive_folder_path: folder.path,
      storage_path: null,
    })
    .eq("id", id)
    .select()
    .single();
  if (upErr) throw upErr;

  await supabase().storage.from(STAGING_BUCKET).remove([doc.storage_path]);
  await logActivity(id, "filed", { folder: folder.path, filename: finalName });
  return updated as DocumentRow;
}

/**
 * Post-filing edit: if name- or folder-affecting fields changed on a filed
 * doc, rename/move the Drive file to match.
 */
export async function syncDriveAfterEdit(doc: DocumentRow): Promise<DocumentRow> {
  if (doc.status !== "filed" || !doc.drive_file_id || !doc.category || !doc.doc_date) return doc;
  const db = supabase();

  const segments = folderPathFor(doc.category, doc.house_system, doc.proposed_subfolder);
  const folder = await resolveFolder(segments);
  const desired = standardFilename(
    doc.category,
    doc.doc_date,
    doc.vendor_normalized || normalizeVendor(doc.vendor ?? "Unknown"),
    doc.mime_type ?? "application/pdf"
  );

  const needsRename = desired !== doc.filename;
  const needsMove = folder.path !== doc.drive_folder_path;
  if (!needsRename && !needsMove) return doc;

  const finalName = needsRename ? await availableFilename(folder.id, desired) : doc.filename!;
  await updateDriveFile(doc.drive_file_id, {
    name: needsRename ? finalName : undefined,
    newFolderId: needsMove ? folder.id : undefined,
  });

  const { data: updated, error } = await db
    .from("documents")
    .update({ filename: finalName, drive_folder_path: folder.path })
    .eq("id", doc.id)
    .select()
    .single();
  if (error) throw error;
  await logActivity(doc.id, "edited", {
    drive_synced: true,
    filename: finalName,
    folder: folder.path,
  });
  return updated as DocumentRow;
}
