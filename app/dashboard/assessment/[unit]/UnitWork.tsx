"use client";

import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { BookIcon, CheckIcon, ClockIcon } from "../../_components/icons";
import FileList from "../../_components/FileList";
import ResourceList from "../../_components/ResourceList";
import RichTextEditor from "../../_components/RichTextEditor";
import DueLabel from "../_components/DueLabel";
import LocalTime from "../_components/LocalTime";
import SubmitPhoto from "../_components/SubmitPhoto";
import { saveWorkAction, submitQuizAction } from "../actions";
import { ASSESSMENT_PARTS, summarise, type AssessmentPart, type StudentAssessment } from "@/lib/assessment-meta";
import type { Unit } from "@/lib/courses";
import { statusStyle, type FileRef, type SubmissionDTO } from "@/lib/submission-meta";
import { canEditWork, resultStyle, type Resource, type UnitResultDTO } from "@/lib/unit-meta";

type Subs = Partial<Record<AssessmentPart, SubmissionDTO>>;
type WrittenPart = Exclude<AssessmentPart, "quiz">;

const card = "rounded-[1.5rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] sm:p-6";

const SECTIONS = [
  { key: "overview", label: "Main unit" },
  { key: "resources", label: "Resources" },
  { key: "assessment", label: "Assessment" },
] as const;
type Section = (typeof SECTIONS)[number]["key"];

