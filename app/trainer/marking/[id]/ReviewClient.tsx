"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { changeDeadlineAction } from "../../../actions/deadlines";
import FileList from "../../../dashboard/_components/FileList";
import ModuleSubmission from "../../../dashboard/_components/ModuleSubmission";
import { CheckIcon, ClockIcon, FileIcon } from "../../../dashboard/_components/icons";
import LocalTime from "../../../dashboard/assessment/_components/LocalTime";
import { decideAction, replyToReviewAction, setMarkedFilesAction, setPendingAction } from "../actions";
import type { Module } from "@/lib/module-meta";
import { statusLabel, statusStyle, type Decision, type SubmissionDTO } from "@/lib/submission-meta";
import { unitStatusStyle, type UnitStatus } from "@/lib/unit-status-meta";

const card = "rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] sm:p-6";
const field = "w-full rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/15 placeholder:text-ink/60 focus:ring-plum/40";
const btn = "rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

const OPTIONS: { value: Decision | "Submitted"; label: string }[] = [
  { value: "Submitted", label: "Pending marking" },
  { value: "Accepted", label: "Satisfactory" },
  { value: "Rejected", label: "Not satisfactory — request resubmission" },
  { value: "MoreDocs", label: "Additional information requested" },
];

// Manual marking of one module (nothing is marked automatically). Save marking keeps it private; Publish feedback
// releases the status, feedback and marked copy to the student.
export default function ReviewClient({
  initialSubmission,
  module: mod,
  canMark,
  due,
  unitStatus,
}: {
  initialSubmission: SubmissionDTO;
  module: Module | null; // null when the module was later deleted
  canMark: boolean;
  due: string | null; // this student's deadline for the module
  unitStatus: UnitStatus;
}) {
  const [s, setS] = useState(initialSubmission);
  const [status, setStatus] = useState<Decision | "Submitted">(initialSubmission.draft?.status ?? (initialSubmission.status === "Draft" ? "Submitted" : initialSubmission.status));
  const [feedback, setFeedback] = useState(initialSubmission.draft?.feedback ?? initialSubmission.feedback);
  const [newDue, setNewDue] = useState("");
  const [marked, setMarked] = useState(initialSubmission.markedFiles);
  const [currentDue, setCurrentDue] = useState(due);
  const [extend, setExtend] = useState<{ dueAt: string; reason: string } | null>(null);
  const [reply, setReply] = useState("");
  const [busy, start] = useTransition();
  const label = mod?.title ?? "Module";
  const asksForMore = status === "Rejected" || status === "MoreDocs";

  const save = (publish: boolean) => {
    if (status === "Submitted") {
      if (s.status === "Submitted") return void toast.error("Choose a result first.");
      if (!window.confirm("Put this back to Pending marking? The student’s current result and feedback are taken back.")) return;
      return start(async () => {
        const res = await setPendingAction(s.submissionId);
        if (!res.ok) return void toast.error(res.error);
        setS(res.submission);
        toast.success("Back to Pending marking");
      });
    }
    if (publish && !window.confirm(`Publish “${statusLabel[status]}” for ${label}? The student sees the status, feedback and marked copy straight away.`)) return;
    start(async () => {
      const res = await decideAction(s.submissionId, { status, feedback, publish, dueAt: publish && asksForMore && newDue ? new Date(newDue).toISOString() : null });
      if (!res.ok) return void toast.error(res.error);
      setS(res.submission);
      if (publish && asksForMore && newDue) setCurrentDue(new Date(newDue).toISOString());
      toast.success(publish ? "Published — the student can see it now" : "Marking saved (not yet visible to the student)");
    });
  };

  const saveMarked = (files: typeof marked) =>
    start(async () => {
      const res = await setMarkedFilesAction(s.submissionId, files.map((f) => f.id));
      if (!res.ok) return void toast.error(res.error);
      setMarked(res.submission.markedFiles);
      setS(res.submission);
    });

  const saveExtend = () =>
    extend &&
    start(async () => {
      const res = await changeDeadlineAction({ courseCode: s.courseCode, unitCode: s.unitCode, moduleId: s.part, studentIds: [s.studentId], dueAt: new Date(extend.dueAt).toISOString(), reason: extend.reason });
      if (!res.ok) return void toast.error(res.error);
      setCurrentDue(new Date(extend.dueAt).toISOString());
      setExtend(null);
      toast.success("Due date changed for this student");
    });

  const sendReply = () =>
    start(async () => {
      const res = await replyToReviewAction(s.submissionId, reply);
      if (!res.ok) return void toast.error(res.error);
      setS(res.submission);
      setReply("");
      toast.success("Reply sent");
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-plum">
            {s.courseCode} / {s.unitCode} / {s.studentName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-[1.65rem]">{label}</h1>
          <p className="mt-1 text-sm text-ink">
            {s.unitTitle} · attempt {s.attempt}
            {s.submittedAt && (
              <>
                {" "}· submitted <LocalTime iso={s.submittedAt} />
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${unitStatusStyle[unitStatus]}`}>Unit {unitStatus}</span>
          <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${statusStyle[s.status]}`}>{statusLabel[s.status]}</span>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <section className={`${card} space-y-4`}>
            <h2 className="text-lg font-semibold text-ink">Student submission</h2>
            <ModuleSubmission module={mod} sub={s} />
            <div className="flex flex-wrap gap-3 border-t border-ink/10 pt-4 text-sm text-ink">
              <span className="flex items-center gap-2">
                Declaration
                {s.content.declaration?.signature ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    <CheckIcon className="h-3.5 w-3.5" /> Signed
                  </span>
                ) : s.content.declaration ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Ticked</span>
                ) : (
                  <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-800">None</span>
                )}
              </span>
              <span className="flex items-center gap-2">
                Photo
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.photo ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-800"}`}>{s.photo ? "Captured" : "None"}</span>
              </span>
              {s.content.declaration && (
                <a href={`/declaration/${s.submissionId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-plum underline">
                  <FileIcon className="h-4 w-4" />
                  Declaration evidence
                </a>
              )}
            </div>
            <details className="rounded-xl bg-lilac/50 px-4 py-3 text-sm text-ink">
              <summary className="cursor-pointer font-semibold">Previous attempts ({s.history.length})</summary>
              <ul className="mt-2 space-y-2">
                {s.history.map((h) => (
                  <li key={h.attempt} className="rounded-lg bg-white px-3 py-2">
                    <p className="font-semibold">
                      Attempt {h.attempt} — {statusLabel[h.status]} · {h.decidedBy}
                    </p>
                    <p className="whitespace-pre-wrap">{h.feedback || "No feedback"}</p>
                    {h.response && <p className="mt-1">Student {h.response.state === "accepted" ? "accepted it" : `asked for a review: “${h.response.comment}”`}</p>}
                  </li>
                ))}
                {!s.history.length && <li>None.</li>}
              </ul>
            </details>
          </section>

          <section className={`${card} space-y-3`}>
            <h2 className="text-lg font-semibold text-ink">Feedback</h2>
            <textarea
              rows={5}
              value={feedback}
              disabled={!canMark}
              maxLength={4000}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Feedback for the student (required unless Satisfactory)"
              aria-label="Feedback"
              className={`${field} resize-y`}
            />
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Marked copy</p>
              <FileList files={marked} onChange={canMark ? (f) => (setMarked(f), saveMarked(f)) : undefined} emptyText="No marked copy." uploadLabel="Attach marked copy" />
            </div>
          </section>
        </div>

        <aside className={`${card} space-y-4`}>
          <h2 className="text-lg font-semibold text-ink">Module status</h2>
          {/* who recorded the current published result — kept after a transfer, so the new trainer can see it */}
          {s.decidedBy && s.decidedAt && (
            <p className="text-sm text-ink">
              Marked by <span className="font-semibold">{s.decidedBy}</span> ·{" "}
              {new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(s.decidedAt))}
            </p>
          )}
          {s.draft && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Saved, not published: {statusLabel[s.draft.status]} · {s.draft.savedBy}
            </p>
          )}
          <select value={status} disabled={!canMark} onChange={(e) => setStatus(e.target.value as Decision | "Submitted")} aria-label="Module status" className={field}>
            {OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {asksForMore && (
            <label className="block space-y-1 text-sm font-semibold text-ink">
              {status === "MoreDocs" ? "Due date for the information" : "New deadline for the resubmission"}
              <input type="datetime-local" value={newDue} onChange={(e) => setNewDue(e.target.value)} className={`${field} font-normal`} />
              <span className="block text-xs font-normal">Only this module reopens, for this student — and only while the unit is Active and open.</span>
            </label>
          )}

          <div className="space-y-2 border-t border-ink/10 pt-4 text-sm text-ink">
            <p className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-plum" />
              Due date: {currentDue ? <LocalTime iso={currentDue} /> : "none"}
            </p>
            {canMark &&
              (extend ? (
                <div className="space-y-2">
                  <input type="datetime-local" value={extend.dueAt} onChange={(e) => setExtend({ ...extend, dueAt: e.target.value })} aria-label="New due date" className={field} />
                  <input value={extend.reason} onChange={(e) => setExtend({ ...extend, reason: e.target.value })} placeholder="Reason (goes in the log)" aria-label="Reason" className={field} />
                  <div className="flex gap-2">
                    <button onClick={saveExtend} disabled={busy || !extend.dueAt || !extend.reason.trim()} className={`${btn} bg-plum text-white`}>
                      Save due date
                    </button>
                    <button onClick={() => setExtend(null)} className={`${btn} text-ink hover:bg-lilac`}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setExtend({ dueAt: "", reason: "" })} className={`${btn} border border-plum text-plum hover:bg-lilac`}>
                  Extend due date
                </button>
              ))}
          </div>

          {canMark ? (
            <div className="flex flex-col gap-2 border-t border-ink/10 pt-4">
              <button onClick={() => save(false)} disabled={busy} className={`${btn} border border-ink/15 text-ink hover:bg-lilac`}>
                Save marking
              </button>
              <button onClick={() => save(true)} disabled={busy} className={`${btn} bg-plum py-3 text-white hover:bg-plum-light`}>
                {busy ? "Saving…" : "Publish feedback"}
              </button>
            </div>
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Super Admin has turned off marking for trainers.</p>
          )}
        </aside>
      </div>

      {s.response && (
        <section className={`${card} grid gap-5 md:grid-cols-2`}>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-ink">Student feedback response</h2>
            <p className="text-sm text-ink">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.response.state === "accepted" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                {s.response.state === "accepted" ? "Accepted and signed" : "Review requested"}
              </span>{" "}
              <LocalTime iso={s.response.at} />
            </p>
            {s.response.comment && <p className="whitespace-pre-wrap rounded-xl bg-lilac/50 px-4 py-3 text-sm text-ink">{s.response.comment}</p>}
            {s.response.replies.map((r, i) => (
              <p key={i} className="rounded-xl bg-white px-4 py-2 text-sm text-ink ring-1 ring-ink/10">
                <span className="font-semibold">{r.by}:</span> {r.text}
              </p>
            ))}
          </div>
          {s.response.state === "review" && canMark && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-ink">Reply to student</h3>
              <textarea rows={4} value={reply} maxLength={4000} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply to the student…" aria-label="Reply to the student" className={`${field} resize-y`} />
              <button onClick={sendReply} disabled={busy || !reply.trim()} className={`${btn} bg-plum text-white hover:bg-plum-light`}>
                Send reply
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
