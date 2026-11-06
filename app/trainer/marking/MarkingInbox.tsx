"use client";

import Link from "next/link";
import { useState } from "react";
import { BookIcon, ClipboardIcon, FileIcon, SearchIcon } from "../../dashboard/_components/icons";
import LocalTime from "../../dashboard/assessment/_components/LocalTime";
import { statusLabel, statusStyle, type SubmissionStatus } from "@/lib/submission-meta";

export type InboxRow = {
  id: string;
  studentId: string;
  studentName: string;
  courseCode: string;
  unitCode: string;
  unitTitle: string;
  part: string;
  partLabel: string;
  attempt: number;
  status: SubmissionStatus;
  submittedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  waitDays: number; // since handed in
  sinceDecidedDays: number; // since a status was given
};

type Tab = "toMark" | "sentBack" | "marked";

const TABS: { key: Tab; label: string; match: (s: SubmissionStatus) => boolean }[] = [
  { key: "toMark", label: "To mark", match: (s) => s === "Submitted" },
  { key: "sentBack", label: "Sent back", match: (s) => s === "Rejected" || s === "MoreDocs" },
  { key: "marked", label: "Marked", match: (s) => s === "Accepted" },
];


// Thumbnail tile per part (same as the dashboard)
const PART_TILE: Record<string, { tone: string; icon: typeof ClipboardIcon }> = {
  quiz: { tone: "bg-[#fdc580] text-[#1d1b33]", icon: ClipboardIcon },
  theory: { tone: "bg-plum text-white", icon: BookIcon },
  workplace: { tone: "bg-[#e8659a] text-white", icon: FileIcon },
};

const dayWord = (n: number) => (n === 1 ? "1 day" : `${n} days`);

// How long work has waited: the colour always comes with words
function waitTone(days: number) {
  if (days > 7) return { cls: "bg-rose-100 text-rose-800", text: `${dayWord(days)} · overdue` };
  if (days >= 3) return { cls: "bg-amber-100 text-amber-900", text: `Waiting ${dayWord(days)}` };
  return { cls: "bg-emerald-100 text-emerald-800", text: days === 0 ? "Came in today" : `Waiting ${dayWord(days)}` };
}

const chip = (on: boolean) =>
  `rounded-full px-4 py-2 text-sm font-semibold transition ${on ? "bg-plum text-white" : "bg-[#f6f5fa] text-ink hover:bg-plum/10"}`;