export default function UnitWork({
  course,
  unit,
  assessment,
  initialSubmissions,
  pastDue,
  photoRequired,
  overview,
  resources,
  outcome,
}: {
  course: { code: string; name: string };
  unit: Unit;
  assessment: StudentAssessment;
  initialSubmissions: Subs;
  pastDue: boolean;
  photoRequired: boolean;
  overview: string;
  resources: Resource[];
  outcome: UnitResultDTO | null;
}) {
  // A final result or a passed deadline both close the unit
  const closed = pastDue || !!outcome;
  const [subs, setSubs] = useState(initialSubmissions);
  const set = summarise(assessment);
  // Students only see what the Super Admin has actually written or uploaded
  const parts = ASSESSMENT_PARTS.filter((p) => set[p.key]);
  const sections = SECTIONS.filter((s) =>
    s.key === "overview" ? !!overview : s.key === "resources" ? resources.length > 0 : parts.length > 0,
  );
  const [section, setSection] = useState<Section | undefined>(sections[0]?.key);
  const nextSection = sections[sections.findIndex((s) => s.key === section) + 1];
  const firstPart = parts[0]?.key ?? "quiz";
  const [tab, setTab] = useState<AssessmentPart>(firstPart);
  const update = (s: SubmissionDTO) => setSubs((prev) => ({ ...prev, [s.part]: s }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-plum">
            {course.code} · {course.name}
          </p>
          <h1 className="mt-1 text-2xl font-medium text-ink sm:text-[1.65rem]">
            {unit.code} – {unit.title}
          </h1>
        </div>
        <DueLabel dueAt={assessment.dueAt} />
      </div>

      {outcome && (
        <div className={`rounded-[1.5rem] px-5 py-4 ${outcome.result === "Pass" ? "bg-emerald-50 text-emerald-900" : outcome.result === "Fail" ? "bg-rose-50 text-rose-900" : "bg-ink/5 text-ink"}`}>
          <p className="text-[11px] font-medium uppercase tracking-wide opacity-60">Unit outcome</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-lg font-medium">
            Final result:
            <span className={`rounded-full px-3 py-0.5 text-sm ${resultStyle[outcome.result]}`}>{outcome.result}</span>
          </p>
          {outcome.feedback && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{outcome.feedback}</p>}
          <p className="mt-2 text-[11px] opacity-60">
            {outcome.decidedBy} · <LocalTime iso={outcome.decidedAt} />
          </p>
        </div>
      )}
      {pastDue && !outcome && (
        <p className="rounded-2xl bg-rose-50 px-5 py-3 text-sm text-rose-700">
          The due date has passed, so this unit is closed. Contact the college if you need more time.
        </p>
      )}

      {sections.length === 0 && (
        <p className={`${card} text-center text-sm text-ink/55`}>
          The college hasn’t added anything to this unit yet. Check back soon.
        </p>
      )}

      <div role="tablist" aria-label="Unit sections" className="flex flex-wrap gap-2">
        {sections.map((s, i) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={section === s.key}
            onClick={() => setSection(s.key)}
            className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${
              section === s.key ? "bg-ink text-white" : "bg-lilac text-ink/70 hover:bg-plum/10"
            }`}
          >
            {i + 1}. {s.label}
            {s.key === "resources" && resources.length > 0 && <span className="ml-1.5 opacity-60">({resources.length})</span>}
          </button>
        ))}
      </div>

      {section === "overview" && (
        // Overview HTML is sanitised on the server (lib/sanitize.ts)
        <div className={`${card} rich-text text-sm leading-relaxed text-ink`} dangerouslySetInnerHTML={{ __html: overview }} />
      )}

      {section === "resources" && <ResourceList resources={resources} />}

      {section !== "assessment" && nextSection && (
        <button
          onClick={() => setSection(nextSection.key)}
          className="inline-flex items-center gap-2 rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition hover:bg-plum-light"
        >
          <BookIcon className="h-4 w-4" />
          {nextSection.key === "resources" ? "Next: read the resources" : "Next: start the assessment"}
        </button>
      )}

      {section === "assessment" && (
      <>
      <div
        role="tablist"
        aria-label="Assessment parts"
        className={`grid gap-2 sm:grid-cols-2 ${parts.length >= 4 ? "xl:grid-cols-4" : parts.length === 3 ? "xl:grid-cols-3" : ""}`}
      >
        {parts.map((p, i) => {
          const active = tab === p.key;
          const status = subs[p.key]?.status ?? "Not started";
          return (
            <button
              key={p.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(p.key)}
              className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-left transition ${
                active ? "bg-plum text-white shadow-md shadow-plum/20" : "bg-lilac text-ink hover:bg-plum/10"
              }`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-medium ${
                  status === "Accepted" ? "bg-emerald-400 text-white" : active ? "bg-white/20" : "bg-white text-plum"
                }`}
              >
                {status === "Accepted" ? <CheckIcon className="h-4 w-4" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{p.label}</span>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle[status]}`}>{status}</span>
              </span>
            </button>
          );
        })}
      </div>

      {!set[tab] ? (
        <p className={`${card} text-center text-sm text-ink/50`}>The college hasn’t set up this part for {unit.code} yet.</p>
      ) : tab === "quiz" ? (
        <QuizPart unitCode={unit.code} quiz={assessment.quiz} sub={subs.quiz} pastDue={closed} photoRequired={photoRequired} onSaved={update} />
      ) : (
        <WrittenWork key={tab} part={tab} unitCode={unit.code} assessment={assessment} sub={subs[tab]} pastDue={closed} photoRequired={photoRequired} onSaved={update} />
      )}
      </>
      )}
    </div>
  );
}

// ---------- Status + feedback ----------

