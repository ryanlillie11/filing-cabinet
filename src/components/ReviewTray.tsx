"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, HOUSE_SYSTEMS } from "@/lib/taxonomy";
import { money, shortDate } from "@/lib/format";
import type { DocumentRow } from "@/lib/types";
import DocEditForm, { patchFromDoc, patchToBody } from "./DocEditForm";

// The inbox: a stack of index cards to flip through and confirm.
// Keyboard: ←/→ navigate · Enter file it · E edit · D discard.
export default function ReviewTray({ initial }: { initial: DocumentRow[] }) {
  const router = useRouter();
  const [docs, setDocs] = useState<DocumentRow[]>(initial);
  const [idx, setIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justFiled, setJustFiled] = useState<string | null>(null);

  // Reset local state when the server refresh hands us a new list
  // (the React-sanctioned "adjust state when a prop changes" pattern).
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setDocs(initial);
  }
  const doc = docs[Math.min(idx, docs.length - 1)];

  const removeCurrent = useCallback(() => {
    setDocs((d) => d.filter((x) => x.id !== doc?.id));
    setIdx((i) => Math.max(0, Math.min(i, docs.length - 2)));
    setEditing(false);
  }, [doc?.id, docs.length]);

  const fileIt = useCallback(async () => {
    if (!doc || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/file`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "filing failed");
      setJustFiled(data.document.filename);
      setTimeout(() => setJustFiled(null), 1400);
      removeCurrent();
      router.refresh();
    } catch (err) {
      alert(String(err));
    } finally {
      setBusy(false);
    }
  }, [doc, busy, removeCurrent, router]);

  const discard = useCallback(async () => {
    if (!doc || busy) return;
    if (!confirm("Discard this document? (It won't be filed to Drive.)")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "discard failed");
      removeCurrent();
      router.refresh();
    } catch (err) {
      alert(String(err));
    } finally {
      setBusy(false);
    }
  }, [doc, busy, removeCurrent, router]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editing || busy) return;
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx((i) => Math.min(docs.length - 1, i + 1));
      if (e.key === "Enter") fileIt();
      if (e.key.toLowerCase() === "e") setEditing(true);
      if (e.key.toLowerCase() === "d") discard();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editing, busy, docs.length, fileIt, discard]);

  if (docs.length === 0) {
    return (
      <div className="p-6 text-center">
        {justFiled && (
          <div className="stamp stamp-animate text-stamp text-2xl mb-3">FILED</div>
        )}
        <p className="mono text-sm text-faded">
          Inbox tray is empty. Nothing needs your rubber stamp.
        </p>
      </div>
    );
  }

  const saveEdit = async (patch: ReturnType<typeof patchFromDoc>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchToBody(patch)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save failed");
      setDocs((d) => d.map((x) => (x.id === doc.id ? { ...x, ...data.document } : x)));
      setEditing(false);
    } catch (err) {
      alert(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      {justFiled && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <span className="stamp stamp-animate text-stamp text-4xl bg-card/90 px-4">FILED</span>
        </div>
      )}

      {/* card stack effect */}
      <div className="relative">
        {docs.length > 1 && (
          <div className="index-card absolute inset-0 translate-x-1.5 translate-y-1.5 opacity-60" />
        )}
        {docs.length > 2 && (
          <div className="index-card absolute inset-0 translate-x-3 translate-y-3 opacity-30" />
        )}
        <div className="index-card relative p-4">
          <div className="index-card-rule pb-2 mb-3 flex items-baseline justify-between gap-2">
            <div className="typewriter text-lg leading-tight">
              {doc.vendor || doc.original_filename || "Unknown document"}
            </div>
            <div className="mono text-[10px] text-faded whitespace-nowrap">
              {idx + 1} / {docs.length} in tray
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-2 mono text-[11px]">
            <span className="border border-ink px-1.5 py-0.5 bg-manila">
              {doc.category ? CATEGORIES[doc.category].label : "?"}
            </span>
            <span className="border border-ink px-1.5 py-0.5">
              {doc.house_system ? HOUSE_SYSTEMS[doc.house_system].label : "?"}
            </span>
            <span className="border border-ink px-1.5 py-0.5">
              {shortDate(doc.doc_date)}
              {doc.date_source === "upload" && " (upload date)"}
            </span>
            {doc.amount != null && (
              <span className="border border-ink px-1.5 py-0.5">{money(doc.amount)}</span>
            )}
            {doc.invoice_open && (
              <span className="stamp text-stamp text-[10px]">UNPAID</span>
            )}
            {doc.low_confidence && (
              <span className="stamp text-tab text-[10px]">LOW CONFIDENCE</span>
            )}
            {doc.possible_duplicate_of && (
              <span className="stamp text-tab text-[10px]">POSSIBLE DUPE</span>
            )}
            {doc.source === "email" && (
              <span className="border border-dashed border-faded px-1.5 py-0.5 text-faded">
                ✉ via email
              </span>
            )}
          </div>

          {editing ? (
            <DocEditForm
              initial={patchFromDoc(doc)}
              onSave={saveEdit}
              onCancel={() => setEditing(false)}
              saving={busy}
            />
          ) : (
            <>
              <p className="text-sm mb-1">{doc.description || "(no description)"}</p>
              <p className="mono text-[11px] text-faded mb-3">
                {doc.original_filename}
                {doc.ai_confidence != null &&
                  ` · confidence ${(doc.ai_confidence * 100).toFixed(0)}%`}
                {doc.possible_duplicate_of &&
                  " · looks like a document you already have — D to discard"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn btn-stamp" disabled={busy} onClick={fileIt}>
                  {busy ? "Filing…" : "✓ File it (↵)"}
                </button>
                <button className="btn" disabled={busy} onClick={() => setEditing(true)}>
                  Edit (E)
                </button>
                <button className="btn" disabled={busy} onClick={discard}>
                  Discard (D)
                </button>
                <span className="mono text-[10px] text-faded ml-auto">← → to flip</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
