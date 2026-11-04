"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ArrowRightIcon, BackIcon, BookIcon, CheckIcon, ChevronDownIcon, ClipboardIcon, ClockIcon, FileIcon, LockIcon } from "../../_components/icons";
import FileActions from "../../_components/FileActions";
import FileList from "../../_components/FileList";
import DueLabel from "../_components/DueLabel";
import LocalTime from "../_components/LocalTime";
import SubmitPhoto from "../_components/SubmitPhoto";
import { logUnitViewAction, saveWorkAction, submitQuizAction } from "../actions";
import type { DeclarationText } from "@/lib/declaration";
import { ASSESSMENT_PARTS, isWritten, QUIZ_WRITTEN_MAX, summarise, type AssessmentPart, type StudentAssessment } from "@/lib/assessment-meta";
import type { Unit } from "@/lib/courses";
import { FILE_RULES, formatBytes, needsRework, statusLabel, statusStyle, type FileRef, type SubmissionDTO, type SubmissionStatus } from "@/lib/submission-meta";
import { toneCard, toneStyle } from "@/lib/result-meta";
import { canEditWork, RESOURCE_SLOTS, type Resource, type UnitResultDTO } from "@/lib/unit-meta";

type Subs = Partial<Record<AssessmentPart, SubmissionDTO>>;
type WrittenPart = Exclude<AssessmentPart, "quiz">;

const card = "rounded-[1.5rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] sm:p-6";

// A unit as the sidebar lists it
export type OutlineUnit = {
  code: string;
  title: string;
  hasOverview: boolean;
  resources: { id: string; title: string; kind: Resource["kind"] }[];
  parts: { key: AssessmentPart; status: SubmissionStatus | "Not started" }[];
  unlocked: boolean; // staff unlocked it for this student; a locked unit is grey and can't be opened
};

// What can be opened in a unit: "overview", "resources" or "part:<assessment part>"
type Item = { key: string; label: string; kind: "overview" | "resources" | "part"; status?: SubmissionStatus | "Not started" };

const partLabel = (key: AssessmentPart) => ASSESSMENT_PARTS.find((p) => p.key === key)?.label ?? key;

// Students only see learning content here — assessment parts are skipped from the left/course list.
// Every unit: 1. Quiz and Activities  2. Resources  3. Theory Task  4. Workplacement Task
function itemsOf(u: Pick<OutlineUnit, "hasOverview" | "resources" | "parts">): Item[] {
  const part = (p: OutlineUnit["parts"][number]): Item => ({ key: `part:${p.key}`, label: partLabel(p.key), kind: "part", status: p.status });
  return [
    ...u.parts.filter((p) => p.key === "quiz").map(part),
    ...(u.resources.length ? [{ key: "resources", label: "Resources", kind: "resources" as const }] : []),
    ...u.parts.filter((p) => p.key !== "quiz").map(part),
  ];
}


function ItemIcon({ kind, className = "h-4 w-4" }: { kind: Item["kind"]; className?: string }) {
  if (kind === "resources") return <FileIcon className={className} />;
  if (kind === "part") return <ClipboardIcon className={className} />;
  return <BookIcon className={className} />;
}

