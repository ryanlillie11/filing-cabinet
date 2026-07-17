import { CATEGORIES } from "@/lib/taxonomy";
import { shortDate } from "@/lib/format";
import type { DocumentRow } from "@/lib/types";

/** A compact filed-document list row: date, linked filename, category — shared by
 *  SystemDrawers and HomePurchasePanel. */
export default function DocList({ docs }: { docs: DocumentRow[] }) {
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
