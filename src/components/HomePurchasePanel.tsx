"use client";

import { useState } from "react";
import { CATEGORIES, HOME_PURCHASE_CATEGORIES, type CategoryKey } from "@/lib/taxonomy";
import type { DocumentRow } from "@/lib/types";
import DocList from "./DocList";

// A single pull-open panel for closing paperwork, mortgage/bank documents,
// and the home inspection report(s) — everything that lives in the
// "Home Purchase & Mortgage" Drive folder, grouped by category.
export default function HomePurchasePanel({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(false);

  const pull = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/documents?category=${HOME_PURCHASE_CATEGORIES.join(",")}&limit=100`
      );
      const data = await res.json();
      setDocs(data.documents ?? []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={pull}
        className={`folder-panel w-full px-3 py-2 text-left transition-transform ${
          open ? "translate-y-1 bg-manila-dark" : "hover:-translate-y-0.5"
        }`}
      >
        <div className="typewriter text-sm leading-tight">Home Purchase &amp; Mortgage</div>
        <div className="mono text-[10px] text-faded">
          {count} doc{count === 1 ? "" : "s"}
          <span className="float-right">▾</span>
        </div>
      </button>

      {open && (
        <div className="folder-panel mt-2 p-3">
          {loading ? (
            <p className="mono text-xs animate-pulse">pulling drawer…</p>
          ) : docs.length === 0 ? (
            <p className="mono text-xs text-faded">
              Empty drawer. Closing docs, mortgage/bank paperwork, and the home inspection
              report will show up here once filed.
            </p>
          ) : (
            <div className="space-y-4">
              {HOME_PURCHASE_CATEGORIES.map((cat) => {
                const inCategory = docs.filter((d) => d.category === cat);
                if (inCategory.length === 0) return null;
                return (
                  <div key={cat}>
                    <div className="mono text-[10px] uppercase text-faded border-b border-dashed border-faded pb-0.5 mb-1">
                      {CATEGORIES[cat as CategoryKey].label}
                    </div>
                    <DocList docs={inCategory} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