export default function UnitWork({
  course,
  unit,
  units,
  percent,
  initialItem,
  assessment,
  initialSubmissions,
  pastDue,
  photoRequired,
  declaration,
  overview,
  resources,
  outcome,
  locked = false,
}: {
  course: { code: string; name: string };
  unit: Unit;
  units: OutlineUnit[];
  percent: number; // course progress: assessment parts accepted
  initialItem?: string;
  assessment: StudentAssessment;
  initialSubmissions: Subs;
  pastDue: boolean;
  photoRequired: boolean;
  declaration: DeclarationText; // what the student ticks before submitting a task
  overview: string;
  resources: Resource[];
  outcome: UnitResultDTO | null;
  locked?: boolean; // this unit isn't unlocked for the student: only the notice and the course content show
}) {
  // A final result or a passed deadline both close the unit
  const closed = pastDue || !!outcome;
  const [subs, setSubs] = useState(initialSubmissions);
  const set = summarise(assessment);
  const update = (s: SubmissionDTO) => setSubs((prev) => ({ ...prev, [s.part]: s }));

  // This unit's items, with live submission statuses
  const items = itemsOf({
    hasOverview: !!overview,
    resources,
    parts: ASSESSMENT_PARTS.filter((p) => set[p.key]).map((p) => ({ key: p.key, status: subs[p.key]?.status ?? "Not started" })),
  });
  const [current, setCurrent] = useState(items.find((i) => i.key === initialItem)?.key ?? items[0]?.key);
  const index = items.findIndex((i) => i.key === current);
  const item = items[index];

  // Activity log: which item the student opened
  useEffect(() => {
    if (current) logUnitViewAction(course.code, unit.code, current).catch(() => {});
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

  const part = item?.key.startsWith("part:") ? (item.key.slice(5) as AssessmentPart) : undefined;
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
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/course" className="rounded-xl border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-lilac">
            Course page
          </Link>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Selected item */}
        <main className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-plum">{unit.code}</p>
              <h1 className="mt-0.5 text-2xl font-semibold text-ink">{unit.title}</h1>
            </div>
            <DueLabel dueAt={assessment.dueAt} />
          </div>

          {locked && (
            <div className="flex flex-col items-center gap-3 rounded-[1.5rem] border border-dashed border-ink/25 bg-ink/[0.06] px-6 py-12 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-zinc-400 text-white">
                <LockIcon className="h-7 w-7" />
              </span>
              <p className="text-lg font-semibold text-ink">This unit is locked</p>
              <p className="max-w-md text-base text-ink">Your trainer or the college will unlock it when it’s time to start. Units shown in green are open for you.</p>
            </div>
          )}

          {outcome && (
            <div className={`rounded-[1.5rem] px-5 py-4 ${toneCard[outcome.tone]}`}>
              <p className="text-xs font-semibold uppercase tracking-wide">Unit outcome</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-lg font-medium">
                Final result:
                <span className={`rounded-full px-3 py-0.5 text-sm ${toneStyle[outcome.tone]}`}>{outcome.label}</span>
              </p>
              {outcome.feedback && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{outcome.feedback}</p>}
              <p className="mt-2 text-xs">
                {outcome.decidedBy} · <LocalTime iso={outcome.decidedAt} />
              </p>
            </div>
          )}
          {pastDue && !outcome && (
            <p className="rounded-2xl bg-rose-50 px-5 py-3 text-sm text-rose-800">
              The due date has passed, so this unit is closed. Contact the college if you need more time.
            </p>
          )}

          {!item && (
            <p className={`${card} text-center text-sm text-ink`}>The college hasn’t added anything to this unit yet. Check back soon.</p>
          )}

          {item?.kind === "overview" && (
            <section className={card} aria-label="Unit overview">
              <h2 className="text-lg font-semibold text-ink">Unit overview</h2>
              {/* Overview HTML is sanitised on the server (lib/sanitize.ts) */}
              <div className="rich-text mt-3 text-base leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: overview }} />
            </section>
          )}

          {item?.kind === "resources" && <ResourcesView courseCode={course.code} unitCode={unit.code} resources={resources} />}

          {part && (
            <section aria-label={partLabel(part)} className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold text-ink">{partLabel(part)}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyle[subs[part]?.status ?? "Not started"]}`}>
                  {statusLabel[subs[part]?.status ?? "Not started"]}
                </span>
              </div>
              {/* Once marked Satisfactory the part is complete: the student only sees the status and feedback */}
              {subs[part]?.status === "Accepted" ? (
                <Outcome sub={subs[part]!} />
              ) : part === "quiz" ? (
                <QuizPart courseCode={course.code} unitCode={unit.code} quiz={assessment.quiz} sub={subs.quiz} pastDue={closed} photoRequired={photoRequired} onSaved={update} />
              ) : (
                <WrittenWork key={part} part={part} courseCode={course.code} unitCode={unit.code} assessment={assessment} sub={subs[part]} pastDue={closed} photoRequired={photoRequired} declaration={declaration} onSaved={update} />
              )}
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
              const list = here ? items : itemsOf(u);
              // A locked unit: the whole block is grey and doesn't open
              if (!u.unlocked) {
                return (
                  <li key={u.code}>
                    <div
                      aria-disabled="true"
                      title="Locked — your trainer will unlock this unit"
                      className={`flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3.5 ${here ? "border-zinc-500 bg-ink/[0.1]" : "border-ink/20 bg-ink/[0.06]"}`}
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-zinc-400 text-sm font-semibold text-white">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-snug text-ink">{u.title}</span>
                        <span className="block text-xs text-ink">{u.code} · Locked</span>
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
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-snug text-ink">{u.title}</span>
                        <span className="block text-xs text-ink">
                          {u.code} · {list.length} {list.length === 1 ? "item" : "items"}
                        </span>
                      </span>
                      <ChevronDownIcon className="h-5 w-5 shrink-0 text-ink transition group-open:rotate-180" />
                    </summary>
                    {list.length === 0 ? (
                      <p className="px-4 pb-4 text-sm text-ink">Nothing added yet.</p>
                    ) : (
                      <ul className="space-y-1 px-2 pb-3">
                        {list.map((it) => {
                          const active = here && it.key === current;
                          const body = (
                            <>
                              <ItemIcon kind={it.kind} className="h-4 w-4 shrink-0" />
                              <span className="min-w-0 flex-1 truncate">{it.label}</span>
                              {it.status && it.status !== "Not started" && (
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${active ? "bg-white/20 text-white" : statusStyle[it.status]}`}>{statusLabel[it.status]}</span>
                              )}
                            </>
                          );
                          const cls = `flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                            active ? "bg-plum font-medium text-white" : "text-ink hover:bg-white"
                          }`;
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
                    )}
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

// One document in Resources: nothing opens in the page — View opens it, Download saves it
function DocumentRow({ resource }: { resource: FileResource }) {
  const f = resource.file;
  return (
    <li className={`${card} flex flex-wrap items-center gap-4`} aria-label={resource.title}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-lilac text-[11px] font-bold uppercase text-plum">{f.name.split(".").pop()}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold leading-snug text-ink">{resource.title}</span>
        <span className="block truncate text-sm text-ink">
          {f.name} · {formatBytes(f.size)}
        </span>
        {resource.description && <span className="mt-1 block whitespace-pre-wrap text-base text-ink">{resource.description}</span>}
      </span>
      <FileActions file={f} title={resource.title} />
    </li>
  );
}

// Everything under "Resources": the Learner Guide, PowerPoint Presentation and Supporting Document, then any extras
function ResourcesView({ courseCode, unitCode, resources }: { courseCode: string; unitCode: string; resources: Resource[] }) {
  const main = RESOURCE_SLOTS.filter((slot) => slot.key !== "supporting").flatMap((slot) =>
    resources.filter((r) => r.kind === "file" && r.slot === slot.key),
  );
  const supporting = resources.filter((r): r is FileResource => r.kind === "file" && r.slot === "supporting");
  const extra = resources.filter((r) => !(r.kind === "file" && r.slot));
  return (
    <div className="space-y-10">
      <h2 className="text-xl font-semibold text-ink">Resources</h2>
      {main.length > 0 && (
        <ul className="space-y-3">{main.map((r) => r.kind === "file" && <DocumentRow key={r.id} resource={r} />)}</ul>
      )}
      {supporting.length > 0 && <SupportingDownloads courseCode={courseCode} unitCode={unitCode} files={supporting} />}
      {extra.length > 0 && (
        <div className="space-y-5">
          {main.length > 0 && <h3 className="text-lg font-semibold text-ink">More resources</h3>}
          {extra.map((r) =>
            r.kind === "file" ? (
              <ul key={r.id}>
                <DocumentRow resource={r} />
              </ul>
            ) : r.kind === "link" ? (
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
            ) : (
              <section key={r.id} className={card} aria-label={r.title}>
                <h3 className="text-lg font-semibold text-ink">{r.title}</h3>
                {r.description && <p className="mt-2 whitespace-pre-wrap text-base text-ink">{r.description}</p>}
                {/* Notes HTML is sanitised on the server (lib/sanitize.ts) */}
                <div className="rich-text mt-3 text-base leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: r.body }} />
              </section>
            ),
          )}
        </div>
      )}
    </div>
  );
}

type FileResource = Extract<Resource, { kind: "file" }>;


// The Supporting Document folder: a list of files to download (one by one, or all as a ZIP) — nothing is shown in the page
function SupportingDownloads({ courseCode, unitCode, files }: { courseCode: string; unitCode: string; files: FileResource[] }) {
  const sorted = [...files].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
  const total = files.reduce((n, r) => n + r.file.size, 0);
  return (
    <section aria-label="Supporting Document" className="overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-ink px-5 py-3 text-white">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <FileIcon className="h-4 w-4 shrink-0" />
          Supporting Document
          <span className="font-normal">
            · {files.length} file{files.length === 1 ? "" : "s"} · {formatBytes(total)}
          </span>
        </span>
        <a
          href={`/api/supporting/${encodeURIComponent(courseCode)}/${encodeURIComponent(unitCode)}`}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-lilac"
        >
          Download all (ZIP)
        </a>
      </div>
      <ul className="divide-y divide-ink/10">
        {sorted.map((r) => {
          const slash = r.title.lastIndexOf("/");
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lilac text-[10px] font-bold uppercase text-plum">
                {r.file.name.split(".").pop()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium text-ink">{slash >= 0 ? r.title.slice(slash + 1) : r.title}</span>
                <span className="block text-sm text-ink">
                  {slash >= 0 && `${r.title.slice(0, slash)} · `}
                  {formatBytes(r.file.size)}
                </span>
              </span>
              <FileActions file={r.file} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}


// ---------- Status + feedback ----------

// The declaration certificate made when the student submitted
function DeclarationLink({ sub }: { sub: SubmissionDTO }) {
  if (!sub.content.declaration) return null;
  return (
    <a
      href={`/declaration/${sub.submissionId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-2 rounded-xl border border-current/30 bg-white px-4 py-2 text-sm font-semibold text-plum transition hover:bg-lilac"
    >
      <FileIcon className="h-4 w-4" />
      View declaration
    </a>
  );
}

function Outcome({ sub }: { sub: SubmissionDTO }) {
  if (sub.status === "Draft") {
    return <p className="rounded-2xl bg-sky-50 px-5 py-3 text-sm text-sky-800">Draft saved — not sent yet. Submit when you’re ready.</p>;
  }
  if (sub.status === "Submitted") {
    return (
      <div className="rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <p className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 shrink-0" />
          Submitted{sub.submittedAt && <> on <LocalTime iso={sub.submittedAt} /></>} — waiting for your trainer to review it.
        </p>
        <DeclarationLink sub={sub} />
      </div>
    );
  }
  const accepted = sub.status === "Accepted";
  return (
    <div
      className={`rounded-2xl px-5 py-4 ${accepted ? "bg-emerald-50 text-emerald-900" : sub.status === "MoreDocs" ? "bg-orange-50 text-orange-900" : "bg-rose-50 text-rose-900"}`}
    >
      <p className="text-base font-semibold">
        {statusLabel[sub.status]}
        {accepted ? " ✓" : sub.status === "MoreDocs" ? " — please upload the extra documents and resubmit" : " — please fix it and resubmit"}
        {sub.attempt > 1 && <span className="font-normal opacity-70"> · attempt {sub.attempt}</span>}
      </p>
      {sub.feedback && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{sub.feedback}</p>}
      {sub.decidedBy && (
        <p className="mt-2 text-[11px] opacity-70">
          {sub.decidedBy}
          {sub.decidedAt && <> · <LocalTime iso={sub.decidedAt} /></>}
        </p>
      )}
      <DeclarationLink sub={sub} />
      {sub.history.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer opacity-70">Earlier feedback ({sub.history.length})</summary>
          <ul className="mt-2 space-y-2">
            {sub.history.map((h) => (
              <li key={h.attempt} className="rounded-xl bg-white/60 px-3 py-2">
                <span className="font-medium">Attempt {h.attempt} · {statusLabel[h.status]}</span> — {h.feedback || "No comment"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ---------- Quiz and Activities ----------

function QuizPart({
  courseCode,
  unitCode,
  quiz,
  sub,
  pastDue,
  photoRequired,
  onSaved,
}: {
  courseCode: string;
  unitCode: string;
  quiz: StudentAssessment["quiz"];
  sub: SubmissionDTO | undefined;
  pastDue: boolean;
  photoRequired: boolean;
  onSaved: (s: SubmissionDTO) => void;
}) {
  const [retrying, setRetrying] = useState(false);
  const [askPhoto, setAskPhoto] = useState(false);
  // an option index for a multiple-choice question, typed text for a written one
  const [answers, setAnswers] = useState<(number | string | null)[]>(() => quiz.questions.map(() => null));
  const setAnswer = (i: number, v: number | string) => setAnswers((a) => a.map((x, j) => (j === i ? v : x)));
  const [sending, startSending] = useTransition();
  const taking = !pastDue && (!sub || retrying);
  const answered = answers.filter((a) => (typeof a === "string" ? a.trim().length > 0 : a !== null)).length;
  const hasChoice = quiz.questions.some((q) => !isWritten(q));

  const submit = () => {
    if (answered < quiz.questions.length) return void toast.error(`Answer all ${quiz.questions.length} questions first.`);
    if (photoRequired) return setAskPhoto(true);
    if (!window.confirm("Submit your quiz? Your trainer will check it.")) return;
    send(null);
  };

  const send = (photoId: string | null) => {
    setAskPhoto(false);
    startSending(async () => {
      const res = await submitQuizAction(courseCode, unitCode, answers as (number | string)[], photoId);
      if (!res.ok) return void toast.error(res.error);
      onSaved(res.submission);
      setRetrying(false);
      toast.success("Quiz submitted to your trainer");
    });
  };

  return (
    <section className="space-y-4">
      {sub && !retrying && <Outcome sub={sub} />}
      {needsRework(sub?.status) && !retrying && !pastDue && (
        <button
          onClick={() => {
            setAnswers(quiz.questions.map(() => null));
            setRetrying(true);
          }}
          className="rounded-full bg-plum px-6 py-3 text-sm font-medium text-white transition hover:bg-plum-light"
        >
          Try the quiz again
        </button>
      )}

      {taking && (
        <>
          <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
            <div>
              <h2 className="text-base font-semibold text-ink">Quiz and Activities</h2>
              <p className="mt-0.5 text-xs text-ink">
                {quiz.questions.length} questions · answer every one{hasChoice ? ` · pass mark ${quiz.passMark}%` : ""}
              </p>
            </div>
            <p className="text-xs text-ink">
              {answered} / {quiz.questions.length} answered
            </p>
          </div>
          {quiz.questions.map((q, i) => (
            <fieldset key={q.id} className={card}>
              <legend className="sr-only">Question {i + 1}</legend>
              <p className="flex gap-3 text-sm font-medium text-ink">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-lilac text-[11px] text-plum">{i + 1}</span>
                <span className="pt-1">{q.text}</span>
              </p>
              {isWritten(q) ? (
                <div className="mt-4 pl-10">
                  <textarea
                    rows={4}
                    value={typeof answers[i] === "string" ? (answers[i] as string) : ""}
                    maxLength={QUIZ_WRITTEN_MAX}
                    onChange={(e) => setAnswer(i, e.target.value)}
                    placeholder="Type your answer here"
                    aria-label={`Your answer to question ${i + 1}`}
                    className="w-full resize-y rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/15 placeholder:text-ink/60 focus:ring-plum/40"
                  />
                </div>
              ) : (
                <div className="mt-4 grid gap-2 pl-10">
                  {q.options.map((opt, k) => (
                    <label
                      key={k}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                        answers[i] === k ? "bg-plum text-white" : "bg-lilac/70 text-ink hover:bg-lilac"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={answers[i] === k}
                        onChange={() => setAnswer(i, k)}
                        className="h-4 w-4 accent-peach"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          ))}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={submit}
              disabled={sending}
              className="rounded-full bg-plum px-6 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:cursor-wait disabled:opacity-60"
            >
              {sending ? "Submitting…" : "Submit quiz"}
            </button>
            {retrying && (
              <button onClick={() => setRetrying(false)} className="rounded-full px-5 py-3 text-sm font-medium text-ink hover:bg-lilac">
                Cancel
              </button>
            )}
          </div>
        </>
      )}
      {!sub && pastDue && <p className={`${card} text-sm text-ink`}>This unit is closed, so the quiz can’t be taken now.</p>}
      {askPhoto && <SubmitPhoto title="Submit your quiz" onCancel={() => setAskPhoto(false)} onConfirm={(p) => send(p.id)} />}
    </section>
  );
}

// ---------- Theory Task / Workplacement Task ----------

function WrittenWork({
  part,
  courseCode,
  unitCode,
  assessment,
  sub,
  pastDue,
  photoRequired,
  declaration,
  onSaved,
}: {
  part: WrittenPart;
  courseCode: string;
  unitCode: string;
  assessment: StudentAssessment;
  sub: SubmissionDTO | undefined;
  pastDue: boolean;
  photoRequired: boolean;
  declaration: DeclarationText;
  onSaved: (s: SubmissionDTO) => void;
}) {
  const [askPhoto, setAskPhoto] = useState(false);
  const canEdit = canEditWork(sub?.status, pastDue, false);
  const task = part === "theory" ? assessment.theory.files : assessment.workplace.files;
  const [files, setFiles] = useState<FileRef[]>(sub?.files ?? []);
  // Attachments Super Admin asked for: one upload box each (otherwise the student uploads any files)
  const asked = part === "theory" ? assessment.theory.uploads : assessment.workplace.uploads;
  const [slotFiles, setSlotFiles] = useState<Record<string, FileRef[]>>(() =>
    Object.fromEntries(
      asked.map((s, i) => [
        s.id,
        sub && !sub.content.slots
          ? // handed in before the attachments were set up: show those files under the first one, so nothing is hidden or lost
            i === 0
            ? sub.files
            : []
          : (sub?.content.slots?.find((x) => x.slotId === s.id)?.fileIds ?? [])
              .map((id) => sub?.files.find((f) => f.id === id))
              .filter((f): f is FileRef => !!f),
      ]),
    ),
  );
  const workKey = () =>
    asked.length ? asked.map((s) => (slotFiles[s.id] ?? []).map((f) => f.id).join(",")).join("|") : files.map((f) => f.id).join();
  const [saving, startSaving] = useTransition();
  const [savedIds, setSavedIds] = useState(workKey);
  // every declaration point is ticked on its own, then "I agree" at the end
  const [ticked, setTicked] = useState<boolean[]>(() => declaration.points.map(() => false));
  const [agreed, setAgreed] = useState(false);
  const allTicked = ticked.every(Boolean) && agreed;
  const dirty = canEdit && workKey() !== savedIds;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const send = (mode: "draft" | "submit", photoId: string | null = null) => {
    if (mode === "submit" && !photoId) {
      const missing = asked.find((s) => !slotFiles[s.id]?.length);
      if (missing) return void toast.error(`Upload “${missing.label}” first.`);
      if (!asked.length && files.length === 0) return void toast.error("Upload your completed work first.");
      if (!ticked.every(Boolean)) return void toast.error("Tick every point of the declaration before you submit.");
      if (!agreed) return void toast.error(`Tick “${declaration.agree}” before you submit.`);
      if (photoRequired) return setAskPhoto(true);
      if (!window.confirm("Submit to your trainer? You can’t change it while they review it.")) return;
    }
    setAskPhoto(false);
    startSaving(async () => {
      const work = asked.length
        ? {
            fileIds: asked.flatMap((s) => (slotFiles[s.id] ?? []).map((f) => f.id)),
            slots: asked.map((s) => ({ slotId: s.id, fileIds: (slotFiles[s.id] ?? []).map((f) => f.id) })),
          }
        : { fileIds: files.map((f) => f.id) };
      const res = await saveWorkAction(courseCode, unitCode, part, work, mode, photoId, mode === "submit" && allTicked);
      if (!res.ok) return void toast.error(res.error);
      setSavedIds(workKey());
      onSaved(res.submission);
      toast.success(mode === "submit" ? "Submitted to your trainer" : "Draft saved");
    });
  };

  return (
    <section className="space-y-5">
      {sub && <Outcome sub={sub} />}

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">1. Read and download the task</h3>
          <p className="mt-0.5 text-sm text-ink">View the task below, download it, complete it, then upload your work in step 2.</p>
        </div>
        {task.map((f) => (
          <ul key={f.id}>
            <DocumentRow resource={{ id: f.id, kind: "file", title: f.name.replace(/\.[^.]+$/, ""), description: "", file: f }} />
          </ul>
        ))}
      </div>

      <div className={`${card} space-y-3`}>
        <div>
          <h3 className="text-lg font-semibold text-ink">2. Upload your completed work</h3>
          <p className="mt-0.5 text-sm text-ink">
            {!canEdit
              ? "What you handed in:"
              : asked.length
                ? `Upload a file for each item below (${FILE_RULES.label}). All of them are needed before you can submit.`
                : `You can attach several files (${FILE_RULES.label}, up to ${FILE_RULES.maxFiles}).`}
          </p>
        </div>
        {asked.length ? (
          <ol className="space-y-3">
            {asked.map((s, i) => {
              const done = !!slotFiles[s.id]?.length;
              return (
                <li key={s.id} className="rounded-xl border border-ink/10 p-3">
                  <p className="mb-2 flex items-center gap-2 text-base font-semibold text-ink">
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? "bg-emerald-600 text-white" : "bg-lilac text-plum"}`}
                    >
                      {done ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    {s.label}
                  </p>
                  <FileList
                    files={slotFiles[s.id] ?? []}
                    onChange={
                      canEdit ? (next) => setSlotFiles((m) => ({ ...m, [s.id]: next.slice(0, FILE_RULES.maxPerSlot) })) : undefined
                    }
                    emptyText={canEdit ? "Not uploaded yet." : "Nothing uploaded."}
                    uploadLabel="Upload file"
                    inputLabel={`Upload ${s.label}`}
                  />
                </li>
              );
            })}
          </ol>
        ) : (
          <FileList
            files={files}
            onChange={canEdit ? (next) => setFiles(next.slice(0, FILE_RULES.maxFiles)) : undefined}
            emptyText="No files uploaded."
            uploadLabel="Upload file"
            inputLabel="Upload your completed work"
          />
        )}
      </div>

      {canEdit && (
        <div className={`${card} space-y-3`}>
          <h3 className="text-lg font-semibold text-ink">3. Declaration</h3>
          <p className="text-base text-ink">{declaration.intro}</p>
          <p className="text-sm font-medium text-ink">Tick each point, then tick the last box to agree.</p>
          <ul className="space-y-2">
            {declaration.points.map((p, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2 text-base text-ink transition hover:bg-lilac">
                  <input
                    type="checkbox"
                    checked={ticked[i] ?? false}
                    onChange={(e) => setTicked((t) => t.map((v, j) => (j === i ? e.target.checked : v)))}
                    className="mt-1 h-5 w-5 shrink-0 accent-plum"
                  />
                  {p}
                </label>
              </li>
            ))}
          </ul>
          <label className="flex w-fit cursor-pointer items-center gap-3 rounded-xl bg-lilac px-4 py-3 text-base font-semibold text-ink">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-5 w-5 accent-plum" />
            {declaration.agree}
          </label>
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => send("submit")}
            disabled={saving}
            className="rounded-xl bg-plum px-6 py-3.5 text-base font-semibold text-white transition hover:bg-plum-light disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Saving…" : needsRework(sub?.status) ? "Resubmit to trainer" : "Submit to trainer"}
          </button>
          <button
            onClick={() => send("draft")}
            disabled={saving || !dirty}
            className="rounded-xl border border-plum/30 bg-lilac px-6 py-3.5 text-base font-semibold text-plum transition hover:bg-plum/10 disabled:opacity-50"
          >
            Save draft
          </button>
          {dirty && <span className="text-sm text-amber-800">Not saved yet</span>}
        </div>
      )}
      {askPhoto && (
        <SubmitPhoto title="Submit to your trainer" onCancel={() => setAskPhoto(false)} onConfirm={(p) => send("submit", p.id)} />
      )}
    </section>
  );
}