function Outcome({ sub }: { sub: SubmissionDTO }) {
  if (sub.status === "Draft") {
    return <p className="rounded-2xl bg-sky-50 px-5 py-3 text-sm text-sky-800">Draft saved — not sent yet. Submit when you’re ready.</p>;
  }
  if (sub.status === "Submitted") {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-amber-50 px-5 py-3 text-sm text-amber-800">
        <ClockIcon className="h-4 w-4 shrink-0" />
        Submitted{sub.submittedAt && <> on <LocalTime iso={sub.submittedAt} /></>} — waiting for your trainer to review it.
      </p>
    );
  }
  const accepted = sub.status === "Accepted";
  return (
    <div className={`rounded-2xl px-5 py-4 ${accepted ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>
      <p className="text-sm font-medium">
        {accepted ? "Accepted ✓" : "Not accepted yet — please fix and resubmit"}
        {sub.attempt > 1 && <span className="font-normal opacity-70"> · attempt {sub.attempt}</span>}
      </p>
      {sub.feedback && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{sub.feedback}</p>}
      {sub.decidedBy && (
        <p className="mt-2 text-[11px] opacity-70">
          {sub.decidedBy}
          {sub.decidedAt && <> · <LocalTime iso={sub.decidedAt} /></>}
        </p>
      )}
      {sub.history.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer opacity-70">Earlier feedback ({sub.history.length})</summary>
          <ul className="mt-2 space-y-2">
            {sub.history.map((h) => (
              <li key={h.attempt} className="rounded-xl bg-white/60 px-3 py-2">
                <span className="font-medium">Attempt {h.attempt} · {h.status}</span> — {h.feedback || "No comment"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ---------- Online quiz ----------

function QuizPart({
  unitCode,
  quiz,
  sub,
  pastDue,
  photoRequired,
  onSaved,
}: {
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
    if (!window.confirm("Submit your quiz? It’s marked straight away.")) return;
    send(null);
  };

  const send = (photoId: string | null) => {
    setAskPhoto(false);
    startSending(async () => {
      const res = await submitQuizAction(unitCode, answers as number[], photoId);
      if (!res.ok) return void toast.error(res.error);
      onSaved(res.submission);
      setRetrying(false);
      toast[res.submission.status === "Accepted" ? "success" : "error"](res.submission.status === "Accepted" ? "Quiz passed!" : "Not passed this time");
    });
  };

  return (
    <section className="space-y-4">
      {sub && !retrying && <Outcome sub={sub} />}
      {sub?.status === "Rejected" && !retrying && !pastDue && (
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
              <h2 className="text-base font-medium text-ink">Online quiz</h2>
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
              {sending ? "Marking…" : "Submit quiz"}
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

// ---------- Theory / role play / workplace ----------

function WrittenWork({
  part,
  unitCode,
  assessment,
  sub,
  pastDue,
  photoRequired,
  onSaved,
}: {
  part: WrittenPart;
  unitCode: string;
  assessment: StudentAssessment;
  sub: SubmissionDTO | undefined;
  pastDue: boolean;
  photoRequired: boolean;
  onSaved: (s: SubmissionDTO) => void;
}) {
  const [askPhoto, setAskPhoto] = useState(false);
  const canEdit = canEditWork(sub?.status, pastDue, false);
  const questions = assessment.theory.questions;
  const initial = () => ({
    theory: questions.map((q) => sub?.content.theory?.find((t) => t.questionId === q.id)?.html ?? ""),
    theoryFiles: questions.map((q) => sub?.content.theory?.find((t) => t.questionId === q.id)?.files ?? ([] as FileRef[])),
    html: sub?.content.html ?? "",
    supervisor: sub?.content.supervisor ?? "",
    evidenceFiles: assessment.workplace.evidence.map(
      (e) => sub?.content.evidence?.find((x) => x.evidenceId === e.id)?.files ?? ([] as FileRef[]),
    ),
    files: sub?.files ?? ([] as FileRef[]),
  });
  const [work, setWork] = useState(initial);
  const [saving, startSaving] = useTransition();
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(work));
  const dirty = canEdit && JSON.stringify(work) !== savedJson;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const send = (mode: "draft" | "submit", photoId: string | null = null) => {
    if (mode === "submit" && !photoId) {
      if (photoRequired) return setAskPhoto(true);
      if (!window.confirm("Submit to your trainer? You can’t change it while they review it.")) return;
    }
    setAskPhoto(false);
    startSaving(async () => {
      const res = await saveWorkAction(
        unitCode,
        part,
        {
          theory: questions.map((q, i) => ({ questionId: q.id, html: work.theory[i], fileIds: work.theoryFiles[i].map((f) => f.id) })),
          html: work.html,
          supervisor: work.supervisor,
          evidence: assessment.workplace.evidence.map((e, i) => ({ evidenceId: e.id, fileIds: work.evidenceFiles[i].map((f) => f.id) })),
          fileIds: work.files.map((f) => f.id),
        },
        mode,
        photoId,
      );
      if (!res.ok) return void toast.error(res.error);
      setSavedJson(JSON.stringify(work));
      onSaved(res.submission);
      toast.success(mode === "submit" ? "Submitted to your trainer" : "Draft saved");
    });
  };

  const brief =
    part === "theory" ? (
      <p className="text-sm text-ink/60">Answer each question below — type your answer like in Word, upload a document for that question, or both.</p>
    ) : part === "rolePlay" ? (
      <div className="space-y-3 text-sm leading-relaxed text-ink/80">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink/45">Scenario</p>
          <p className="mt-1 whitespace-pre-wrap">{assessment.rolePlay.scenario}</p>
        </div>
        {assessment.rolePlay.instructions && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink/45">What to do</p>
            <p className="mt-1 whitespace-pre-wrap">{assessment.rolePlay.instructions}</p>
          </div>
        )}
        {assessment.rolePlay.criteria.length > 0 && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink/45">Your trainer will look for</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {assessment.rolePlay.criteria.map((c) => (
                <li key={c.id}>{c.text}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    ) : (
      <div className="space-y-3 text-sm leading-relaxed text-ink/80">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink/45">Task</p>
          <p className="mt-1 whitespace-pre-wrap">{assessment.workplace.task}</p>
        </div>
      </div>
    );

  const readOnlyHtml = (html: string) =>
    html ? (
      // Stored HTML is sanitised on the server (lib/sanitize.ts)
      <div className="rich-text rounded-xl bg-lilac/50 px-4 py-3 text-sm leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: html }} />
    ) : (
      <p className="text-xs text-ink/45">Nothing written.</p>
    );

  const label = ASSESSMENT_PARTS.find((p) => p.key === part)!.label;

  return (
    <section className="space-y-4">
      {sub && <Outcome sub={sub} />}
      <div className={card}>
        <h2 className="mb-3 text-base font-medium text-ink">{label}</h2>
        {brief}
      </div>

      {part === "workplace" && assessment.workplace.evidence.length > 0 && (
        <div className={card}>
          <h3 className="text-sm font-medium text-ink">Evidence to upload</h3>
          <p className="mt-0.5 text-xs text-ink/50">Upload at least one file for each item below.</p>
          <ol className="mt-4 space-y-3">
            {assessment.workplace.evidence.map((e, i) => (
              <li key={e.id} className="rounded-2xl bg-lilac/40 p-4">
                <p className="flex items-start gap-3 text-sm font-medium text-ink">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] ${
                      work.evidenceFiles[i].length ? "bg-emerald-400 text-white" : "bg-white text-plum"
                    }`}
                  >
                    {work.evidenceFiles[i].length ? "✓" : i + 1}
                  </span>
                  <span className="pt-0.5">{e.text}</span>
                </p>
                <div className="mt-3 pl-9">
                  <FileList
                    files={work.evidenceFiles[i]}
                    onChange={
                      canEdit
                        ? (files) => setWork((w) => ({ ...w, evidenceFiles: w.evidenceFiles.map((f, j) => (j === i ? files : f)) }))
                        : undefined
                    }
                    emptyText="Nothing uploaded."
                    uploadLabel="Upload file"
                    inputLabel={`Upload evidence ${i + 1}`}
                  />
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {part === "theory" ? (
        questions.map((q, i) => (
          <div key={q.id} className={card}>
            <p className="flex gap-3 text-sm font-medium text-ink">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-lilac text-[11px] text-plum">{i + 1}</span>
              <span className="pt-1">{q.text}</span>
            </p>
            {q.guidance && <p className="mt-2 pl-10 text-xs text-ink/50">{q.guidance}</p>}
            <div className="mt-3 pl-0 sm:pl-10">
              {canEdit ? (
                <RichTextEditor
                  label={`Answer to question ${i + 1}`}
                  value={work.theory[i]}
                  onChange={(html) => setWork((w) => ({ ...w, theory: w.theory.map((t, j) => (j === i ? html : t)) }))}
                  placeholder="Type your answer…"
                  wordLimit={q.wordLimit}
                  minHeight="8rem"
                />
              ) : (
                readOnlyHtml(work.theory[i])
              )}
              {(canEdit || work.theoryFiles[i].length > 0) && (
                <div className="mt-3">
                  <FileList
                    files={work.theoryFiles[i]}
                    onChange={
                      canEdit
                        ? (files) => setWork((w) => ({ ...w, theoryFiles: w.theoryFiles.map((f, j) => (j === i ? files : f)) }))
                        : undefined
                    }
                    uploadLabel={`Upload document for question ${i + 1}`}
                  />
                </div>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className={card}>
          {part === "workplace" && assessment.workplace.supervisorSignOff && (
            <label className="mb-4 block">
              <span className="text-[11px] font-medium text-ink/50">Workplace supervisor’s name (they sign off this task)</span>
              {canEdit ? (
                <input
                  value={work.supervisor}
                  maxLength={120}
                  onChange={(e) => setWork((w) => ({ ...w, supervisor: e.target.value }))}
                  placeholder="e.g. Jane Smith, Team Leader"
                  className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/10 focus:ring-plum/40"
                />
              ) : (
                <p className="mt-1 text-sm text-ink">{work.supervisor || "—"}</p>
              )}
            </label>
          )}
          <p className="mb-2 text-[11px] font-medium text-ink/50">
            {part === "rolePlay" ? "Your role-play plan or reflection" : "Your workplace report (optional)"}
          </p>
          {canEdit ? (
            <RichTextEditor
              label={part === "rolePlay" ? "Role play response" : "Workplace report"}
              value={work.html}
              onChange={(html) => setWork((w) => ({ ...w, html }))}
              placeholder={part === "rolePlay" ? "Describe how you handled the scenario…" : "Describe what you did at your workplace…"}
            />
          ) : (
            readOnlyHtml(work.html)
          )}
          {/* Documents sit right under the answer, like theory questions */}
          <div className="mt-3">
            <p className="mb-2 text-[11px] font-medium text-ink/50">
              {part === "rolePlay"
                ? "Upload your role-play script, recording notes or signed observation sheet (optional)"
                : "Other documents (optional)"}
            </p>
            <FileList
              files={work.files}
              onChange={canEdit ? (files) => setWork((w) => ({ ...w, files })) : undefined}
              emptyText="No documents uploaded."
              uploadLabel={part === "rolePlay" ? "Upload document" : "Upload other document"}
            />
          </div>
        </div>
      )}

      {/* Theory uploads live under each question; this box only shows older whole-part uploads there */}
      {part === "theory" && work.files.length > 0 && (
        <div className={card}>
          <h3 className="mb-3 text-sm font-medium text-ink">Documents for the whole theory part</h3>
          <FileList
            files={work.files}
            onChange={canEdit ? (files) => setWork((w) => ({ ...w, files })) : undefined}
            emptyText="No documents uploaded."
          />
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => send("submit")}
            disabled={saving}
            className="rounded-full bg-plum px-6 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Saving…" : sub?.status === "Rejected" ? "Resubmit to trainer" : "Submit to trainer"}
          </button>
          <button
            onClick={() => send("draft")}
            disabled={saving || !dirty}
            className="rounded-full bg-lilac px-6 py-3 text-sm font-medium text-plum transition hover:bg-plum/10 disabled:opacity-50"
          >
            Save draft
          </button>
          {dirty && <span className="text-xs text-ink/45">Unsaved changes</span>}
        </div>
      )}
      {askPhoto && (
        <SubmitPhoto title="Submit to your trainer" onCancel={() => setAskPhoto(false)} onConfirm={(p) => send("submit", p.id)} />
      )}
    </section>
  );
}
