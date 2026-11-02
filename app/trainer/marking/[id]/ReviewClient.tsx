"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { CheckIcon, CloseIcon } from "../../../dashboard/_components/icons";
import FileList from "../../../dashboard/_components/FileList";
import LocalTime from "../../../dashboard/assessment/_components/LocalTime";
import { decideAction } from "../actions";
import { ASSESSMENT_PARTS, type TheoryQuestion, type UnitAssessment } from "@/lib/assessment-meta";
import { statusLabel, statusStyle, type Decision, type SubmissionDTO } from "@/lib/submission-meta";

const DECISION_BUTTONS: { status: Decision; className: string }[] = [
  { status: "Accepted", className: "bg-emerald-600 hover:bg-emerald-700" },
  { status: "Rejected", className: "bg-rose-600 hover:bg-rose-700" },
  { status: "MoreDocs", className: "bg-orange-600 hover:bg-orange-700" },
];

const card = "rounded-[1.5rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] sm:p-6";

// Student HTML is sanitised on the server before it is stored (lib/sanitize.ts)
const Answer = ({ html }: { html: string | undefined }) =>
  html ? (
    <div className="rich-text rounded-xl bg-lilac/50 px-4 py-3 text-sm leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <p className="rounded-xl bg-lilac/40 px-4 py-3 text-xs text-ink/45">Nothing typed — check the uploaded documents.</p>
  );

