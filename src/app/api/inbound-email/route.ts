import { NextResponse } from "next/server";
import { classifyDocument, ingestFile } from "@/lib/ingest";
import { emailBodyToPdf } from "@/lib/emailpdf";
import { logActivity } from "@/lib/supabase";

// Postmark inbound webhook. Secured by a URL token (Postmark doesn't sign
// payloads) + a sender allowlist. Point Postmark's inbound webhook at:
//   https://<app>/api/inbound-email?token=<POSTMARK_WEBHOOK_TOKEN>
export const maxDuration = 300;

interface PostmarkAttachment {
  Name: string;
  Content: string; // base64
  ContentType: string;
  ContentLength: number;
}

interface PostmarkInbound {
  From: string;
  FromFull?: { Email: string };
  Subject: string;
  Date: string;
  TextBody?: string;
  HtmlBody?: string;
  Attachments?: PostmarkAttachment[];
}

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"];

function allowedSenders(): string[] {
  return (process.env.ALLOWED_SENDERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.POSTMARK_WEBHOOK_TOKEN || token !== process.env.POSTMARK_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const email = (await req.json()) as PostmarkInbound;
  const sender = (email.FromFull?.Email ?? email.From ?? "").toLowerCase().trim();

  // Sender allowlist: anything else is logged and dropped, never queued.
  if (!allowedSenders().includes(sender)) {
    await logActivity(null, "email_dropped", { sender, subject: email.Subject });
    // 200 so Postmark doesn't retry — the drop is intentional.
    return NextResponse.json({ ok: true, dropped: true });
  }

  const ingested: string[] = [];
  const attachments = (email.Attachments ?? []).filter((a) => ACCEPTED.includes(a.ContentType));

  if (attachments.length > 0) {
    for (const att of attachments) {
      const row = await ingestFile({
        buffer: Buffer.from(att.Content, "base64"),
        mimeType: att.ContentType,
        filename: att.Name,
        source: "email",
      });
      ingested.push(row.id);
    }
  } else {
    // Body-only email (e.g. an e-invoice with no attachment): capture the
    // body itself as a document.
    const body = email.TextBody?.trim() || email.HtmlBody?.replace(/<[^>]+>/g, " ").trim() || "";
    if (!body) return NextResponse.json({ ok: true, ingested: [] });
    const pdf = await emailBodyToPdf({
      from: email.From,
      subject: email.Subject,
      date: email.Date,
      body,
    });
    const row = await ingestFile({
      buffer: pdf,
      mimeType: "application/pdf",
      filename: `${(email.Subject || "email").replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 60)}.pdf`,
      source: "email",
    });
    ingested.push(row.id);
  }

  // Classify inline — webhook requests have no browser to kick off step 2.
  const results: string[] = [];
  for (const id of ingested) {
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data } = await supabase().from("documents").select().eq("id", id).single();
      if (data) {
        const docs = await classifyDocument(data);
        results.push(...docs.map((d) => d.id));
      }
    } catch {
      // classifyDocument already marked the row needs_attention + logged it;
      // keep processing remaining attachments.
    }
  }

  return NextResponse.json({ ok: true, ingested, classified: results });
}
