import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CATEGORY_KEYS, HOUSE_SYSTEM_KEYS, CATEGORIES, HOUSE_SYSTEMS } from "./taxonomy";

export const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

let cached: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!cached) cached = new Anthropic();
  return cached;
}

const ExtractedDocSchema = z.object({
  page_start: z
    .number()
    .nullable()
    .describe("First page (1-indexed) of this document within the file; null for images"),
  page_end: z.number().nullable().describe("Last page (1-indexed), inclusive; null for images"),
  category: z.enum(CATEGORY_KEYS),
  house_system: z.enum(HOUSE_SYSTEM_KEYS),
  vendor: z.string().describe("Vendor/company display name, e.g. 'PoolCorp'"),
  doc_date: z
    .string()
    .nullable()
    .describe("Document date (not scan/upload date) as YYYY-MM-DD, null if not extractable"),
  amount: z.number().nullable().describe("Dollar amount if applicable (invoice/receipt total)"),
  invoice_open: z
    .boolean()
    .describe("True only if this is an invoice that appears unpaid/open — this is actionable"),
  warranty_expiration: z
    .string()
    .nullable()
    .describe("Warranty/coverage expiration date as YYYY-MM-DD if one is stated or derivable"),
  description: z
    .string()
    .describe("Short human-readable description, e.g. 'Pool heater replacement — Raypak 406A'"),
  proposed_subfolder: z
    .string()
    .nullable()
    .describe(
      "Only if the doc clearly needs a new subfolder that doesn't fit the fixed taxonomy; strongly prefer null"
    ),
  from_previous_owner: z
    .boolean()
    .describe(
      "True only if the document text gives clear evidence it came from the home's previous owner/seller (e.g. left-behind manuals, a transferred warranty, closing/inspection paperwork) rather than something the current owner obtained. Default false when there's no such evidence — this is not a guess based on document age."
    ),
  equipment_label: z
    .string()
    .nullable()
    .describe(
      "Only for category=manual: a short label combining model/equipment type for filing, e.g. 'AQR-15 Chlorinator' or 'RA0406A Pool Heater'. Null for every other category."
    ),
  confidence: z.number().describe("Your classification confidence, 0 to 1"),
  extracted_text: z
    .string()
    .describe(
      "The document's text content for search/Q&A. Complete for short docs; for long manuals include model numbers, specs, serial numbers, and key sections rather than every page"
    ),
});

const ClassificationSchema = z.object({
  documents: z
    .array(ExtractedDocSchema)
    .describe("One entry per distinct document found in the file"),
});

export type ExtractedDoc = z.infer<typeof ExtractedDocSchema>;

function systemPrompt(): string {
  const cats = CATEGORY_KEYS.map((k) => `- ${k}: ${CATEGORIES[k].label}`).join("\n");
  const systems = HOUSE_SYSTEM_KEYS.map((k) => `- ${k}: ${HOUSE_SYSTEMS[k].label}`).join("\n");
  return `You classify household documents (invoices, receipts, manuals, warranties, permits, insurance, contractor docs) for a home filing system.

Categories:
${cats}

House systems/areas:
${systems}

Rules:
- A phone-scanned file may contain SEVERAL distinct documents (e.g. a stack of receipts scanned as one PDF). Detect this and return one entry per distinct document with its page range. A multi-page invoice or manual is ONE document.
- Images (JPG/PNG) are always exactly one document; use null page ranges.
- doc_date is the date printed on the document, never today's date. Use null if truly not extractable.
- Distinguish invoice_paid vs invoice_open: look for "PAID" stamps, zero balance, payment confirmations vs "amount due", due dates, open balances. When unsure about payment status of an invoice, use invoice_open (it gets surfaced for action).
- Use "uncategorized" only when nothing fits; it's a flagged fallback, not a dumping ground.
- Prefer the fixed taxonomy over proposing new subfolders; proposed_subfolder should almost always be null.
- Vendor: the company that issued the document, cleaned (no "LLC", no ALL-CAPS yelling).
- from_previous_owner: only true with explicit textual evidence (e.g. the doc names a prior homeowner, is addressed to a different resident, or is described as left behind at closing). Do not infer it just because a manual looks old.
- equipment_label: only for category=manual — a short "model + equipment type" string like "AQR-15 Chlorinator" used to build a simple filename ("Hayward AQR-15 Chlorinator Manual.pdf"), not a full sentence.
- confidence reflects the whole classification (category + vendor + date), not just category.`;
}

/** Classify a PDF or image; returns one entry per distinct document found. */
export async function classifyFile(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractedDoc[]> {
  const data = buffer.toString("base64");
  const fileBlock =
    mimeType === "application/pdf"
      ? ({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data },
        } as const)
      : ({
          type: "image",
          source: {
            type: "base64",
            media_type: mimeType as "image/jpeg" | "image/png",
            data,
          },
        } as const);

  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: systemPrompt(),
    messages: [
      {
        role: "user",
        content: [
          fileBlock,
          {
            type: "text",
            text: "Read this file and classify the document(s) in it.",
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(ClassificationSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed || parsed.documents.length === 0) {
    throw new Error("Classification returned no documents");
  }
  return parsed.documents;
}

const AnswerSchema = z.object({
  answer: z
    .string()
    .describe("The answer, grounded ONLY in the provided documents; plain prose"),
  answerable: z
    .boolean()
    .describe("False if the provided documents do not contain the answer"),
  used_document_ids: z
    .array(z.string())
    .describe("IDs of the documents the answer is based on (empty if not answerable)"),
});

export type CabinetAnswer = z.infer<typeof AnswerSchema>;

/** "Ask the Cabinet": answer strictly from retrieved documents. */
export async function askCabinet(
  question: string,
  docs: {
    id: string;
    filename: string | null;
    vendor: string | null;
    category: string | null;
    house_system: string | null;
    doc_date: string | null;
    amount: number | null;
    description: string | null;
    warranty_expiration: string | null;
    raw_extracted_text: string | null;
  }[]
): Promise<CabinetAnswer> {
  const docBlocks = docs
    .map(
      (d) => `<document id="${d.id}">
filename: ${d.filename ?? "(pending)"}
vendor: ${d.vendor ?? "unknown"}
category: ${d.category ?? "unknown"} | system: ${d.house_system ?? "unknown"}
date: ${d.doc_date ?? "unknown"} | amount: ${d.amount ?? "n/a"} | warranty expires: ${d.warranty_expiration ?? "n/a"}
description: ${d.description ?? ""}
text:
${(d.raw_extracted_text ?? "").slice(0, 12000)}
</document>`
    )
    .join("\n\n");

  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: `You answer questions about a household's filed documents. You may use ONLY the documents provided in the user message — no outside knowledge, no guessing, no filling gaps. If the documents don't contain the answer, set answerable to false and say plainly that no filed document answers this. Cite which documents you used via used_document_ids. Keep answers short and concrete (dates, model numbers, amounts).`,
    messages: [
      {
        role: "user",
        content: `Documents:\n\n${docBlocks}\n\nQuestion: ${question}`,
      },
    ],
    output_config: { format: zodOutputFormat(AnswerSchema) },
  });

  if (!response.parsed_output) throw new Error("No parsed answer");
  return response.parsed_output;
}
