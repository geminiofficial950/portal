"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRightIcon, BackIcon, BookIcon, ChevronDownIcon, ClipboardIcon, ClockIcon, FileIcon, HomeIcon, LockIcon } from "../../_components/icons";
import FileActions from "../../_components/FileActions";
import LocalTime from "../_components/LocalTime";
import { logUnitViewAction } from "../actions";
import ModuleWork from "./ModuleWork";
import type { ExtensionRequestDTO } from "@/lib/deadline-meta";
import type { DeclarationText } from "@/lib/declaration";
import { isPastDue, type AssessmentPart, type StudentAssessment } from "@/lib/assessment-meta";
import type { Unit } from "@/lib/courses";
import { MODULE_KINDS, needsSubmission } from "@/lib/module-meta";
import { formatBytes, statusLabel, statusStyle, type SubmissionDTO, type SubmissionStatus } from "@/lib/submission-meta";
import type { FullUnitRecord } from "@/lib/unit-records";
import { unitStatusStyle } from "@/lib/unit-status-meta";
import { unitItemKeys } from "@/lib/unit-items";
import { RESOURCE_SLOTS, type Resource } from "@/lib/unit-meta";

type Subs = Partial<Record<AssessmentPart, SubmissionDTO>>;

const card = "rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] sm:p-6";

// A unit as the course sidebar lists it
export type OutlineUnit = {
  code: string;
  title: string;
  hasOverview: boolean;
  resources: { id: string; title: string; kind: Resource["kind"] }[];
  parts: { key: AssessmentPart; label: string; status: SubmissionStatus | "Not started"; marked: boolean }[]; // live modules in order
  unlocked: boolean; // open for this student; a locked unit is grey and can't be opened
  note?: string | null; // why it's closed, when known
};

// What can be opened in a unit: the overview, Resources, or a module ("part:<module id>")
type Item = { key: string; label: string; kind: "overview" | "resources" | "part"; status?: SubmissionStatus | "Not started"; marked?: boolean };

function itemsOf(u: { hasResources: boolean; parts: OutlineUnit["parts"] }): Item[] {
  return [
    { key: "overview", label: "Unit overview", kind: "overview" as const },
    ...unitItemKeys(u.hasResources, u.parts.map((p) => p.key)).map((key): Item => {
      if (key === "resources") return { key, label: "Resources", kind: "resources" };
      const p = u.parts.find((x) => `part:${x.key}` === key)!;
      return { key, label: p.label, kind: "part", status: p.status, marked: p.marked };
    }),
  ];
}

function ItemIcon({ kind, className = "h-4 w-4" }: { kind: Item["kind"]; className?: string }) {
  if (kind === "resources") return <FileIcon className={className} />;
  if (kind === "part") return <ClipboardIcon className={className} />;
  return <HomeIcon className={className} />;
}

