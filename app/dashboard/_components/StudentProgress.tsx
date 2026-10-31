"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import LocalTime from "../assessment/_components/LocalTime";
import { clearUnitResultAction, setStudentDueAction, setUnitResultAction } from "../../actions/unit-results";
import { ASSESSMENT_PARTS, isPastDue } from "@/lib/assessment-meta";
import type { StudentProgressDTO, UnitProgress } from "@/lib/progress";
import { statusStyle } from "@/lib/submission-meta";
import { resultStyle, UNIT_RESULTS, type UnitResultValue } from "@/lib/unit-meta";

// A student's units with each part's status and the final Pass / Fail / Withdrawn outcome.
// Used by Super Admin (can also remove a result) and trainers.
export default function StudentProgress({
  initial,
  canGrade,
  canClear,
  showPhotos = false,
  canChangeDue = false,
  workHrefBase,
}: {
  initial: StudentProgressDTO;
  canGrade: boolean;
  canClear: boolean;
  showPhotos?: boolean;
  canChangeDue?: boolean; // Super Admin: give this student their own due date per unit
  workHrefBase?: string; // Super Admin: links each unit to everything the student handed in
}) {
  const [data, setData] = useState(initial);
  const [viewing, setViewing] = useState<{ fileId: string; label: string } | null>(null);
  const setUnit = (code: string, patch: Partial<UnitProgress>) =>
    setData((d) => ({ ...d, units: d.units.map((u) => (u.code === code ? { ...u, ...patch } : u)) }));

  const passed = data.units.filter((u) => u.outcome?.result === "Pass").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-plum">
            {data.course.code} · {data.course.name}
          </p>
          <h1 className="mt-1 text-2xl font-medium text-ink sm:text-[1.65rem]">{data.student.name}</h1>
          <p className="mt-1 text-sm text-ink/55">
            {data.student.studentId} · {data.student.email}
          </p>
        </div>
        <div className="rounded-[1.5rem] bg-lilac px-5 py-4">
          <p className="text-2xl font-medium text-ink">
            {passed}
            <span className="text-base text-ink/40"> / {data.units.length}</span>
          </p>
          <p className="mt-1 text-xs text-ink/50">units passed</p>
        </div>
      </div>

      {!canGrade && (
        <p className="rounded-2xl bg-amber-50 px-5 py-3 text-sm text-amber-800">
          Super Admin has turned off assessment marking for trainers, so you can view results but not give them.
        </p>
      )}

      <ol className="space-y-3">
        {data.units.map((u, i) => (
          <UnitRow
            key={u.code}
            n={i + 1}
            studentId={data.student.studentId}
            unit={u}
            canGrade={canGrade}
            canClear={canClear}
            canChangeDue={canChangeDue}
            onChange={(patch) => setUnit(u.code, patch)}
            onViewPhoto={showPhotos ? setViewing : undefined}
            workHref={workHrefBase ? `${workHrefBase}/${encodeURIComponent(u.code)}` : undefined}
          />
        ))}
      </ol>
      {viewing && <PhotoViewer {...viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

// ISO → value for <input type="datetime-local"> in the viewer's time zone
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Full-size submit photo (Super Admin)
function PhotoViewer({ fileId, label, onClose }: { fileId: string; label: string; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/70 p-4 font-dm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <figure className="max-w-lg overflow-hidden rounded-[1.5rem] bg-white shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route */}
        <img src={`/api/files/${fileId}`} alt={label} className="max-h-[70dvh] w-full object-contain" />
        <figcaption className="flex items-center justify-between gap-4 px-5 py-3 text-sm text-ink">
          {label}
          <button onClick={onClose} className="rounded-full bg-lilac px-4 py-1.5 text-xs font-medium text-plum hover:bg-plum/10">
            Close
          </button>
        </figcaption>
      </figure>
    </div>,
    document.getElementById("portal-root") ?? document.body,
  );
}

function UnitRow({
  n,
  studentId,
  unit,
  canGrade,
  canClear,
  canChangeDue,
  onChange,
  onViewPhoto,
  workHref,
}: {
  n: number;
  studentId: string;
  unit: UnitProgress;
  canGrade: boolean;
  canClear: boolean;
  canChangeDue: boolean;
  onChange: (patch: Partial<UnitProgress>) => void;
  onViewPhoto?: (photo: { fileId: string; label: string }) => void;
  workHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<UnitResultValue>(unit.outcome?.result ?? "Pass");
  const [feedback, setFeedback] = useState(unit.outcome?.feedback ?? "");
  const [saving, startSaving] = useTransition();
  const [dueOpen, setDueOpen] = useState(false);
  const [due, setDue] = useState(toLocalInput(unit.dueAt));

  const saveDue = (value: string | null) =>
    startSaving(async () => {
      const res = await setStudentDueAction(studentId, unit.code, value);
      if (!res.ok) return void toast.error(res.error);
      onChange({ dueAt: res.dueAt, extended: res.extended });
      setDue(toLocalInput(res.dueAt));
      setDueOpen(false);
      toast.success(res.extended ? `${unit.code}: due date changed for this student` : `${unit.code}: back on the unit’s due date`);
    });

  const save = () =>
    startSaving(async () => {
      const res = await setUnitResultAction(studentId, unit.code, result, feedback);
      if (!res.ok) return void toast.error(res.error);
      onChange({ outcome: res.outcome });
      setOpen(false);
      toast.success(`${unit.code}: ${res.outcome.result}`);
    });

  const clear = () => {
    if (!window.confirm(`Remove the final result for ${unit.code}? The student can work on the unit again.`)) return;
    startSaving(async () => {
      const res = await clearUnitResultAction(studentId, unit.code);
      if (!res.ok) return void toast.error(res.error);
      onChange({ outcome: null });
      toast.success("Result removed — unit re-opened");
    });
  };

  return (
    <li className="rounded-[1.5rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)]">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lilac text-sm font-medium text-plum">{n}</span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-plum">{unit.code}</p>
            <p className="font-medium leading-snug text-ink">{unit.title}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ASSESSMENT_PARTS.map((p) => {
                const s = unit.setUp?.[p.key] ? (unit.statuses[p.key] ?? "Not started") : null;
                return (
                  <span
                    key={p.key}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${s ? statusStyle[s] : "bg-lilac/60 text-ink/30 line-through"}`}
                  >
                    {p.label}
                    {s && s !== "Not started" ? ` · ${s}` : ""}
                  </span>
                );
              })}
            </div>
            {unit.setUp && (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink/50">
                {unit.dueAt ? (
                  <span className={isPastDue(unit.dueAt) && !unit.outcome ? "text-rose-600" : ""}>
                    Due <LocalTime iso={unit.dueAt} />
                    {isPastDue(unit.dueAt) && !unit.outcome && " · passed"}
                  </span>
                ) : (
                  <span>No due date</span>
                )}
                {unit.extended && <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-700">Own date for this student</span>}
                {canChangeDue && !unit.outcome && (
                  <button onClick={() => setDueOpen((v) => !v)} className="font-medium text-plum hover:underline">
                    Change due date
                  </button>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {unit.outcome ? (
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${resultStyle[unit.outcome.result]}`}>Final: {unit.outcome.result}</span>
          ) : (
            <span className="text-xs text-ink/40">No final result</span>
          )}
          {workHref && (
            <Link
              href={workHref}
              className="rounded-full bg-lilac px-4 py-2 text-xs font-medium text-plum transition hover:bg-plum hover:text-white"
            >
              View progress
            </Link>
          )}
          {canGrade && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-full bg-plum px-4 py-2 text-xs font-medium text-white transition hover:bg-plum-light"
            >
              {unit.outcome ? "Change result" : "Give result"}
            </button>
          )}
          {canClear && unit.outcome && (
            <button
              onClick={clear}
              disabled={saving}
              className="rounded-full bg-lilac px-4 py-2 text-xs font-medium text-ink/70 transition hover:bg-rose-50 hover:text-rose-700"
            >
              Remove result
            </button>
          )}
        </div>
      </div>

      {dueOpen && (
        <div className="mt-4 space-y-3 rounded-2xl bg-lilac/60 p-4">
          <p className="text-sm font-medium text-ink">Due date for this student only</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              aria-label={`Due date for ${unit.code}`}
              className="rounded-xl bg-white px-4 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/10 focus:ring-plum/40"
            />
            <button
              onClick={() => saveDue(new Date(due).toISOString())}
              disabled={saving || !due}
              className="rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition hover:bg-plum-light disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save due date"}
            </button>
            {unit.extended && (
              <button onClick={() => saveDue(null)} disabled={saving} className="rounded-full bg-white px-4 py-2.5 text-sm text-ink/70 hover:bg-white/70">
                Use the unit’s date
              </button>
            )}
            <button onClick={() => setDueOpen(false)} className="rounded-full px-4 py-2.5 text-sm text-ink/60 hover:bg-white/60">
              Cancel
            </button>
          </div>
          <p className="text-[11px] text-ink/50">
            {unit.unitDueAt ? (
              <>
                The unit is due <LocalTime iso={unit.unitDueAt} /> for everyone else.
              </>
            ) : (
              "The unit has no due date for everyone else."
            )}{" "}
            A later date lets this student keep working and submit after the unit’s date.
          </p>
        </div>
      )}

      {onViewPhoto && unit.photos.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-lilac/40 px-4 py-3">
          <span className="text-[11px] font-medium text-ink/50">Photos at submit</span>
          {unit.photos.map((p) => {
            const label = `${ASSESSMENT_PARTS.find((x) => x.key === p.part)?.label ?? p.part} · ${unit.code}`;
            return (
              <button
                key={p.fileId}
                onClick={() => onViewPhoto({ fileId: p.fileId, label })}
                className="group flex items-center gap-2 rounded-xl bg-white p-1 pr-3 text-[11px] text-ink/70 shadow-sm transition hover:text-plum"
                title={`View photo — ${label}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route */}
                <img src={`/api/files/${p.fileId}`} alt={`Photo for ${label}`} className="h-10 w-10 rounded-lg object-cover" />
                {ASSESSMENT_PARTS.find((x) => x.key === p.part)?.label}
                {p.submittedAt && (
                  <span className="text-ink/40">
                    · <LocalTime iso={p.submittedAt} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {unit.outcome && !open && (
        <div className="mt-4 rounded-xl bg-lilac/50 px-4 py-3 text-sm text-ink/80">
          {unit.outcome.feedback ? <p className="whitespace-pre-wrap">{unit.outcome.feedback}</p> : <p className="text-ink/45">No feedback written.</p>}
          <p className="mt-1 text-[11px] text-ink/45">
            {unit.outcome.decidedBy} · <LocalTime iso={unit.outcome.decidedAt} />
          </p>
        </div>
      )}

      {open && (
        <div className="mt-4 space-y-3 rounded-2xl bg-lilac/60 p-4">
          <div role="radiogroup" aria-label={`Final result for ${unit.code}`} className="flex flex-wrap gap-2">
            {UNIT_RESULTS.map((r) => (
              <button
                key={r}
                role="radio"
                aria-checked={result === r}
                onClick={() => setResult(r)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition ${result === r ? resultStyle[r] + " ring-2 ring-current" : "bg-white text-ink/60 hover:bg-white/70"}`}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            value={feedback}
            maxLength={4000}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={result === "Fail" ? "Why the unit is failed (required)" : "Overall feedback for the student"}
            aria-label={`Feedback for ${unit.code}`}
            className="w-full resize-y rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/10 placeholder:text-ink/35 focus:ring-plum/40"
          />
          <p className="text-[11px] text-ink/50">
            Pass needs every part that’s set up to be accepted. The student can’t change this unit once a final result is given.
          </p>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition hover:bg-plum-light disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save final result"}
            </button>
            <button onClick={() => setOpen(false)} className="rounded-full px-4 py-2.5 text-sm text-ink/60 hover:bg-white/60">
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
