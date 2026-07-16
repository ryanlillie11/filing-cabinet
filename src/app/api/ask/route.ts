import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { askCabinet } from "@/lib/claude";
import { supabase } from "@/lib/supabase";

export const maxDuration = 120;

const NO_MATCH = "I don't have a document that answers that.";

// POST { question } → grounded answer + source documents.
// Retrieval is the same Postgres FTS the search bar uses; zero hits = no
// model call at all.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { question } = await req.json();
  if (!question?.trim()) return NextResponse.json({ error: "empty question" }, { status: 400 });

  const db = supabase();
  const fields =
    "id,filename,original_filename,vendor,category,house_system,doc_date,amount,description,warranty_expiration,raw_extracted_text,drive_link";

  const { data: matches, error } = await db
    .from("documents")
    .select(fields)
    .not("status", "in", '("split","discarded")')
    .textSearch("fts", question, { type: "websearch", config: "english" })
    .limit(5);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let docs = matches ?? [];
  if (docs.length === 0) {
    // Fallback pass: plain-english questions often websearch-match nothing
    // ("how old is my AC unit"); retry with OR'd keywords.
    const keywords = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w: string) => w.length > 3)
      .slice(0, 8)
      .join(" or ");
    if (keywords) {
      const { data: loose } = await db
        .from("documents")
        .select(fields)
        .not("status", "in", '("split","discarded")')
        .textSearch("fts", keywords, { type: "websearch", config: "english" })
        .limit(5);
      docs = loose ?? [];
    }
  }

  if (docs.length === 0) {
    return NextResponse.json({ answer: NO_MATCH, answerable: false, sources: [] });
  }

  const result = await askCabinet(question, docs);
  const sources = docs
    .filter((d) => result.used_document_ids.includes(d.id))
    .map((d) => ({
      id: d.id,
      filename: d.filename ?? d.original_filename,
      drive_link: d.drive_link,
    }));

  return NextResponse.json({
    answer: result.answerable ? result.answer : NO_MATCH,
    answerable: result.answerable,
    sources: result.answerable ? sources : [],
  });
}
