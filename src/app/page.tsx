import { auth, signOut } from "@/auth";
import { supabase } from "@/lib/supabase";
import { money, shortDate, daysUntil } from "@/lib/format";
import type { DocumentRow } from "@/lib/types";
import UploadTray from "@/components/UploadTray";
import ReviewTray from "@/components/ReviewTray";
import SearchPanel from "@/components/SearchPanel";
import SystemDrawers from "@/components/SystemDrawers";
import AskCabinet from "@/components/AskCabinet";

export const dynamic = "force-dynamic";

async function loadDashboard() {
  const db = supabase();
  const today = new Date().toISOString().slice(0, 10);
  const in90 = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);

  const [pending, recentlyFiled, warranties, openInvoices, needsAttention, allSystems] =
    await Promise.all([
      db
        .from("documents")
        .select()
        .eq("status", "pending_review")
        .order("created_at", { ascending: true })
        .limit(50),
      db
        .from("documents")
        .select("id,filename,description,drive_link,drive_folder_path,doc_date,created_at")
        .eq("status", "filed")
        .order("updated_at", { ascending: false })
        .limit(8),
      db
        .from("documents")
        .select("id,vendor,description,warranty_expiration,drive_link,filename")
        .eq("status", "filed")
        .gte("warranty_expiration", today)
        .lte("warranty_expiration", in90)
        .order("warranty_expiration", { ascending: true })
        .limit(10),
      db
        .from("documents")
        .select("id,vendor,description,amount,doc_date,drive_link,filename,status")
        .eq("invoice_open", true)
        .not("status", "in", '("split","discarded")')
        .order("doc_date", { ascending: true })
        .limit(20),
      db
        .from("documents")
        .select("id,vendor,original_filename,description,status,low_confidence,category")
        .not("status", "in", '("split","discarded","filed")')
        .or("status.eq.needs_attention,low_confidence.eq.true,category.eq.uncategorized")
        .limit(10),
      db
        .from("documents")
        .select("house_system")
        .not("status", "in", '("split","discarded")'),
    ]);

  const counts: Record<string, number> = {};
  for (const r of allSystems.data ?? []) {
    if (r.house_system) counts[r.house_system] = (counts[r.house_system] ?? 0) + 1;
  }

  return {
    pending: (pending.data ?? []) as DocumentRow[],
    recentlyFiled: recentlyFiled.data ?? [],
    warranties: warranties.data ?? [],
    openInvoices: openInvoices.data ?? [],
    needsAttention: needsAttention.data ?? [],
    counts,
  };
}

