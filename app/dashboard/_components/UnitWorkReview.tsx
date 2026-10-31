"use client";

import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";
import FileList from "./FileList";
import LocalTime from "../assessment/_components/LocalTime";
import { CheckIcon } from "./icons";
import { ASSESSMENT_PARTS, summarise, type AssessmentPart, type UnitAssessment } from "@/lib/assessment-meta";
import type { Unit } from "@/lib/courses";
import { statusStyle, type SubmissionDTO } from "@/lib/submission-meta";
import { resultStyle, type UnitResultDTO } from "@/lib/unit-meta";

const card = "rounded-[1.5rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] sm:p-6";

// Student HTML is sanitised on the server before it is stored (lib/sanitize.ts)
const Html = ({ html, empty = "Nothing typed." }: { html?: string; empty?: string }) =>
  html ? (
    <div className="rich-text rounded-xl bg-lilac/50 px-4 py-3 text-sm leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <p className="rounded-xl bg-lilac/30 px-4 py-3 text-xs text-ink/45">{empty}</p>
  );

// Everything a student handed in for one unit, one assessment part per tab.
// Used by Super Admin (with submit photos) and trainers; `reviewBase` is where "Review & mark" goes.
export default function UnitWorkReview({
  student,
  course,
  unit,
  assessment,
  submissions,
  outcome,
  reviewBase,
}: {
  student: { studentId: string; name: string };
  course: { code: string; name: string };
  unit: Unit;
  assessment: UnitAssessment;
  submissions: Partial<Record<AssessmentPart, SubmissionDTO>>;
  outcome: UnitResultDTO | null;
  reviewBase: string;
}) {
  const set = summarise(assessment);
  const parts = ASSESSMENT_PARTS.filter((p) => set[p.key]);
  const [photo, setPhoto] = useState<{ id: string; caption: string } | null>(null);
  // Open on the first part waiting to be marked, else the first part
  const [tab, setTab] = useState<AssessmentPart | undefined>(
    (parts.find((p) => submissions[p.key]?.status === "Submitted") ?? parts[0])?.key,
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-plum">
          {student.name} ({student.studentId}) · {course.code}
        </p>
        <h1 className="mt-1 text-2xl font-medium text-ink sm:text-[1.65rem]">
          {unit.code} – {unit.title}
        </h1>
        {outcome && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink/70">
            Final result
            <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${resultStyle[outcome.result]}`}>{outcome.result}</span>
            {outcome.feedback && <span className="text-ink/50">— {outcome.feedback}</span>}
          </p>
        )}
      </div>

      {parts.length === 0 && <p className={`${card} text-sm text-ink/55`}>No assessment is set up for this unit yet.</p>}

      {parts.length > 0 && (
        <div role="tablist" aria-label="Assessment parts" className={`grid gap-2 sm:grid-cols-2 ${parts.length >= 4 ? "xl:grid-cols-4" : parts.length === 3 ? "xl:grid-cols-3" : ""}`}>
          {parts.map((p, i) => {
            const active = tab === p.key;
            const status = submissions[p.key]?.status ?? "Not started";
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
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle[status]}`}>
                    {status === "Submitted" ? "To mark" : status}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {parts.filter((p) => p.key === tab).map((p) => {
        const s = submissions[p.key];
        return (
          <section key={p.key} className={`${card} space-y-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-ink">{p.label}</h2>
                {s ? (
                  <p className="mt-0.5 text-xs text-ink/50">
                    Attempt {s.attempt}
                    {s.submittedAt ? (
                      <>
                        {" "}· submitted <LocalTime iso={s.submittedAt} />
                      </>
                    ) : (
                      " · draft, not submitted"
                    )}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-ink/45">Not started</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {s?.photo && (
                  <button
                    onClick={() => setPhoto({ id: s.photo!.id, caption: `${p.label} · ${unit.code}` })}
                    className="flex items-center gap-2 rounded-xl bg-lilac/60 p-1 pr-3 text-[11px] text-ink/70 transition hover:text-plum"
                    title="Photo taken when submitting"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route */}
                    <img src={`/api/files/${s.photo.id}`} alt={`Submit photo for ${p.label}`} className="h-10 w-10 rounded-lg object-cover" />
                    Submit photo
                  </button>
                )}
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyle[s?.status ?? "Not started"]}`}>{s?.status ?? "Not started"}</span>
              </div>
            </div>

            {s && <PartContent part={p.key} s={s} assessment={assessment} />}

            {s && (s.status === "Accepted" || s.status === "Rejected") && (
              <div className={`rounded-xl px-4 py-3 text-sm ${s.status === "Accepted" ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>
                <p className="font-medium">
                  {s.status} by {s.decidedBy}
                  {s.decidedAt && (
                    <span className="font-normal opacity-70">
                      {" "}· <LocalTime iso={s.decidedAt} />
                    </span>
                  )}
                </p>
                {s.feedback && <p className="mt-1 whitespace-pre-wrap">{s.feedback}</p>}
              </div>
            )}
            {s && s.history.length > 0 && (
              <details className="text-xs text-ink/60">
                <summary className="cursor-pointer">Earlier attempts ({s.history.length})</summary>
                <ul className="mt-2 space-y-1">
                  {s.history.map((h) => (
                    <li key={h.attempt}>
                      Attempt {h.attempt} — {h.status} by {h.decidedBy}: {h.feedback || "no comment"}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {s?.status === "Submitted" && p.key !== "quiz" && (
              <Link
                href={`${reviewBase}/${s.submissionId}`}
                className="inline-flex rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition hover:bg-plum-light"
              >
                Review &amp; mark
              </Link>
            )}
          </section>
        );
      })}

      {photo &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/70 p-4 font-dm" onMouseDown={(e) => e.target === e.currentTarget && setPhoto(null)}>
            <figure className="max-w-lg overflow-hidden rounded-[1.5rem] bg-white shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route */}
              <img src={`/api/files/${photo.id}`} alt={photo.caption} className="max-h-[70dvh] w-full object-contain" />
              <figcaption className="flex items-center justify-between gap-4 px-5 py-3 text-sm text-ink">
                {photo.caption}
                <button onClick={() => setPhoto(null)} className="rounded-full bg-lilac px-4 py-1.5 text-xs font-medium text-plum hover:bg-plum/10">
                  Close
                </button>
              </figcaption>
            </figure>
          </div>,
          document.getElementById("portal-root") ?? document.body,
        )}
    </div>
  );
}

function PartContent({ part, s, assessment }: { part: AssessmentPart; s: SubmissionDTO; assessment: UnitAssessment }) {
  if (part === "quiz") {
    const answers = s.content.quizAnswers ?? [];
    return (
      <div className="space-y-3">
        {s.content.score && (
          <p className="text-sm text-ink">
            Score <b>{s.content.score.correct}/{s.content.score.total}</b> ({s.content.score.percent}%) · pass mark {assessment.quiz.passMark}%
          </p>
        )}
        <ol className="space-y-3">
          {assessment.quiz.questions.map((q, i) => (
            <li key={q.id} className="rounded-xl bg-lilac/30 p-4">
              <p className="text-sm font-medium text-ink">
                {i + 1}. {q.text}
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {q.options.map((o, k) => {
                  const chosen = answers[i] === k;
                  const correct = q.answer === k;
                  return (
                    <li
                      key={k}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${
                        chosen ? (correct ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800") : correct ? "text-emerald-700" : "text-ink/60"
                      }`}
                    >
                      <span className="w-28 shrink-0 text-[10px] font-medium uppercase">
                        {chosen && correct ? "Student ✓ correct" : chosen ? "Student’s answer" : correct ? "Correct answer" : ""}
                      </span>
                      {o}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (part === "theory") {
    return (
      <ol className="space-y-4">
        {assessment.theory.questions.map((q, i) => {
          const a = s.content.theory?.find((t) => t.questionId === q.id);
          return (
            <li key={q.id} className="space-y-2">
              <p className="text-sm font-medium text-ink">
                {i + 1}. {q.text}
              </p>
              <Html html={a?.html} />
              {!!a?.files?.length && <FileList files={a.files} />}
            </li>
          );
        })}
        {s.files.length > 0 && (
          <li>
            <p className="mb-2 text-[11px] font-medium text-ink/50">Documents for the whole part</p>
            <FileList files={s.files} />
          </li>
        )}
      </ol>
    );
  }

  if (part === "rolePlay") {
    return (
      <div className="space-y-3">
        <Html html={s.content.html} />
        <FileList files={s.files} emptyText="No documents uploaded." />
        {assessment.rolePlay.criteria.length > 0 && s.status !== "Submitted" && s.status !== "Draft" && (
          <div className="rounded-xl bg-lilac/30 p-4">
            <p className="text-[11px] font-medium text-ink/50">Observation checklist (ticked by the marker)</p>
            <ul className="mt-2 space-y-1 text-sm">
              {assessment.rolePlay.criteria.map((c) => (
                <li key={c.id} className={s.criteriaMet.includes(c.id) ? "text-emerald-700" : "text-ink/45"}>
                  {s.criteriaMet.includes(c.id) ? "✓" : "–"} {c.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // workplace
  return (
    <div className="space-y-3">
      {assessment.workplace.supervisorSignOff && (
        <p className="text-sm text-ink/70">
          Workplace supervisor: <b className="text-ink">{s.content.supervisor || "—"}</b>
        </p>
      )}
      {assessment.workplace.evidence.length > 0 && (
        <ol className="space-y-3">
          {assessment.workplace.evidence.map((e, i) => (
            <li key={e.id} className="rounded-xl bg-lilac/30 p-4">
              <p className="text-sm font-medium text-ink">
                {i + 1}. {e.text}
              </p>
              <div className="mt-2">
                <FileList files={s.content.evidence?.find((x) => x.evidenceId === e.id)?.files ?? []} emptyText="Nothing uploaded for this item." />
              </div>
            </li>
          ))}
        </ol>
      )}
      <div>
        <p className="mb-2 text-[11px] font-medium text-ink/50">Workplace report</p>
        <Html html={s.content.html} />
      </div>
      {s.files.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium text-ink/50">Other documents</p>
          <FileList files={s.files} />
        </div>
      )}
    </div>
  );
}