export default function MarkingInbox({
  rows,
  courses,
  canMark,
}: {
  rows: InboxRow[];
  courses: { code: string; name: string }[];
  canMark: boolean;
}) {
  const [tab, setTab] = useState<Tab>("toMark");
  const [part, setPart] = useState("all");
  // filter by module name — modules differ per unit, so the choices come from the work itself
  const modules = [{ key: "all", label: "All modules" }, ...[...new Set(rows.map((r) => r.partLabel))].sort().map((l) => ({ key: l, label: l }))];
  const [course, setCourse] = useState("all");
  const [query, setQuery] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const toMark = rows.filter((r) => r.status === "Submitted"); // already oldest first
  const overdue = toMark.filter((r) => r.waitDays > 7).length;
  const next = toMark[0];

  const q = query.trim().toLowerCase();
  const current = TABS.find((t) => t.key === tab)!;
  const shown = rows
    .filter((r) => current.match(r.status))
    .filter((r) => part === "all" || r.partLabel === part)
    .filter((r) => course === "all" || r.courseCode === course)
    .filter((r) => !overdueOnly || r.waitDays > 7)
    .filter((r) => !q || r.studentName.toLowerCase().includes(q) || r.studentId.toLowerCase().includes(q) || r.unitCode.toLowerCase().includes(q))
    .sort((a, b) =>
      tab === "marked"
        ? (b.decidedAt ?? "").localeCompare(a.decidedAt ?? "")
        : tab === "sentBack"
          ? (a.decidedAt ?? "").localeCompare(b.decidedAt ?? "")
          : 0,
    );
  const count = (t: (typeof TABS)[number]) => rows.filter((r) => t.match(r.status)).length;

  const pick = (t: Tab, overdueFilter = false) => {
    setTab(t);
    setOverdueOnly(overdueFilter);
  };

  return (
    <div className="space-y-8">
      {/* title, and a quick way to the oldest piece of work */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Marking</h1>
          <p className="mt-0.5 text-sm text-ink">
            {toMark.length
              ? `${toMark.length} to mark${overdue ? ` · ${overdue} waiting over 7 days` : ""} · oldest first`
              : "All caught up — nothing is waiting to be marked."}
          </p>
        </div>
        {next && (
          <Link
            href={`/trainer/marking/${next.id}`}
            className="inline-flex items-center gap-2 rounded-full bg-plum px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-plum-light"
          >
            <ClipboardIcon className="h-4 w-4" />
            Mark next
          </Link>
        )}
      </div>

      {!canMark && (
        <p className="rounded-2xl bg-amber-50 px-5 py-3 text-sm text-amber-900">
          Super Admin has turned off assessment marking for trainers, so you can view work but not mark it.
        </p>
      )}

      {/* the inbox */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Work" className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => pick(t.key)} className={chip(tab === t.key)}>
                {t.label} <span className="ml-1 opacity-90">({count(t)})</span>
              </button>
            ))}
          </div>
          <label className="flex w-full items-center gap-2 rounded-full bg-[#f6f5fa] px-4 py-2.5 ring-1 ring-ink/10 focus-within:ring-plum/40 sm:w-72">
            <SearchIcon className="h-4 w-4 shrink-0 text-ink" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search student, ID or unit"
              aria-label="Search student, ID or unit"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink/60"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {modules.map((p) => (
            <button key={p.key} type="button" onClick={() => setPart(p.key)} aria-pressed={part === p.key} className={chip(part === p.key)}>
              {p.label}
            </button>
          ))}
          {courses.length > 1 && (
            <select
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              aria-label="Course"
              className="rounded-full bg-[#f6f5fa] px-4 py-2 text-sm font-semibold text-ink outline-none ring-1 ring-ink/10"
            >
              <option value="all">All courses</option>
              {courses.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          )}
          {tab === "toMark" && overdue > 0 && (
            <button
              type="button"
              onClick={() => setOverdueOnly((v) => !v)}
              aria-pressed={overdueOnly}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${overdueOnly ? "bg-rose-600 text-white" : "bg-rose-100 text-rose-800 hover:bg-rose-200"}`}
            >
              Over 7 days ({overdue})
            </button>
          )}
        </div>

        {shown.length ? (
          <ul className="space-y-3">
            {shown.map((r) => {
              const tile = PART_TILE[r.part] ?? PART_TILE.theory;
              const wait = waitTone(r.waitDays);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-4 rounded-xl bg-[#f6f5fa] p-4 sm:flex-nowrap">
                  <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-lg ${tile.tone}`}>
                    <tile.icon className="h-7 w-7" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/trainer/marking/${r.id}`} className="font-semibold text-plum hover:underline">
                      {r.studentName} <span className="font-medium text-ink">({r.studentId})</span>
                    </Link>
                    <p className="mt-0.5 text-sm text-ink">
                      {r.unitCode} · {r.unitTitle}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {r.partLabel}
                      {r.attempt > 1 && ` · attempt ${r.attempt}`}
                      <span className="font-medium">
                        {tab === "toMark" && r.submittedAt && (
                          <>
                            {" "}
                            · submitted <LocalTime iso={r.submittedAt} />
                          </>
                        )}
                        {tab !== "toMark" && r.decidedAt && (
                          <>
                            {" "}
                            · {r.decidedBy ?? "Marked"} · <LocalTime iso={r.decidedAt} />
                          </>
                        )}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2.5">
                    {tab === "toMark" ? (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${wait.cls}`}>{wait.text}</span>
                    ) : (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[r.status]}`}>
                        {statusLabel[r.status]}
                        {tab === "sentBack" && ` · ${dayWord(r.sinceDecidedDays)} ago`}
                      </span>
                    )}
                    <Link
                      href={`/trainer/marking/${r.id}`}
                      className={`rounded-full px-5 py-2 text-xs font-semibold transition ${
                        tab === "toMark" ? "bg-plum text-white hover:bg-plum-light" : "bg-[#e4dcfb] text-plum hover:bg-plum hover:text-white"
                      }`}
                    >
                      {tab === "toMark" ? "Review" : "View"}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl bg-emerald-50 px-5 py-8 text-center text-sm font-semibold text-emerald-900">
            {rows.some((r) => current.match(r.status)) ? "Nothing matches these filters." : tab === "toMark" ? "All caught up — nothing to mark." : `Nothing ${current.label.toLowerCase()} yet.`}
          </p>
        )}
      </section>
    </div>
  );
}
