"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import LocalTime from "../assessment/_components/LocalTime";
import { setStudentDueAction, setUnitHiddenAction, setUnitOpeningAction, setUnitStatusAction } from "../../actions/unit-results";
import { isPastDue } from "@/lib/assessment-meta";
import { toLocalInput } from "@/lib/format";
import type { StudentProgressDTO, UnitProgress } from "@/lib/progress";
import { statusLabel, statusStyle } from "@/lib/submission-meta";
import { canSetUnitStatus, NON_ACTIVE_WARNING, UNIT_STATUSES, unitAccess, unitStatusStyle, type UnitStatus } from "@/lib/unit-status-meta";

// A student's units: each module's status, the unit status (Active, Inactive, Withdrawn, Cancelled, Deferred, Competent,
// Not Yet Competent) and whether admin opened it. Used by Super Admin / Admins and trainers (a trainer only gets
// the units they're assigned to, and can't reactivate a unit).
export default function StudentProgress({
  initial,
  canGrade,
  role = "admin",
  showPhotos = false,
  canChangeDue = false,
  canHide = false,
  canUnlock = false,
  workHrefBase,
}: {
  initial: StudentProgressDTO;
  canGrade: boolean; // may record unit statuses
  role?: "admin" | "trainer";
  showPhotos?: boolean;
  canChangeDue?: boolean; // Super Admin: give this student their own due date per unit
  canHide?: boolean; // Super Admin: hide a unit from this student
  canUnlock?: boolean; // admin: open units for this student now, schedule them, or close them
  workHrefBase?: string; // Super Admin: links each unit to everything the student handed in
}) {
  const [data, setData] = useState(initial);
  const [viewing, setViewing] = useState<{ fileId: string; label: string } | null>(null);
  const setUnit = (code: string, patch: Partial<UnitProgress>) =>
    setData((d) => ({ ...d, units: d.units.map((u) => (u.code === code ? { ...u, ...patch } : u)) }));

  const passed = data.units.filter((u) => u.record.status === "Competent").length;
  const unlockedCount = data.units.filter((u) => u.unlocked).length;
  const [bulkBusy, startBulk] = useTransition();

  // Unlock (or lock) every unit at once
  const setAll = (unlocked: boolean) => {
    const codes = data.units.filter((u) => u.unlocked !== unlocked).map((u) => u.code);
    if (!codes.length) return;
    if (!unlocked && !window.confirm(`Close all ${codes.length} units for ${data.student.name}? They won’t be able to open them. Their work so far is kept.`)) return;
    startBulk(async () => {
      const res = await setUnitOpeningAction(data.student.studentId, data.course.code, codes, { open: unlocked });
      if (!res.ok) return void toast.error(res.error);
      setData((d) => ({
        ...d,
        units: d.units.map((u) => {
          const record = res.records[u.code] ?? u.record;
          return { ...u, record, unlocked: record.opened, access: unitAccess(record) };
        }),
      }));
      toast.success(unlocked ? "All units opened for the student" : "All units closed");
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-plum">
            {data.course.code} · {data.course.name}
          </p>
          <h1 className="mt-1 text-2xl font-medium text-ink sm:text-[1.65rem]">{data.student.name}</h1>
          <p className="mt-1 text-sm text-ink">
            {data.student.studentId} · {data.student.email}
          </p>
        </div>
        <div className="rounded-[1.5rem] bg-lilac px-5 py-4">
          <p className="text-2xl font-medium text-ink">
            {passed}
            <span className="text-base text-ink"> / {data.units.length}</span>
          </p>
          <p className="mt-1 text-xs text-ink">units Competent</p>
        </div>
      </div>

      {!canGrade && (
        <p className="rounded-2xl bg-amber-50 px-5 py-3 text-sm text-amber-800">
          Super Admin has turned off assessment marking for trainers, so you can view statuses but not change them.
        </p>
      )}

      {canUnlock && (
        <div className="flex flex-wrap items-center gap-3 rounded-[1.5rem] border border-ink/10 bg-white px-5 py-4">
          <p className="min-w-0 flex-1 text-sm font-medium text-ink">
            <span className="font-semibold text-emerald-700">{unlockedCount} opened</span> · {data.units.length - unlockedCount} not opened. Students see a
            unit’s modules only when it’s opened and its status is Active.
          </p>
          <button
            type="button"
            onClick={() => setAll(true)}
            disabled={bulkBusy || unlockedCount === data.units.length}
            className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Open all units
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            disabled={bulkBusy || unlockedCount === 0}
            className="rounded-full border border-ink/20 bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:bg-lilac disabled:cursor-not-allowed disabled:opacity-60"
          >
            Close all
          </button>
        </div>
      )}

      <ol className="space-y-3">
        {data.units.map((u, i) => (
          <UnitRow
            key={u.code}
            n={i + 1}
            studentId={data.student.studentId}
            courseCode={data.course.code}
            unit={u}
            canGrade={canGrade}
            role={role}
            canChangeDue={canChangeDue}
            canHide={canHide}
            canUnlock={canUnlock}
            onChange={(patch) => setUnit(u.code, patch)}
            onViewPhoto={showPhotos ? setViewing : undefined}
            workHref={workHrefBase ? `${workHrefBase}/${encodeURIComponent(u.code)}?course=${encodeURIComponent(data.course.code)}` : undefined}
          />
        ))}
      </ol>
      {viewing && <PhotoViewer {...viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

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
  courseCode,
  unit,
  canGrade,
  role,
  canChangeDue,
  canHide,
  canUnlock,
  onChange,
  onViewPhoto,
  workHref,
}: {
  n: number;
  studentId: string;
  courseCode: string;
  unit: UnitProgress;
  canGrade: boolean;
  role: "admin" | "trainer";
  canChangeDue: boolean;
  canHide: boolean;
  canUnlock: boolean;
  onChange: (patch: Partial<UnitProgress>) => void;
  onViewPhoto?: (photo: { fileId: string; label: string }) => void;
  workHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<UnitStatus>(unit.record.status);
  const [feedback, setFeedback] = useState(unit.record.feedback);
  const [releaseAt, setReleaseAt] = useState(toLocalInput(unit.record.releaseAt));
  const done = unit.record.status !== "Active";
  const [saving, startSaving] = useTransition();
  const [dueOpen, setDueOpen] = useState(false);

  const toggleHidden = () => {
    const hide = !unit.hidden;
    if (hide && !window.confirm(`Hide ${unit.code} from this student? They won’t see it or be able to work on it. Their work so far is kept.`)) return;
    startSaving(async () => {
      const res = await setUnitHiddenAction(studentId, courseCode, unit.code, hide);
      if (!res.ok) return void toast.error(res.error);
      onChange({ hidden: hide });
      toast.success(hide ? `${unit.code} hidden from the student` : `${unit.code} shown to the student again`);
    });
  };
  // Admin: open now, schedule, or close again (opening never changes results)
  const setOpening = (change: { open: boolean; releaseAt?: string | null }) => {
    if (!change.open && !change.releaseAt && !window.confirm(`Close ${unit.code} for this student? Their work so far is kept.`)) return;
    startSaving(async () => {
      const res = await setUnitOpeningAction(studentId, courseCode, [unit.code], change);
      if (!res.ok) return void toast.error(res.error);
      const record = res.records[unit.code] ?? unit.record;
      onChange({ record, unlocked: record.opened, access: unitAccess(record) });
      toast.success(change.open ? `${unit.code} opened for the student` : change.releaseAt ? `${unit.code} scheduled` : `${unit.code} closed`);
    });
  };
  const [due, setDue] = useState(toLocalInput(unit.dueAt));

  const saveDue = (value: string | null) =>
    startSaving(async () => {
      const res = await setStudentDueAction(studentId, courseCode, unit.code, value);
      if (!res.ok) return void toast.error(res.error);
      onChange({ dueAt: res.dueAt, extended: res.extended });
      setDue(toLocalInput(res.dueAt));
      setDueOpen(false);
      toast.success(res.extended ? `${unit.code}: due date changed for this student` : `${unit.code}: back on the unit’s due date`);
    });

  const save = () => {
    if (status !== "Active" && unit.record.status === "Active" && !window.confirm(`${NON_ACTIVE_WARNING}\n\nSet ${unit.code} to ${status}?`)) return;
    startSaving(async () => {
      const res = await setUnitStatusAction(studentId, courseCode, unit.code, status, feedback);
      if (!res.ok) return void toast.error(res.error);
      onChange({ record: res.record, access: unitAccess(res.record) });
      setOpen(false);
      toast.success(`${unit.code}: ${res.record.status}`);
    });
  };

  return (
    <li
      className={`rounded-[1.5rem] border p-5 ${
        unit.hidden ? "border-dashed border-ink/30 bg-lilac/50" : "border-ink/5 bg-white shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)]"
      }`}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-start gap-4">
          {/* green = the student can open it now, grey = closed */}
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-semibold text-white ${unit.access.open ? "bg-emerald-600" : "bg-zinc-500"}`}
            title={unit.access.open ? "Open for the student" : (unit.access.reason ?? "Closed")}
          >
            {n}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-plum">
              {unit.code}
              {unit.hidden && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-white">Hidden from student</span>}
              {unit.access.open ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">Open</span>
              ) : (
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-800">{unit.access.reason}</span>
              )}
            </p>
            <p className="font-medium leading-snug text-ink">{unit.title}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {unit.parts.map((p) => {
                const s = unit.statuses[p.key] ?? "Not started";
                return (
                  <span
                    key={p.key}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${s ? statusStyle[s] : "bg-lilac/60 text-ink line-through"}`}
                  >
                    {p.label}
                    {s && s !== "Not started" ? ` · ${statusLabel[s]}` : ""}
                  </span>
                );
              })}
            </div>
            {unit.parts.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink">
                {unit.dueAt ? (
                  <span className={isPastDue(unit.dueAt) && !done ? "text-rose-600" : ""}>
                    Due <LocalTime iso={unit.dueAt} />
                    {isPastDue(unit.dueAt) && !done && " · passed"}
                  </span>
                ) : (
                  <span>No due date</span>
                )}
                {unit.extended && <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-700">Own date for this student</span>}
                {canChangeDue && !done && (
                  <button onClick={() => setDueOpen((v) => !v)} className="font-medium text-plum hover:underline">
                    Change due date
                  </button>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${unitStatusStyle[unit.record.status]}`}>Unit: {unit.record.status}</span>
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
              Set unit status
            </button>
          )}
          {canUnlock && (
            <button
              onClick={() => setOpening({ open: !unit.record.opened })}
              disabled={saving}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                unit.record.opened ? "border border-ink/20 bg-white text-ink hover:bg-lilac" : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              {unit.record.opened ? "Close again" : "Open for student"}
            </button>
          )}
          {canHide && (
            <button
              onClick={toggleHidden}
              disabled={saving}
              className={`rounded-full px-4 py-2 text-xs font-medium transition disabled:opacity-60 ${
                unit.hidden ? "bg-ink text-white hover:bg-ink/80" : "border border-ink/20 bg-white text-ink hover:bg-lilac"
              }`}
            >
              {unit.hidden ? "Show to student" : "Hide from student"}
            </button>
          )}
        </div>
      </div>

      {canUnlock && !unit.record.opened && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink">
          <span className="font-semibold">Scheduled release:</span>
          <input
            type="datetime-local"
            value={releaseAt}
            onChange={(e) => setReleaseAt(e.target.value)}
            aria-label={`Release ${unit.code} on`}
            className="rounded-lg bg-white px-2.5 py-1.5 text-xs text-ink outline-none ring-1 ring-ink/15 focus:ring-plum/40"
          />
          <button
            onClick={() => releaseAt && setOpening({ open: false, releaseAt: new Date(releaseAt).toISOString() })}
            disabled={saving || !releaseAt}
            className="rounded-full border border-plum px-3 py-1 font-semibold text-plum hover:bg-lilac disabled:opacity-50"
          >
            Schedule
          </button>
        </div>
      )}

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
              <button onClick={() => saveDue(null)} disabled={saving} className="rounded-full bg-white px-4 py-2.5 text-sm text-ink hover:bg-white/70">
                Use the unit’s date
              </button>
            )}
            <button onClick={() => setDueOpen(false)} className="rounded-full px-4 py-2.5 text-sm text-ink hover:bg-white/60">
              Cancel
            </button>
          </div>
          <p className="text-[11px] text-ink">
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
          <span className="text-[11px] font-medium text-ink">Photos at submit</span>
          {unit.photos.map((p) => {
            const label = `${p.label} · ${unit.code}`;
            return (
              <button
                key={p.fileId}
                onClick={() => onViewPhoto({ fileId: p.fileId, label })}
                className="group flex items-center gap-2 rounded-xl bg-white p-1 pr-3 text-[11px] text-ink shadow-sm transition hover:text-plum"
                title={`View photo — ${label}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route */}
                <img src={`/api/files/${p.fileId}`} alt={`Photo for ${label}`} className="h-10 w-10 rounded-lg object-cover" />
                {p.label}
                {p.submittedAt && (
                  <span className="text-ink">
                    · <LocalTime iso={p.submittedAt} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {unit.record.decidedBy && !open && (
        <div className="mt-4 rounded-xl bg-lilac/50 px-4 py-3 text-sm text-ink">
          {unit.record.feedback ? <p className="whitespace-pre-wrap">{unit.record.feedback}</p> : <p>No unit feedback written.</p>}
          <p className="mt-1 text-[11px]">
            {unit.record.decidedBy}
            {unit.record.decidedAt && <> · <LocalTime iso={unit.record.decidedAt} /></>}
          </p>
        </div>
      )}

      {open && (
        <div className="mt-4 space-y-3 rounded-2xl bg-lilac/60 p-4">
          <div role="radiogroup" aria-label={`Unit status for ${unit.code}`} className="flex flex-wrap gap-2">
            {UNIT_STATUSES.map((o) => {
              const blocked = canSetUnitStatus(role, unit.record.status, o);
              return (
                <button
                  key={o}
                  role="radio"
                  aria-checked={status === o}
                  disabled={!!blocked}
                  title={blocked ?? undefined}
                  onClick={() => setStatus(o)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${status === o ? `${unitStatusStyle[o]} ring-2 ring-current` : "bg-white text-ink hover:bg-white/70"}`}
                >
                  {o}
                </button>
              );
            })}
          </div>
          <textarea
            rows={3}
            value={feedback}
            maxLength={4000}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={status === "Not Yet Competent" ? "Why the unit is Not Yet Competent (required)" : "Unit feedback for the student (separate from module feedback)"}
            aria-label={`Feedback for ${unit.code}`}
            className="w-full resize-y rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/10 placeholder:text-ink/35 focus:ring-plum/40"
          />
          <p className="text-xs text-ink">
            {status !== "Active" ? NON_ACTIVE_WARNING : "Active: the student can use the unit when it’s opened."}{" "}
            {role === "trainer" ? "Only admin can bring a non-active unit back to Active." : "Reactivating restores the student’s saved work and module statuses."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition hover:bg-plum-light disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save unit status"}
            </button>
            <button onClick={() => setOpen(false)} className="rounded-full px-4 py-2.5 text-sm text-ink hover:bg-white/60">
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
