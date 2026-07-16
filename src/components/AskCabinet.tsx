"use client";

import { useRef, useState } from "react";

interface Turn {
  role: "you" | "cabinet";
  text: string;
  sources?: { id: string; filename: string | null; drive_link: string | null }[];
}

// "Ask the Cabinet" — a document-lookup tool wearing a chat UI. Answers are
// grounded only in indexed docs; the server skips the model entirely when
// retrieval finds nothing.
export default function AskCabinet() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const ask = async () => {
    const question = q.trim();
    if (!question || busy) return;
    setQ("");
    setTurns((t) => [...t, { role: "you", text: question }]);
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setTurns((t) => [
        ...t,
        res.ok
          ? { role: "cabinet", text: data.answer, sources: data.sources }
          : { role: "cabinet", text: `Something jammed: ${data.error}` },
      ]);
    } catch (err) {
      setTurns((t) => [...t, { role: "cabinet", text: `Something jammed: ${String(err)}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  return (
    <div className="index-card p-3 flex flex-col">
      <div className="index-card-rule pb-1 mb-2">
        <span className="typewriter text-base">ASK THE CABINET</span>
        <span className="mono text-[10px] text-faded ml-2">
          answers come from filed documents only
        </span>
      </div>

      <div className="flex-1 overflow-y-auto max-h-64 space-y-2 mb-2">
        {turns.length === 0 && (
          <p className="mono text-xs text-faded">
            e.g. &ldquo;when did we last pay PoolCorp&rdquo; · &ldquo;what&rsquo;s the model
            number on the water heater&rdquo;
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className="mono text-xs">
            <span className={t.role === "you" ? "text-ledger font-bold" : "text-stamp font-bold"}>
              {t.role === "you" ? "YOU: " : "CABINET: "}
            </span>
            <span className="whitespace-pre-wrap">{t.text}</span>
            {t.sources && t.sources.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {t.sources.map((s) =>
                  s.drive_link ? (
                    <a
                      key={s.id}
                      href={s.drive_link}
                      target="_blank"
                      rel="noreferrer"
                      className="border border-ink px-1.5 py-0.5 bg-manila text-[10px] underline decoration-dotted"
                    >
                      📎 {s.filename}
                    </a>
                  ) : (
                    <span
                      key={s.id}
                      className="border border-ink px-1.5 py-0.5 bg-manila text-[10px]"
                    >
                      📎 {s.filename}
                    </span>
                  )
                )}
              </div>
            )}
          </div>
        ))}
        {busy && <p className="mono text-xs animate-pulse">rifling through the drawers…</p>}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1"
          value={q}
          placeholder="ask about your documents…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
        />
        <button className="btn btn-ledger" onClick={ask} disabled={busy}>
          Ask
        </button>
      </div>
    </div>
  );
}