export default async function Dashboard() {
  const session = await auth();
  const data = await loadDashboard();
  const openTotal = data.openInvoices.reduce((s, d) => s + (d.amount ?? 0), 0);
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6 w-full">
      {/* header */}
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6 border-b-2 border-ink pb-3">
        <div>
          <h1 className="typewriter text-3xl sm:text-4xl tracking-wide">THE FILING CABINET</h1>
          <p className="mono text-xs text-faded">
            house document ingestion &amp; index · {session?.user?.email}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="stamp text-ledger text-xs">RECEIVED {today}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="btn" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* left column: intake + review */}
        <section className="lg:col-span-3 space-y-4">
          <UploadTray />

          <div>
            <h2 className="typewriter text-xl mb-2">
              IN TRAY{" "}
              <span className="mono text-xs text-faded">
                {data.pending.length > 0 && `— ${data.pending.length} awaiting review`}
              </span>
            </h2>
            <ReviewTray initial={data.pending} />
          </div>

          {/* needs attention */}
          {data.needsAttention.length > 0 && (
            <div className="border-2 border-stamp p-3 bg-card">
              <h3 className="typewriter text-base text-stamp mb-1">⚠ NEEDS A HOME</h3>
              <ul className="mono text-xs space-y-1">
                {data.needsAttention.map((d) => (
                  <li key={d.id}>
                    {d.vendor ?? d.original_filename ?? d.id.slice(0, 8)} —{" "}
                    {d.status === "needs_attention"
                      ? "classification failed; re-upload or edit manually"
                      : d.category === "uncategorized"
                        ? "uncategorized"
                        : "low-confidence read"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* recently filed: receipt tape */}
          <div>
            <h2 className="typewriter text-xl mb-2">RECENTLY FILED</h2>
            {data.recentlyFiled.length === 0 ? (
              <p className="mono text-xs text-faded">Nothing filed yet.</p>
            ) : (
              <div className="max-w-md">
                <div className="receipt-tape px-4 py-2 text-xs">
                  <div className="text-center text-faded mb-1">— — — — — — — — — —</div>
                  {data.recentlyFiled.map((d) => (
                    <div key={d.id} className="py-1 border-b border-dotted border-faded/50">
                      <a
                        href={d.drive_link ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold underline decoration-dotted"
                      >
                        {d.filename}
                      </a>
                      <div className="text-faded truncate">
                        {shortDate(d.doc_date)} · {d.drive_folder_path}
                      </div>
                    </div>
                  ))}
                  <div className="text-center text-faded mt-1 mb-1">* THANK YOU *</div>
                </div>
                <div className="receipt-edge" />
              </div>
            )}
          </div>
        </section>

        {/* right column: search, chat, warranties, ledger */}
        <section className="lg:col-span-2 space-y-4">
          <SearchPanel />
          <AskCabinet />

          {/* warranties expiring */}
          <div className="index-card p-3">
            <div className="index-card-rule pb-1 mb-2 flex items-baseline justify-between">
              <span className="typewriter text-base">WARRANTIES — DUE SOON</span>
              <span className="stamp text-stamp text-[10px]">TICK TOCK</span>
            </div>
            {data.warranties.length === 0 ? (
              <p className="mono text-xs text-faded">Nothing expiring in the next 90 days.</p>
            ) : (
              <ul className="mono text-xs space-y-1">
                {data.warranties.map((w) => {
                  const days = daysUntil(w.warranty_expiration!);
                  return (
                    <li key={w.id} className="flex items-baseline gap-2">
                      <span
                        className={`font-bold whitespace-nowrap ${days <= 14 ? "text-stamp" : ""}`}
                      >
                        {days}d
                      </span>
                      {w.drive_link ? (
                        <a
                          href={w.drive_link}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-dotted truncate"
                        >
                          {w.vendor ?? w.filename} — {w.description}
                        </a>
                      ) : (
                        <span className="truncate">
                          {w.vendor ?? w.filename} — {w.description}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* open invoices ledger */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="typewriter text-base">OPEN INVOICES — THE LEDGER</h2>
              <span className="mono text-xs font-bold">{money(openTotal)}</span>
            </div>
            {data.openInvoices.length === 0 ? (
              <p className="mono text-xs text-faded">Ledger clear. Nobody&rsquo;s owed a dime.</p>
            ) : (
              <table className="ledger w-full text-xs">
                <tbody>
                  {data.openInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-2 py-1 whitespace-nowrap text-faded">
                        {shortDate(inv.doc_date)}
                      </td>
                      <td className="px-2 py-1 truncate max-w-40">
                        {inv.drive_link ? (
                          <a
                            href={inv.drive_link}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-dotted"
                          >
                            {inv.vendor}
                          </a>
                        ) : (
                          inv.vendor
                        )}
                        {inv.status !== "filed" && <span className="text-faded"> (in tray)</span>}
                      </td>
                      <td className="px-2 py-1 text-right font-bold text-ledger whitespace-nowrap">
                        {money(inv.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* the cabinet drawers */}
      <section className="mt-8">
        <h2 className="typewriter text-xl mb-2">THE DRAWERS — BY HOUSE SYSTEM</h2>
        <SystemDrawers counts={data.counts} />
      </section>

      <footer className="mt-10 pt-3 border-t border-dashed border-faded">
        <p className="mono text-[10px] text-faded text-center">
          {Object.values(data.counts).reduce((a, b) => a + b, 0)} documents on file · est. 2026 ·
          no purple gradients were used in this filing system
        </p>
      </footer>
    </main>
  );
}
