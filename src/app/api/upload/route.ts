import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ACCEPTED_MIME_TYPES, ingestFile } from "@/lib/ingest";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "no files" }, { status: 400 });
  }

  const created: string[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      rejected.push(file.name);
      continue;
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const row = await ingestFile({
      buffer,
      mimeType: file.type,
      filename: file.name,
      source: "upload",
    });
    created.push(row.id);
  }
  return NextResponse.json({ created, rejected });
}
