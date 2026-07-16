"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_KEYS, HOUSE_SYSTEMS, HOUSE_SYSTEM_KEYS } from "@/lib/taxonomy";
import type { DocumentRow } from "@/lib/types";

export interface DocPatch {
  category: string;
  house_system: string;
  vendor: string;
  doc_date: string;
  amount: string;
  invoice_open: boolean;
  warranty_expiration: string;
  description: string;
  from_previous_owner: boolean;
  equipment_label: string;
}

export function patchFromDoc(doc: DocumentRow): DocPatch {
  return {
    category: doc.category ?? "uncategorized",
    house_system: doc.house_system ?? "general",
    vendor: doc.vendor ?? "",
    doc_date: doc.doc_date ?? "",
    amount: doc.amount != null ? String(doc.amount) : "",
    invoice_open: doc.invoice_open,
    warranty_expiration: doc.warranty_expiration ?? "",
    description: doc.description ?? "",
    from_previous_owner: doc.from_previous_owner,
    equipment_label: doc.equipment_label ?? "",
  };
}

export function patchToBody(p: DocPatch) {
  return {
    category: p.category,
    house_system: p.house_system,
    vendor: p.vendor,
    doc_date: p.doc_date || null,
    amount: p.amount === "" ? null : Number(p.amount),
    invoice_open: p.invoice_open,
    warranty_expiration: p.warranty_expiration || null,
    description: p.description,
    from_previous_owner: p.from_previous_owner,
    equipment_label: p.equipment_label || null,
  };
}

export default function DocEditForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: DocPatch;
  onSave: (patch: DocPatch) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [p, setP] = useState<DocPatch>(initial);
  const set = <K extends keyof DocPatch>(k: K, v: DocPatch[K]) => setP({ ...p, [k]: v });

  return (
    <div className="mono text-xs space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="uppercase text-faded">Category</span>
          <select value={p.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORY_KEYS.map((k) => (
              <option key={k} value={k}>
                {CATEGORIES[k].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="uppercase text-faded">System / Area</span>
          <select value={p.house_system} onChange={(e) => set("house_system", e.target.value)}>
            {HOUSE_SYSTEM_KEYS.map((k) => (
              <option key={k} value={k}>
                {HOUSE_SYSTEMS[k].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="uppercase text-faded">Vendor</span>
          <input value={p.vendor} onChange={(e) => set("vendor", e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="uppercase text-faded">Doc date</span>
          <input
            type="date"
            value={p.doc_date}
            onChange={(e) => set("doc_date", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="uppercase text-faded">Amount ($)</span>
          <input
            type="number"
            step="0.01"
            value={p.amount}
            onChange={(e) => set("amount", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="uppercase text-faded">Warranty expires</span>
          <input
            type="date"
            value={p.warranty_expiration}
            onChange={(e) => set("warranty_expiration", e.target.value)}
          />
        </label>
      </div>
      {p.category === "manual" && (
        <label className="flex flex-col gap-1">
          <span className="uppercase text-faded">Equipment / model (for manual filename)</span>
          <input
            placeholder='e.g. "AQR-15 Chlorinator"'
            value={p.equipment_label}
            onChange={(e) => set("equipment_label", e.target.value)}
          />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="uppercase text-faded">Description</span>
        <textarea
          rows={2}
          value={p.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={p.invoice_open}
          onChange={(e) => set("invoice_open", e.target.checked)}
        />
        <span className="uppercase">Unpaid / open invoice</span>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={p.from_previous_owner}
          onChange={(e) => set("from_previous_owner", e.target.checked)}
        />
        <span className="uppercase">From previous owner (files to Historical)</span>
      </label>
      <div className="flex gap-2 pt-1">
        <button className="btn btn-ledger" disabled={saving} onClick={() => onSave(p)}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button className="btn" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
