import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fileDocument } from "@/lib/ingest";

export const maxDuration = 120;

// POST: confirm a reviewed document — files it to Drive and indexes it.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const doc = await fileDocument(id);
    return NextResponse.json({ document: doc });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
