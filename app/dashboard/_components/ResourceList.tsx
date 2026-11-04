"use client";

import FileActions from "./FileActions";
import { formatBytes } from "@/lib/submission-meta";
import type { Resource } from "@/lib/unit-meta";
import { BookIcon, FileIcon, TrashIcon } from "./icons";

const kindLabel = { file: "Document", link: "Web link", note: "Reading notes" } as const;

// Unit reading resources. Pass `onRemove` to show delete buttons (Super Admin).
export default function ResourceList({
  resources,
  onRemove,
  busyId,
}: {
  resources: Resource[];
  onRemove?: (r: Resource) => void;
  busyId?: string | null;
}) {
  if (!resources.length) {
    return (
      <div className="grid place-items-center rounded-[1.5rem] bg-lilac/70 px-6 py-10 text-center">
        <BookIcon className="h-8 w-8 text-plum/40" />
        <p className="mt-3 text-sm text-ink">No resources for this unit yet.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {resources.map((r, i) => (
        <li
          key={r.id}
          className={`rounded-[1.5rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] ${busyId === r.id ? "opacity-50" : ""}`}
        >
          <div className="flex items-start gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lilac text-plum">
              {r.kind === "file" ? <FileIcon className="h-5 w-5" /> : r.kind === "link" ? <span className="text-sm">↗</span> : <BookIcon className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink">
                {i + 1}. {kindLabel[r.kind]}
              </p>
              <h3 className="mt-0.5 font-medium text-ink">{r.title}</h3>
              {r.description && <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{r.description}</p>}

              {r.kind === "file" && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-sm text-ink">
                    {r.file.name} · {formatBytes(r.file.size)}
                  </span>
                  <FileActions file={r.file} title={r.title} size="sm" />
                </div>
              )}
              {r.kind === "link" && (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex max-w-full items-center gap-2 truncate rounded-full bg-plum px-4 py-2 text-xs font-medium text-white transition hover:bg-plum-light"
                >
                  Open link ↗
                </a>
              )}
              {r.kind === "note" && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-plum">Read notes</summary>
                  {/* Notes HTML is sanitised on the server (lib/sanitize.ts) */}
                  <div
                    className="rich-text mt-2 rounded-xl bg-lilac/50 px-4 py-3 text-sm leading-relaxed text-ink"
                    dangerouslySetInnerHTML={{ __html: r.body }}
                  />
                </details>
              )}
            </div>
            {onRemove && (
              <button
                onClick={() => onRemove(r)}
                disabled={busyId === r.id}
                aria-label={`Remove ${r.title}`}
                className="shrink-0 rounded-full p-2 text-ink transition hover:bg-rose-50 hover:text-rose-600"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
