"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { setSubmittedAtAction } from "../../actions/submissions";
import { createPortal } from "react-dom";
import LocalTime from "../assessment/_components/LocalTime";
import { CheckIcon } from "./icons";
import { partsOf, type AssessmentPart, type UnitAssessment } from "@/lib/assessment-meta";
import ModuleSubmission from "./ModuleSubmission";
import type { Unit } from "@/lib/courses";
import { toLocalInput } from "@/lib/format";
import { needsRework, statusLabel, statusStyle, type SubmissionDTO } from "@/lib/submission-meta";
import type { FullUnitRecord } from "@/lib/unit-records";
import { unitStatusStyle } from "@/lib/unit-status-meta";

const card = "rounded-[1.5rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] sm:p-6";

// Everything a student handed in for one unit, one module per tab.
// Used by Super Admin (with submit photos and `canEditDate`) and trainers; `reviewBase` is where "Review & mark" goes.
export default function UnitWorkReview({
  student,
  course,
  unit,
  assessment,
  submissions,
  unitRecord: outcome,
  reviewBase,
  canEditDate = false,
}: {
  student: { studentId: string; name: string };
  course: { code: string; name: string };
  unit: Unit;
  assessment: UnitAssessment;
  submissions: Partial<Record<AssessmentPart, SubmissionDTO>>;
  unitRecord: FullUnitRecord | null;
  reviewBase: string;
  canEditDate?: boolean; // Super Admin: change the date work counts as submitted
}) {
  // Marked modules, plus any module the student has work in that was later archived or removed
  const parts = [
    ...partsOf(assessment),
    ...Object.keys(submissions)
      .filter((k) => !partsOf(assessment).some((p) => p.key === k) && k !== "rolePlay")
      .map((k) => ({ key: k, label: `${assessment.modules.find((m) => m.id === k)?.title ?? "Removed module"} (archived)` })),
  ];
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
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink">
            Unit status
            <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${unitStatusStyle[outcome.status]}`}>{outcome.status}</span>
            {outcome.feedback && <span>— {outcome.feedback}</span>}
          </p>
        )}
      </div>

      {parts.length === 0 && <p className={`${card} text-sm text-ink`}>No marked modules are set up for this unit yet.</p>}

      {parts.length > 0 && (
        <div role="tablist" aria-label="Modules" className={`grid gap-2 sm:grid-cols-2 ${parts.length >= 4 ? "xl:grid-cols-4" : parts.length === 3 ? "xl:grid-cols-3" : ""}`}>
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
                    {status === "Submitted" ? "To mark" : statusLabel[status]}
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
                  <p className="mt-0.5 text-xs text-ink">
                    Attempt {s.attempt}
                    {s.submittedAt ? (
                      <>
                        {" "}· submitted <LocalTime iso={s.submittedAt} />
                        {canEditDate && <SubmittedDateEditor submissionId={s.submissionId} submittedAt={s.submittedAt} />}
                      </>
                    ) : (
                      " · draft, not submitted"
                    )}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-ink">Not started</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {s?.photo && (
                  <button
                    onClick={() => setPhoto({ id: s.photo!.id, caption: `${p.label} · ${unit.code}` })}
                    className="flex items-center gap-2 rounded-xl bg-lilac/60 p-1 pr-3 text-[11px] text-ink transition hover:text-plum"
                    title="Photo taken when submitting"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route */}
                    <img src={`/api/files/${s.photo.id}`} alt={`Submit photo for ${p.label}`} className="h-10 w-10 rounded-lg object-cover" />
                    Submit photo
                  </button>
                )}
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyle[s?.status ?? "Not started"]}`}>{statusLabel[s?.status ?? "Not started"]}</span>
              </div>
            </div>

            {s && <ModuleSubmission module={assessment.modules.find((m) => m.id === p.key) ?? null} sub={s} />}

            {s && (s.status === "Accepted" || needsRework(s.status)) && (
              <div className={`rounded-xl px-4 py-3 text-sm ${s.status === "Accepted" ? "bg-emerald-50 text-emerald-900" : s.status === "MoreDocs" ? "bg-orange-50 text-orange-900" : "bg-rose-50 text-rose-900"}`}>
                <p className="font-medium">
                  {statusLabel[s.status]} — {s.decidedBy}
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
              <details className="text-xs text-ink">
                <summary className="cursor-pointer">Earlier attempts ({s.history.length})</summary>
                <ul className="mt-2 space-y-1">
                  {s.history.map((h) => (
                    <li key={h.attempt}>
                      Attempt {h.attempt} — {statusLabel[h.status]} by {h.decidedBy}: {h.feedback || "no comment"}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {s?.content.declaration && (
              <a href={`/declaration/${s.submissionId}`} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-full border border-plum/40 px-5 py-2.5 text-sm font-medium text-plum transition hover:bg-lilac">
                Declaration certificate
              </a>
            )}
            {s?.content.declaration && (
              <a href={`/api/declaration/${s.submissionId}`} className="inline-flex rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition hover:bg-plum-light">
                Download declaration (PDF)
              </a>
            )}
            {s && s.status !== "Draft" && (
              <Link
                href={`${reviewBase}/${s.submissionId}`}
                className="inline-flex rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition hover:bg-plum-light"
              >
                {s.status === "Submitted" ? "Review & mark" : "Change status"}
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

// Super Admin: change when this work counts as submitted (e.g. it was handed in on paper earlier)
function SubmittedDateEditor({ submissionId, submittedAt }: { submissionId: string; submittedAt: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(toLocalInput(submittedAt));
  const [saving, startSaving] = useTransition();

  const save = () =>
    startSaving(async () => {
      const res = await setSubmittedAtAction(submissionId, new Date(value).toISOString());
      if (!res.ok) return void toast.error(res.error);
      toast.success("Submitted date changed");
      setOpen(false);
      router.refresh();
    });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="ml-2 font-medium text-plum underline-offset-2 hover:underline">
        Change date
      </button>
    );
  }
  return (
    <span className="mt-2 flex flex-wrap items-center gap-2">
      <input
        type="datetime-local"
        value={value}
        max={toLocalInput(new Date().toISOString())}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Submitted date and time"
        className="rounded-lg bg-lilac px-3 py-1.5 text-sm text-ink outline-none ring-1 ring-ink/10 focus:ring-plum/40"
      />
      <button
        onClick={save}
        disabled={saving || !value}
        className="rounded-full bg-plum px-3 py-1.5 text-xs font-medium text-white transition hover:bg-plum-light disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button onClick={() => setOpen(false)} className="rounded-full px-2 py-1.5 text-xs text-ink hover:bg-lilac">
        Cancel
      </button>
    </span>
  );
}