export default function ReviewClient({
  initialSubmission,
  theory,
  rolePlay,
  workplace,
  canMark,
}: {
  initialSubmission: SubmissionDTO;
  theory: TheoryQuestion[];
  rolePlay: UnitAssessment["rolePlay"];
  workplace: UnitAssessment["workplace"];
  canMark: boolean;
}) {
  const [s, setS] = useState(initialSubmission);
  const [feedback, setFeedback] = useState(initialSubmission.feedback);
  const [criteria, setCriteria] = useState<string[]>(initialSubmission.criteriaMet);
  const [saving, startSaving] = useTransition();
  const pending = s.status === "Submitted";
  const label = ASSESSMENT_PARTS.find((p) => p.key === s.part)!.label;

  const mark = (status: Decision) => {
    if (status !== "Accepted" && !feedback.trim()) {
      return void toast.error(status === "MoreDocs" ? "Write which documents the student needs to add." : "Write what the student needs to fix first.");
    }
    if (!window.confirm(`Mark this ${label} as “${statusLabel[status]}”? The student will see it.`)) return;
    startSaving(async () => {
      const res = await decideAction(s.submissionId, { status, feedback, criteriaMet: criteria });
      if (!res.ok) return void toast.error(res.error);
      setS(res.submission);
      toast.success(`Marked ${statusLabel[status]} — the student can see it now`);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-plum">
            {label} · {s.courseCode}
          </p>
          <h1 className="mt-1 text-2xl font-medium text-ink sm:text-[1.65rem]">
            {s.unitCode} – {s.unitTitle}
          </h1>
          <p className="mt-1 text-sm text-ink/55">
            {s.studentName} ({s.studentId}) · attempt {s.attempt}
            {s.submittedAt && (
              <>
                {" "}· submitted <LocalTime iso={s.submittedAt} />
              </>
            )}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-sm font-medium ${statusStyle[s.status]}`}>{statusLabel[s.status]}</span>
      </div>

      {s.history.length > 0 && (
        <div className="rounded-2xl bg-lilac/70 px-5 py-3 text-xs text-ink/70">
          <p className="font-medium text-ink">Earlier attempts</p>
          <ul className="mt-1 space-y-1">
            {s.history.map((h) => (
              <li key={h.attempt}>
                Attempt {h.attempt} — {statusLabel[h.status]} by {h.decidedBy}: {h.feedback || "no comment"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.part === "theory" &&
        theory.map((q, i) => (
          <div key={q.id} className={card}>
            <p className="flex gap-3 text-sm font-medium text-ink">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-lilac text-[11px] text-plum">{i + 1}</span>
              <span className="pt-1">{q.text}</span>
            </p>
            {q.wordLimit && <p className="mt-1 pl-10 text-[11px] text-ink/45">Word limit {q.wordLimit}</p>}
            <div className="mt-3 space-y-2 sm:pl-10">
              <Answer html={s.content.theory?.find((t) => t.questionId === q.id)?.html} />
              {!!s.content.theory?.find((t) => t.questionId === q.id)?.files?.length && (
                <FileList files={s.content.theory.find((t) => t.questionId === q.id)!.files!} />
              )}
            </div>
          </div>
        ))}

      {s.part === "rolePlay" && (
        <>
          <div className={`${card} space-y-2 text-sm text-ink/80`}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink/45">Scenario</p>
            <p className="whitespace-pre-wrap">{rolePlay.scenario}</p>
          </div>
          <div className={card}>
            <p className="mb-2 text-[11px] font-medium text-ink/50">Student’s response</p>
            <Answer html={s.content.html} />
          </div>
          {rolePlay.criteria.length > 0 && (
            <div className={card}>
              <h2 className="text-sm font-medium text-ink">Observation checklist</h2>
              <p className="mt-0.5 text-xs text-ink/50">Tick what the student showed.</p>
              <ul className="mt-3 space-y-2">
                {rolePlay.criteria.map((c) => (
                  <li key={c.id}>
                    <label className={`flex items-center gap-3 rounded-xl bg-lilac/60 px-4 py-2.5 text-sm text-ink ${pending && canMark ? "cursor-pointer" : ""}`}>
                      <input
                        type="checkbox"
                        disabled={!pending || !canMark}
                        checked={criteria.includes(c.id)}
                        onChange={(e) => setCriteria((list) => (e.target.checked ? [...list, c.id] : list.filter((x) => x !== c.id)))}
                        className="h-4 w-4 accent-plum"
                      />
                      {c.text}
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-ink/45">
                {criteria.length} of {rolePlay.criteria.length} met
              </p>
            </div>
          )}
        </>
      )}

      {s.part === "workplace" && (
        <>
          <div className={`${card} space-y-3 text-sm text-ink/80`}>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink/45">Task</p>
              <p className="mt-1 whitespace-pre-wrap">{workplace.task}</p>
            </div>
            {workplace.supervisorSignOff && (
              <p className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-800">
                Supervisor sign-off required · student named: <b>{s.content.supervisor || "—"}</b>
              </p>
            )}
          </div>
          {workplace.evidence.length > 0 && (
            <div className={card}>
              <h2 className="text-sm font-medium text-ink">Evidence uploaded</h2>
              <ol className="mt-3 space-y-3">
                {workplace.evidence.map((e, i) => {
                  const files = s.content.evidence?.find((x) => x.evidenceId === e.id)?.files ?? [];
                  return (
                    <li key={e.id} className="rounded-2xl bg-lilac/40 p-4">
                      <p className="text-sm font-medium text-ink">
                        {i + 1}. {e.text}
                      </p>
                      <div className="mt-2">
                        <FileList files={files} emptyText="Nothing uploaded for this item." />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
          <div className={card}>
            <p className="mb-2 text-[11px] font-medium text-ink/50">Student’s workplace report</p>
            <Answer html={s.content.html} />
          </div>
        </>
      )}

      {(s.part !== "theory" || s.files.length > 0) && (
        <div className={card}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-ink">Uploaded documents</h2>
            {s.content.declaration && (
              <a href={`/declaration/${s.submissionId}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-plum/40 px-4 py-2 text-sm font-medium text-plum transition hover:bg-lilac">
                Declaration certificate
              </a>
            )}
            {s.content.declaration && (
              <a href={`/api/declaration/${s.submissionId}`} className="rounded-full bg-plum px-4 py-2 text-sm font-medium text-white transition hover:bg-plum-light">
                Download declaration (PDF)
              </a>
            )}
          </div>
          <FileList files={s.files} emptyText="The student didn’t upload any documents." />
        </div>
      )}

      {s.part === "quiz" && s.content.score && (
        <div className={card}>
          <h2 className="text-base font-medium text-ink">Quiz result</h2>
          <p className="mt-1 text-lg font-semibold text-ink">
            {s.content.score.correct} / {s.content.score.total} correct ({s.content.score.percent}%)
          </p>
        </div>
      )}

      {!pending && s.decidedBy && (
        <div
          className={`rounded-2xl px-5 py-4 ${s.status === "Accepted" ? "bg-emerald-50 text-emerald-900" : s.status === "MoreDocs" ? "bg-orange-50 text-orange-900" : "bg-rose-50 text-rose-900"}`}
        >
          <p className="text-base font-semibold">
            {statusLabel[s.status]} — {s.decidedBy}
            {s.decidedAt && (
              <span className="text-sm font-normal">
                {" "}· <LocalTime iso={s.decidedAt} />
              </span>
            )}
          </p>
          {s.feedback && <p className="mt-1 whitespace-pre-wrap text-sm">{s.feedback}</p>}
        </div>
      )}

      {canMark ? (
        <div className={`${card} space-y-4`}>
          <div>
            <h2 className="text-base font-semibold text-ink">{pending ? "Set the status" : "Change the status"}</h2>
            <p className="mt-0.5 text-sm text-ink">The student sees the status and your feedback straight away.</p>
          </div>
          <textarea
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            maxLength={4000}
            placeholder="Feedback for the student — required for Not Yet Satisfactory and Request More Documents (say what to fix or which documents to add)."
            aria-label="Feedback"
            className="w-full resize-y rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/15 placeholder:text-ink/60 focus:ring-plum/40"
          />
          <div className="flex flex-wrap gap-3">
            {DECISION_BUTTONS.map((d) => (
              <button
                key={d.status}
                onClick={() => mark(d.status)}
                disabled={saving || s.status === d.status}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition disabled:opacity-50 ${d.className}`}
              >
                {d.status === "Accepted" ? <CheckIcon className="h-4 w-4" /> : d.status === "Rejected" ? <CloseIcon className="h-4 w-4" /> : null}
                {statusLabel[d.status]}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-2xl bg-amber-50 px-5 py-3 text-sm text-amber-800">
          Super Admin has turned off assessment marking for trainers, so you can read this but not mark it.
        </p>
      )}
    </div>
  );
}
