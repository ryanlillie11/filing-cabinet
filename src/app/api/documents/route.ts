import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

// GET /api/documents?q=&system=&status=&category=&limit=
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const system = url.searchParams.get("system");
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  let query = supabase()
    .from("documents")
    .select(
      "id,status,source,category,house_system,vendor,doc_date,date_source,amount,invoice_open,warranty_expiration,description,ai_confidence,low_confidence,filename,original_filename,drive_link,drive_folder_path,possible_duplicate_of,from_previous_owner,equipment_label,upload_date,created_at"
    )
    .not("status", "in", '("split","discarded")')
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q) query = query.textSearch("fts", q, { type: "websearch", config: "english" });
  if (system) query = query.eq("house_system", system);
  if (status) query = query.eq("status", status);
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data });
}
