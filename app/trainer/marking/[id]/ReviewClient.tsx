"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { CheckIcon, CloseIcon } from "../../../dashboard/_components/icons";
import FileList from "../../../dashboard/_components/FileList";
import LocalTime from "../../../dashboard/assessment/_components/LocalTime";
import { decideAction } from "../actions";
import { ASSESSMENT_PARTS, type TheoryQuestion, type UnitAssessment } from "@/lib/assessment-meta";
import { statusStyle, type SubmissionDTO } from "@/lib/submission-meta";

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
  const [feedback, setFeedback] = useState("");
  const [criteria, setCriteria] = useState<string[]>(initialSubmission.criteriaMet);
  const [saving, startSaving] = useTransition();
  const pending = s.status === "Submitted";
  const label = ASSESSMENT_PARTS.find((p) => p.key === s.part)!.label;

  const mark = (status: "Accepted" | "Rejected") => {
    if (status === "Rejected" && !feedback.trim()) return void toast.error("Write what the student needs to fix first.");
    if (!window.confirm(`${status === "Accepted" ? "Accept" : "Reject"} this ${label.toLowerCase()}?`)) return;
    startSaving(async () => {
      const res = await decideAction(s.submissionId, { status, feedback, criteriaMet: criteria });
      if (!res.ok) return void toast.error(res.error);
      setS(res.submission);
      toast.success(status === "Accepted" ? "Accepted — the student can see it now" : "Rejected — the student has been sent your feedback");
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
        <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${statusStyle[s.status]}`}>{s.status}</span>
      </div>

      {s.history.length > 0 && (
        <div className="rounded-2xl bg-lilac/70 px-5 py-3 text-xs text-ink/70">
          <p className="font-medium text-ink">Earlier attempts</p>
          <ul className="mt-1 space-y-1">
            {s.history.map((h) => (
              <li key={h.attempt}>
                Attempt {h.attempt} — {h.status} by {h.decidedBy}: {h.feedback || "no comment"}
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
          <h2 className="mb-3 text-sm font-medium text-ink">Uploaded documents</h2>
          <FileList files={s.files} emptyText="The student didn’t upload any documents." />
        </div>
      )}

      {pending ? (
        canMark ? (
          <div className={`${card} space-y-4`}>
            <h2 className="text-base font-medium text-ink">Your decision</h2>
            <textarea
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              maxLength={4000}
              placeholder="Feedback for the student — required when rejecting, e.g. what’s missing and how to fix it."
              aria-label="Feedback"
              className="w-full resize-y rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/10 placeholder:text-ink/35 focus:ring-plum/40"
            />
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => mark("Accepted")}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <CheckIcon className="h-4 w-4" />
                Accept
              </button>
              <button
                onClick={() => mark("Rejected")}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                <CloseIcon className="h-4 w-4" />
                Reject
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-2xl bg-amber-50 px-5 py-3 text-sm text-amber-800">
            Super Admin has turned off assessment marking for trainers, so you can read this but not mark it.
          </p>
        )
      ) : (
        <div className={`rounded-2xl px-5 py-4 ${s.status === "Accepted" ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>
          <p className="text-sm font-medium">
            {s.status} by {s.decidedBy}
            {s.decidedAt && (
              <span className="font-normal opacity-70">
                {" "}· <LocalTime iso={s.decidedAt} />
              </span>
            )}
          </p>
          {s.feedback && <p className="mt-1 whitespace-pre-wrap text-sm">{s.feedback}</p>}
        </div>
      )}
    </div>
  );
}
