"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ArrowRightIcon, BackIcon, BookIcon, CheckIcon, ChevronDownIcon, ClipboardIcon, ClockIcon, CompressIcon, ExpandIcon, FileIcon } from "../../_components/icons";
import FileList from "../../_components/FileList";
import DueLabel from "../_components/DueLabel";
import LocalTime from "../_components/LocalTime";
import SubmitPhoto from "../_components/SubmitPhoto";
import { logUnitViewAction, saveWorkAction, submitQuizAction } from "../actions";
import type { DeclarationText } from "@/lib/declaration";
import { ASSESSMENT_PARTS, summarise, type AssessmentPart, type StudentAssessment } from "@/lib/assessment-meta";
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

const isPdf = (f: FileRef) => /\.pdf$/i.test(f.name);
const isSlides = (f: FileRef) => /\.pptx?$/i.test(f.name);
const isImage = (f: FileRef) => /\.(jpe?g|png)$/i.test(f.name);

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

          {item?.kind === "resources" && <ResourcesView resources={resources} />}

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
              const accepted = u.parts.length > 0 && u.parts.every((p) => p.status === "Accepted");
              return (
                <li key={u.code}>
                  <details open={here} className={`group rounded-2xl border ${here ? "border-plum bg-lilac" : "border-ink/10 bg-white"}`}>
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-semibold ${accepted ? "bg-emerald-600 text-white" : "bg-plum text-white"}`}>
                        {accepted ? <CheckIcon className="h-5 w-5" /> : i + 1}
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

// Everything under "Resources": the Learner Guide, PowerPoint Presentation and Supporting Document, then any extras
function ResourcesView({ resources }: { resources: Resource[] }) {
  const main = RESOURCE_SLOTS.flatMap((slot) => resources.filter((r) => r.kind === "file" && r.slot === slot.key));
  const extra = resources.filter((r) => !(r.kind === "file" && r.slot));
  return (
    <div className="space-y-10">
      <h2 className="text-xl font-semibold text-ink">Resources</h2>
      {main.map((r) => r.kind === "file" && <FileViewer key={r.id} resource={r} />)}
      {extra.length > 0 && (
        <div className="space-y-5">
          {main.length > 0 && <h3 className="text-lg font-semibold text-ink">More resources</h3>}
          {extra.map((r) =>
            r.kind === "file" ? (
              <FileViewer key={r.id} resource={r} />
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

// A resource file: shown in the page when it's a PDF or picture, always downloadable
function FileViewer({ resource }: { resource: Extract<Resource, { kind: "file" }> }) {
  const f = resource.file;
  const src = `/api/files/${f.id}?inline=1`;
  // Just the document: no browser PDF toolbar or page thumbnails
  const pdfSrc = `${src}#toolbar=0&navpanes=0&view=FitH`;
  const box = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Full screen on this page (Esc also leaves it)
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void box.current?.requestFullscreen?.().catch(() => toast.error("Full screen isn’t available in this browser."));
  };

  return (
    <section aria-label={resource.title} className="space-y-4">
      <div ref={box} className={`flex flex-col overflow-hidden border border-ink/10 bg-ink shadow-md ${full ? "h-dvh rounded-none" : "rounded-[1.5rem]"}`}>
        <div className="flex items-center justify-between gap-3 bg-ink px-5 py-3 text-white">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <FileIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{resource.title}</span>
          </span>
          {(isPdf(f) || isImage(f)) && (
            <button
              type="button"
              onClick={toggleFull}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/25"
            >
              {full ? <CompressIcon className="h-4 w-4" /> : <ExpandIcon className="h-4 w-4" />}
              {full ? "Exit full screen" : "Expand full screen"}
            </button>
          )}
        </div>
        {isPdf(f) ? (
          <iframe src={pdfSrc} title={resource.title} className={`block w-full bg-white ${full ? "flex-1" : "h-[70dvh] min-h-96"}`} />
        ) : isImage(f) ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route
          <img src={src} alt={resource.title} className={`mx-auto block w-auto bg-white ${full ? "max-h-full flex-1 object-contain" : "max-h-[70dvh]"}`} />
        ) : (
          <div className="grid min-h-64 place-items-center bg-lilac px-6 py-12 text-center">
            <div>
              <FileIcon className="mx-auto h-10 w-10 text-plum" />
              <p className="mt-3 text-base font-medium text-ink">This {isSlides(f) ? "PowerPoint presentation" : "Word document"} can’t be shown here.</p>
              <p className="mt-1 text-sm text-ink">Download it below to read it.</p>
            </div>
          </div>
        )}
      </div>
      {resource.description && <p className="whitespace-pre-wrap text-base text-ink">{resource.description}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-dashed border-ink/20 bg-white px-5 py-4">
        <span>
          <span className="block text-base font-semibold text-ink">Download the file</span>
          <span className="block text-sm text-ink">
            {f.name} · {formatBytes(f.size)}
          </span>
        </span>
        <a href={`/api/files/${f.id}`} className="rounded-xl bg-plum px-6 py-3 text-sm font-semibold text-white transition hover:bg-plum-light">
          Download
        </a>
      </div>
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
  const [answers, setAnswers] = useState<(number | null)[]>(() => quiz.questions.map(() => null));
  const [sending, startSending] = useTransition();
  const taking = !pastDue && (!sub || retrying);
  const answered = answers.filter((a) => a !== null).length;

  const submit = () => {
    if (answered < quiz.questions.length) return void toast.error(`Answer all ${quiz.questions.length} questions first.`);
    if (photoRequired) return setAskPhoto(true);
    if (!window.confirm("Submit your quiz? Your trainer will check it.")) return;
    send(null);
  };

  const send = (photoId: string | null) => {
    setAskPhoto(false);
    startSending(async () => {
      const res = await submitQuizAction(courseCode, unitCode, answers as number[], photoId);
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
              <h2 className="text-base font-medium text-ink">Quiz and Activities</h2>
              <p className="mt-0.5 text-xs text-ink/50">
                {quiz.questions.length} questions · pick one answer each · pass mark {quiz.passMark}%
              </p>
            </div>
            <p className="text-xs text-ink/55">
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
                      onChange={() => setAnswers((a) => a.map((v, j) => (j === i ? k : v)))}
                      className="h-4 w-4 accent-peach"
                    />
                    {opt}
                  </label>
                ))}
              </div>
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
              <button onClick={() => setRetrying(false)} className="rounded-full px-5 py-3 text-sm font-medium text-ink/60 hover:bg-lilac">
                Cancel
              </button>
            )}
          </div>
        </>
      )}
      {!sub && pastDue && <p className={`${card} text-sm text-ink/55`}>This unit is closed, so the quiz can’t be taken now.</p>}
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
  const [saving, startSaving] = useTransition();
  const [savedIds, setSavedIds] = useState(() => (sub?.files ?? []).map((f) => f.id).join());
  // every declaration point is ticked on its own, then "I agree" at the end
  const [ticked, setTicked] = useState<boolean[]>(() => declaration.points.map(() => false));
  const [agreed, setAgreed] = useState(false);
  const allTicked = ticked.every(Boolean) && agreed;
  const dirty = canEdit && files.map((f) => f.id).join() !== savedIds;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const send = (mode: "draft" | "submit", photoId: string | null = null) => {
    if (mode === "submit" && !photoId) {
      if (files.length === 0) return void toast.error("Upload your completed work first.");
      if (!ticked.every(Boolean)) return void toast.error("Tick every point of the declaration before you submit.");
      if (!agreed) return void toast.error(`Tick “${declaration.agree}” before you submit.`);
      if (photoRequired) return setAskPhoto(true);
      if (!window.confirm("Submit to your trainer? You can’t change it while they review it.")) return;
    }
    setAskPhoto(false);
    startSaving(async () => {
      const res = await saveWorkAction(courseCode, unitCode, part, { fileIds: files.map((f) => f.id) }, mode, photoId, mode === "submit" && allTicked);
      if (!res.ok) return void toast.error(res.error);
      setSavedIds(files.map((f) => f.id).join());
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
          <p className="mt-0.5 text-sm text-ink">Open the task below, download it, complete it, then upload your work in step 2.</p>
        </div>
        {task.map((f) => (
          <FileViewer key={f.id} resource={{ id: f.id, kind: "file", title: f.name.replace(/\.[^.]+$/, ""), description: "", file: f }} />
        ))}
      </div>

      <div className={`${card} space-y-3`}>
        <div>
          <h3 className="text-lg font-semibold text-ink">2. Upload your completed work</h3>
          <p className="mt-0.5 text-sm text-ink">
            {canEdit ? `You can attach several files (${FILE_RULES.label}, up to ${FILE_RULES.maxFiles}).` : "What you handed in:"}
          </p>
        </div>
        <FileList
          files={files}
          onChange={canEdit ? (next) => setFiles(next.slice(0, FILE_RULES.maxFiles)) : undefined}
          emptyText="No files uploaded."
          uploadLabel="Upload file"
          inputLabel="Upload your completed work"
        />
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