const fmtDue = (iso: string) => new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function UnitWork({
  course,
  unit,
  units,
  percent,
  initialItem,
  assessment,
  initialSubmissions,
  dues,
  extensions,
  photoRequired,
  declaration,
  resources,
  unitStatus,
  locked = false,
  lockNote,
}: {
  course: { code: string; name: string };
  unit: Unit;
  units: OutlineUnit[];
  percent: number; // course progress: marked modules Satisfactory
  initialItem?: string;
  assessment: StudentAssessment; // live modules only, no reference answers
  initialSubmissions: Subs;
  dues: Record<string, string | null>; // each module's deadline for this student
  extensions: ExtensionRequestDTO[]; // their extension requests in this unit
  photoRequired: boolean;
  declaration: DeclarationText;
  resources: Resource[];
  unitStatus: FullUnitRecord | null; // a non-active unit status (with unit feedback) — the unit is then closed
  locked?: boolean; // the unit isn't open for the student: only the notice and the course content show
  lockNote?: string | null;
}) {
  const [subs, setSubs] = useState(initialSubmissions);
  const update = (s: SubmissionDTO) => setSubs((prev) => ({ ...prev, [s.part]: s }));
  const modules = assessment.modules;
  const parts = modules.map((m) => ({ key: m.id, label: m.title, status: subs[m.id]?.status ?? ("Not started" as const), marked: needsSubmission(m) }));
  const items = locked ? [] : itemsOf({ hasResources: resources.length > 0, parts });
  const [current, setCurrent] = useState(items.find((i) => i.key === initialItem)?.key ?? items[0]?.key);
  const index = items.findIndex((i) => i.key === current);
  const item = items[index];
  const mod = item?.kind === "part" ? modules.find((m) => `part:${m.id}` === item.key) : undefined;

  // Activity log: which item the student opened
  useEffect(() => {
    if (current && current !== "overview") logUnitViewAction(course.code, unit.code, current).catch(() => {});
  }, [course.code, unit.code, current]);

  // Keep the open item in the address bar so a refresh or shared link opens it again
  useEffect(() => {
    if (!current) return;
    const url = new URL(window.location.href);
    url.searchParams.set("item", current);
    window.history.replaceState(null, "", url);
  }, [current]);

  const open = (key: string) => {
    setCurrent(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const unitHref = (code: string, key?: string) =>
    `/dashboard/assessment/${encodeURIComponent(code)}?course=${encodeURIComponent(course.code)}${key ? `&item=${encodeURIComponent(key)}` : ""}`;

  return (
    <div className="space-y-6">
      {/* Course bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-[1.5rem] border border-ink/10 bg-white px-5 py-4 shadow-sm">
        <div className="min-w-56 flex-1">
          <p className="text-lg font-semibold text-ink">{course.name}</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-lilac" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress">
              <div className="h-full rounded-full bg-plum" style={{ width: `${percent}%` }} />
            </div>
            <span className="shrink-0 text-sm font-medium text-ink">{percent}% complete</span>
          </div>
        </div>
        <Link href="/dashboard/course" className="rounded-xl border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-lilac">
          Course page
        </Link>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 space-y-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-plum">{unit.code}</p>
            <h1 className="mt-0.5 text-2xl font-semibold text-ink">{unit.title}</h1>
          </div>

          {locked && (
            <div className="flex flex-col items-center gap-3 rounded-[1.5rem] border border-dashed border-ink/25 bg-ink/[0.06] px-6 py-12 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-zinc-500 text-white">
                <LockIcon className="h-7 w-7" />
              </span>
              <p className="text-lg font-semibold text-ink">{lockNote ?? "This unit isn’t open yet."}</p>
              <p className="max-w-md text-base text-ink">Units shown in green are open for you.</p>
            </div>
          )}

          {unitStatus && (
            <div className="rounded-[1.5rem] border border-ink/10 bg-white px-5 py-4">
              <p className="text-sm font-semibold text-ink">Unit status</p>
              <p className="mt-1">
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${unitStatusStyle[unitStatus.status]}`}>{unitStatus.status}</span>
              </p>
              {unitStatus.feedback && <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-ink">{unitStatus.feedback}</p>}
              {unitStatus.decidedBy && (
                <p className="mt-2 text-sm text-ink">
                  {unitStatus.decidedBy}
                  {unitStatus.decidedAt && <> · <LocalTime iso={unitStatus.decidedAt} /></>}
                </p>
              )}
            </div>
          )}

          {!locked && items.length <= 1 && (
            <p className={`${card} text-center text-base text-ink`}>The college hasn’t added anything to this unit yet. Check back soon.</p>
          )}

          {/* Overview: one card per module, with its status, due date and the next step */}
          {item?.kind === "overview" && items.length > 1 && (
            <section aria-label="Unit overview" className="space-y-3">
              <h2 className="text-xl font-semibold text-ink">Your unit activities</h2>
              <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white">
                {items.slice(1).map((it, i) => {
                  const m = it.kind === "part" ? modules.find((x) => `part:${x.id}` === it.key) : undefined;
                  const due = m ? dues[m.id] : null;
                  const overdue = !!m && it.marked && isPastDue(due ?? null) && !subs[m.id]?.submittedAt;
                  return (
                    <li key={it.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-lilac/40 sm:px-5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-lilac text-plum">
                        {it.kind === "resources" ? <BookIcon className="h-4 w-4" /> : overdue ? <LockIcon className="h-4 w-4" /> : <ClipboardIcon className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold leading-snug text-ink">
                          {i + 1}. {it.label}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink">
                          <span>{it.kind === "resources" ? "Learner guide, presentation and supporting documents" : MODULE_KINDS.find((k) => k.key === m?.kind)?.label}</span>
                          {due && (
                            <span className={`flex items-center gap-1.5 font-medium ${overdue ? "text-rose-800" : "text-ink"}`}>
                              <ClockIcon className="h-4 w-4" />
                              Due {fmtDue(due)}
                              {overdue && " · overdue"}
                            </span>
                          )}
                        </span>
                      </span>
                      {subs[m?.id ?? ""]?.status === "Draft" && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Draft saved</span>}
                      {it.marked && it.status && (
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[it.status]}`}>{statusLabel[it.status]}</span>
                      )}
                      <button onClick={() => open(it.key)} className="shrink-0 rounded-full bg-plum px-4 py-2 text-sm font-semibold text-white transition hover:bg-plum-light">
                        {it.kind === "resources" ? "Open resources" : overdue ? "View module" : subs[m?.id ?? ""]?.status === "Draft" ? "Continue" : "Open"}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-sm text-ink">Your unit result appears after your trainer has assessed every module.</p>
            </section>
          )}

          {item?.kind === "resources" && <ResourcesView courseCode={course.code} unitCode={unit.code} resources={resources} />}

          {mod && (
            <section aria-label={mod.title} className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold text-ink">{mod.title}</h2>
                {needsSubmission(mod) && (
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[subs[mod.id]?.status ?? "Not started"]}`}>
                    {statusLabel[subs[mod.id]?.status ?? "Not started"]}
                  </span>
                )}
                {dues[mod.id] && (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    <ClockIcon className="h-4 w-4" />
                    Due {fmtDue(dues[mod.id]!)}
                  </span>
                )}
              </div>
              <ModuleWork
                key={mod.id}
                courseCode={course.code}
                unitCode={unit.code}
                module={mod}
                sub={subs[mod.id]}
                due={dues[mod.id] ?? null}
                requests={extensions.filter((r) => r.moduleId === mod.id)}
                photoRequired={photoRequired}
                declaration={declaration}
                onSaved={update}
              />
            </section>
          )}

          {items.length > 1 && (
            <nav aria-label="Previous and next" className="flex flex-wrap justify-between gap-3 pt-2">
              {index > 0 ? (
                <button onClick={() => open(items[index - 1].key)} className="inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-white px-5 py-3 text-sm font-medium text-ink transition hover:bg-lilac">
                  <BackIcon className="h-4 w-4" />
                  Previous: {items[index - 1].label}
                </button>
              ) : (
                <span />
              )}
              {index < items.length - 1 && (
                <button onClick={() => open(items[index + 1].key)} className="inline-flex items-center gap-2 rounded-xl bg-plum px-5 py-3 text-sm font-semibold text-white transition hover:bg-plum-light">
                  Next: {items[index + 1].label}
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              )}
            </nav>
          )}
        </main>

        {/* Every unit of the course */}
        <aside aria-label="Course content" className="space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:pr-1">
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="text-lg font-semibold text-ink">Course content</h2>
            <span className="text-sm text-ink">{units.length} units</span>
          </div>
          <ul className="space-y-2.5">
            {units.map((u, i) => {
              const here = u.code === unit.code;
              const list = here ? items : itemsOf({ hasResources: u.resources.length > 0, parts: u.parts });
              if (!u.unlocked) {
                return (
                  <li key={u.code}>
                    <div
                      aria-disabled="true"
                      title={u.note ?? "Not open yet"}
                      className={`flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3.5 ${here ? "border-zinc-500 bg-ink/[0.1]" : "border-ink/20 bg-ink/[0.06]"}`}
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-zinc-500 text-sm font-semibold text-white">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-snug text-ink">{u.title}</span>
                        <span className="block text-xs text-ink">
                          {u.code} · {u.note ?? "Not open yet"}
                        </span>
                      </span>
                      <LockIcon className="h-5 w-5 shrink-0 text-ink" />
                    </div>
                  </li>
                );
              }
              return (
                <li key={u.code}>
                  <details open={here} className={`group rounded-2xl border ${here ? "border-plum bg-lilac" : "border-ink/10 bg-white"}`}>
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-semibold text-white">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-snug text-ink">{u.title}</span>
                        <span className="block text-xs text-ink">
                          {u.code} · {list.length - 1} {list.length === 2 ? "item" : "items"}
                        </span>
                      </span>
                      <ChevronDownIcon className="h-5 w-5 shrink-0 text-ink transition group-open:rotate-180" />
                    </summary>
                    <ul className="space-y-1 px-2 pb-3">
                      {list.map((it) => {
                        const active = here && it.key === current;
                        const body = (
                          <>
                            <ItemIcon kind={it.kind} className="h-4 w-4 shrink-0" />
                            <span className="min-w-0 flex-1 truncate">{it.label}</span>
                            {it.marked && it.status && it.status !== "Not started" && (
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? "bg-white/20 text-white" : statusStyle[it.status]}`}>
                                {statusLabel[it.status]}
                              </span>
                            )}
                          </>
                        );
                        const cls = `flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${active ? "bg-plum font-medium text-white" : "text-ink hover:bg-white"}`;
                        return (
                          <li key={it.key}>
                            {here ? (
                              <button onClick={() => open(it.key)} aria-current={active ? "true" : undefined} className={cls}>
                                {body}
                              </button>
                            ) : (
                              <Link href={unitHref(u.code, it.key)} className={cls}>
                                {body}
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}

// Everything under "Resources", as one table under a black strip: Learner Guide, PowerPoint Presentation, then the
// Supporting Document row, which expands to list its files. Any extra links / notes follow below.
function ResourcesView({ courseCode, unitCode, resources }: { courseCode: string; unitCode: string; resources: Resource[] }) {
  const main = RESOURCE_SLOTS.filter((slot) => slot.key !== "supporting").flatMap((slot) =>
    resources.filter((r): r is FileResource => r.kind === "file" && r.slot === slot.key),
  );
  const supporting = resources.filter((r): r is FileResource => r.kind === "file" && r.slot === "supporting");
  const extraFiles = resources.filter((r): r is FileResource => r.kind === "file" && !r.slot);
  const extra = resources.filter((r) => r.kind !== "file");
  const rows = main.length + extraFiles.length + (supporting.length ? 1 : 0);
  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-ink">Resources</h2>
      {rows > 0 && (
        <section aria-label="Resource documents" className="overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white shadow-md">
          <div className="flex items-center gap-2 bg-ink px-5 py-3 text-sm font-medium text-white">
            <FileIcon className="h-4 w-4 shrink-0" />
            Resources
            <span className="font-normal">
              · {rows} {rows === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead className="border-b border-ink/10 bg-lilac text-xs font-semibold uppercase tracking-wide text-ink">
                <tr>
                  <th className="px-5 py-2.5">Document</th>
                  <th className="px-5 py-2.5">File</th>
                  <th className="px-5 py-2.5 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {[...main, ...extraFiles].map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lilac text-[10px] font-bold uppercase text-plum">
                          {r.file.name.split(".").pop()}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-base font-semibold text-ink">{r.title}</span>
                          {r.description && <span className="block whitespace-pre-wrap text-sm text-ink">{r.description}</span>}
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-ink">
                      <span className="block max-w-56 truncate">{r.file.name}</span>
                      {formatBytes(r.file.size)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex justify-end">
                        <FileActions file={r.file} title={r.title} size="sm" />
                      </span>
                    </td>
                  </tr>
                ))}
                {supporting.length > 0 && <SupportingRows courseCode={courseCode} unitCode={unitCode} files={supporting} />}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {extra.length > 0 && (
        <div className="space-y-5">
          {rows > 0 && <h3 className="text-lg font-semibold text-ink">More resources</h3>}
          {extra.map((r) =>
            r.kind === "link" ? (
              <section key={r.id} className={card} aria-label={r.title}>
                <h3 className="text-lg font-semibold text-ink">{r.title}</h3>
                {r.description && <p className="mt-2 whitespace-pre-wrap text-base text-ink">{r.description}</p>}
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-plum px-5 py-3 text-sm font-semibold text-white transition hover:bg-plum-light"
                >
                  Open link
                  <ArrowRightIcon className="h-4 w-4" />
                </a>
              </section>
            ) : r.kind === "note" ? (
              <section key={r.id} className={card} aria-label={r.title}>
                <h3 className="text-lg font-semibold text-ink">{r.title}</h3>
                {r.description && <p className="mt-2 whitespace-pre-wrap text-base text-ink">{r.description}</p>}
                {/* Notes HTML is sanitised on the server (lib/sanitize.ts) */}
                <div className="rich-text mt-3 text-base leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: r.body }} />
              </section>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

type FileResource = Extract<Resource, { kind: "file" }>;

// The Supporting Document folder as rows of the Resources table: one row that expands to show every file
// (each downloads on its own), with "Download all (ZIP)" beside it
function SupportingRows({ courseCode, unitCode, files }: { courseCode: string; unitCode: string; files: FileResource[] }) {
  const [open, setOpen] = useState(false);
  const sorted = [...files].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
  const total = files.reduce((n, r) => n + r.file.size, 0);
  return (
    <>
      <tr className={open ? "bg-lilac/60" : ""}>
        <td className="px-5 py-3.5">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center gap-3 text-left">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-plum text-white">
              <ChevronDownIcon className={`h-5 w-5 transition ${open ? "rotate-180" : ""}`} />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold text-ink">Supporting Document</span>
              <span className="block text-sm font-medium text-plum underline">
                {open ? "Hide files" : `Show ${files.length} file${files.length === 1 ? "" : "s"}`}
              </span>
            </span>
          </button>
        </td>
        <td className="px-5 py-3.5 text-sm text-ink">
          {files.length} file{files.length === 1 ? "" : "s"}
          <span className="block">{formatBytes(total)}</span>
        </td>
        <td className="px-5 py-3.5">
          <span className="flex justify-end">
            <a
              href={`/api/supporting/${encodeURIComponent(courseCode)}/${encodeURIComponent(unitCode)}`}
              className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-plum"
            >
              Download all (ZIP)
            </a>
          </span>
        </td>
      </tr>
      {open &&
        sorted.map((r) => {
          const slash = r.title.lastIndexOf("/");
          return (
            <tr key={r.id} className="bg-lilac/30">
              <td className="py-3 pl-12 pr-5">
                <span className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[9px] font-bold uppercase text-plum ring-1 ring-ink/10">
                    {r.file.name.split(".").pop()}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{slash >= 0 ? r.title.slice(slash + 1) : r.title}</span>
                    {slash >= 0 && <span className="block text-xs text-ink">{r.title.slice(0, slash)}</span>}
                  </span>
                </span>
              </td>
              <td className="px-5 py-3 text-sm text-ink">{formatBytes(r.file.size)}</td>
              <td className="px-5 py-3">
                <span className="flex justify-end">
                  <FileActions file={r.file} size="sm" />
                </span>
              </td>
            </tr>
          );
        })}
    </>
  );
}
