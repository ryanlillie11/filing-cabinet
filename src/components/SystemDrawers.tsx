"use client";

import { useState } from "react";
import { HOUSE_SYSTEMS, HOUSE_SYSTEM_KEYS, CATEGORIES } from "@/lib/taxonomy";
import { shortDate } from "@/lib/format";
import type { DocumentRow } from "@/lib/types";

function DocList({ docs }: { docs: DocumentRow[] }) {
  return (
    <ul className="mono text-xs space-y-1">
      {docs.map((d) => (
        <li key={d.id} className="flex items-baseline gap-2">
          <span className="text-faded whitespace-nowrap">{shortDate(d.doc_date)}</span>
          {d.drive_link ? (
            <a
              href={d.drive_link}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted truncate"
            >
              {d.filename ?? d.original_filename}
            </a>
          ) : (
            <span className="truncate">{d.filename ?? d.original_filename}</span>
          )}
          <span className="text-faded truncate hidden sm:inline">
            {d.category ? CATEGORIES[d.category].label : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

// The cabinet itself: one drawer per house system. Pull a drawer open to
// browse everything filed under it, split into Manuals, Historical
// (from the previous owner), and everything else — mirroring the Drive
// folder structure (.../<System>/Manuals, .../<System>/Historical...).
export default function SystemDrawers({ counts }: { counts: Record<string, number> }) {
  const [open, setOpen] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(false);

  const pull = async (system: string) => {
    if (open === system) {
      setOpen(null);
      return;
    }
    setOpen(system);
    setLoading(true);
    try {
      const res = await fetch(`/api/documents?system=${system}&limit=100`);
      const data = await res.json();
      setDocs(data.documents ?? []);
    } finally {
      setLoading(false);
    }
  };

  const historical = docs.filter((d) => d.from_previous_owner);
  const manuals = docs.filter((d) => !d.from_previous_owner && d.category === "manual");
  const everythingElse = docs.filter((d) => !d.from_previous_owner && d.category !== "manual");

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {HOUSE_SYSTEM_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => pull(key)}
            className={`folder-panel px-3 py-2 text-left transition-transform ${
              open === key ? "translate-y-1 bg-manila-dark" : "hover:-translate-y-0.5"
            }`}
          >
            <div className="typewriter text-sm leading-tight">
              {HOUSE_SYSTEMS[key].label}
            </div>
            <div className="mono text-[10px] text-faded">
              {counts[key] ?? 0} doc{(counts[key] ?? 0) === 1 ? "" : "s"}
              <span className="float-right">▾</span>
            </div>
          </button>
        ))}
      </div>

      {open && (
        <div className="folder-panel mt-2 p-3">
          <div className="typewriter text-sm mb-2">
            Drawer: {HOUSE_SYSTEMS[open as keyof typeof HOUSE_SYSTEMS].label}
          </div>
          {loading ? (
            <p className="mono text-xs animate-pulse">pulling drawer…</p>
          ) : docs.length === 0 ? (
            <p className="mono text-xs text-faded">Empty drawer.</p>
          ) : (
            <div className="space-y-4">
              {everythingElse.length > 0 && <DocList docs={everythingElse} />}

              {manuals.length > 0 && (
                <div>
                  <div className="mono text-[10px] uppercase text-faded border-b border-dashed border-faded pb-0.5 mb-1">
                    Manuals
                  </div>
                  <DocList docs={manuals} />
                </div>
              )}

              {historical.length > 0 && (
                <div>
                  <div className="mono text-[10px] uppercase text-ledger border-b border-dashed border-ledger pb-0.5 mb-1">
                    Historical — from the previous owner
                  </div>
                  <DocList docs={historical} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
