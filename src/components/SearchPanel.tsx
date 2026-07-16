"use client";

import { useRef, useState } from "react";
import { CATEGORIES, HOUSE_SYSTEMS } from "@/lib/taxonomy";
import { money, shortDate } from "@/lib/format";
import type { DocumentRow } from "@/lib/types";
import DocEditForm, { patchFromDoc, patchToBody } from "./DocEditForm";

type Result = Pick<
  DocumentRow,
  | "id"
  | "status"
  | "category"
  | "house_system"
  | "vendor"
  | "doc_date"
  | "amount"
  | "invoice_open"
  | "warranty_expiration"
  | "description"
  | "filename"
  | "original_filename"
  | "drive_link"
  | "drive_folder_path"
> &
  DocumentRow;

// Card-catalog search over the index; results open into an editable card
// (works on already-filed docs — Drive gets renamed/moved to match).
export default function SearchPanel() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = async (query: string) => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: query.trim() });
      const res = await fetch(`/api/documents?${params}`);
      const data = await res.json();
      setResults(data.documents ?? []);
    } finally {
      setSearching(false);
    }
  };

  const onChange = (value: string) => {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(value), 350);
  };

  const saveEdit = async (id: string, patch: ReturnType<typeof patchFromDoc>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchToBody(patch)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save failed");
      if (data.warning) alert(data.warning);
      setResults((r) =>
        r ? r.map((x) => (x.id === id ? { ...x, ...data.document } : x)) : r
      );
      setEditingId(null);
    } catch (err) {
      alert(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="index-card p-3">
        <label className="mono text-[10px] uppercase text-faded block mb-1">
          Card catalog — search the index
        </label>
        <input
          className="w-full text-base"
          placeholder='try "pool heater warranty"'
          value={q}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>

      {searching && <p className="mono text-xs text-faded mt-2 animate-pulse">flipping cards…</p>}

      {results && !searching && (
        <div className="mt-2 space-y-2">
          {results.length === 0 && (
            <p className="mono text-xs text-faded">No cards match. Try fewer words.</p>
          )}
          {results.map((doc) => (
            <div key={doc.id} className="index-card p-3">
              <button
                className="w-full text-left"
                onClick={() => setOpenId(openId === doc.id ? null : doc.id)}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="mono text-sm font-bold truncate">
                    {doc.filename ?? doc.original_filename}
                  </span>
                  <span className="mono text-[10px] text-faded whitespace-nowrap">
                    {shortDate(doc.doc_date)}
                  </span>
                </div>
                <div className="text-xs truncate">{doc.description}</div>
              </button>

              {openId === doc.id && (
                <div className="mt-2 pt-2 border-t border-dashed border-faded">
                  {editingId === doc.id ? (
                    <DocEditForm
                      initial={patchFromDoc(doc)}
                      onSave={(p) => saveEdit(doc.id, p)}
                      onCancel={() => setEditingId(null)}
                      saving={saving}
                    />
                  ) : (
                    <div className="mono text-[11px] space-y-1">
                      <div>
                        {doc.category ? CATEGORIES[doc.category].label : "?"} ·{" "}
                        {doc.house_system ? HOUSE_SYSTEMS[doc.house_system].label : "?"}
                        {doc.amount != null && <> · {money(doc.amount)}</>}
                      </div>
                      {doc.drive_folder_path && (
                        <div className="text-faded">📁 {doc.drive_folder_path}</div>
                      )}
                      <div className="flex gap-2 pt-1">
                        {doc.drive_link && (
                          <a
                            className="btn"
                            href={doc.drive_link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open in Drive ↗
                          </a>
                        )}
                        <button className="btn" onClick={() => setEditingId(doc.id)}>
                          Fix details
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
