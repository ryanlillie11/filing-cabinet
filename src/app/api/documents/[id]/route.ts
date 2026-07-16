import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { logActivity, supabase } from "@/lib/supabase";
import { syncDriveAfterEdit } from "@/lib/ingest";
import { normalizeVendor } from "@/lib/naming";
import { CATEGORY_KEYS, HOUSE_SYSTEM_KEYS } from "@/lib/taxonomy";
import type { DocumentRow } from "@/lib/types";

export const maxDuration = 60;

const EDITABLE = [
  "category",
  "house_system",
  "vendor",
  "doc_date",
  "amount",
  "invoice_open",
  "warranty_expiration",
  "description",
  "proposed_subfolder",
] as const;

// PATCH: edit fields on any document (pending OR already filed).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();

  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (key in body) patch[key] = body[key] === "" ? null : body[key];
  }
  if (typeof patch.category === "string" && !CATEGORY_KEYS.includes(patch.category as never)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }
  if (
    typeof patch.house_system === "string" &&
    !HOUSE_SYSTEM_KEYS.includes(patch.house_system as never)
  ) {
    return NextResponse.json({ error: "invalid house_system" }, { status: 400 });
  }
  if (typeof patch.vendor === "string") {
    patch.vendor_normalized = normalizeVendor(patch.vendor);
  }
  if (patch.doc_date) patch.date_source = "document"; // user-supplied date is authoritative
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase()
    .from("documents")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity(id, "edited", { fields: Object.keys(patch) });

  // Filed docs: keep the Drive file's name/folder in sync with the edit.
  let doc = data as DocumentRow;
  if (doc.status === "filed") {
    try {
      doc = await syncDriveAfterEdit(doc);
    } catch (err) {
      return NextResponse.json(
        { document: doc, warning: `Saved, but Drive sync failed: ${String(err)}` },
        { status: 200 }
      );
    }
  }
  return NextResponse.json({ document: doc });
}

// DELETE: discard a pending document (e.g. confirmed duplicate).
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { data, error } = await supabase()
    .from("documents")
    .select("status,storage_path")
    .eq("id", id)
    .single();
  if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (data.status === "filed") {
    return NextResponse.json(
      { error: "refusing to discard a filed document — edit it instead" },
      { status: 400 }
    );
  }

  await supabase().from("documents").update({ status: "discarded" }).eq("id", id);
  if (data.storage_path) {
    await supabase().storage.from("staging").remove([data.storage_path]);
  }
  await logActivity(id, "discarded", {});
  return NextResponse.json({ ok: true });
}
