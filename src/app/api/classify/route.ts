import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { classifyDocument } from "@/lib/ingest";
import { supabase } from "@/lib/supabase";
import type { DocumentRow } from "@/lib/types";

// Claude reads the whole file; give it room.
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const { data, error } = await supabase().from("documents").select().eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });
  const row = data as DocumentRow;
  if (row.status !== "processing") {
    return NextResponse.json({ documents: [row] });
  }

  try {
    const results = await classifyDocument(row);
    return NextResponse.json({ documents: results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
