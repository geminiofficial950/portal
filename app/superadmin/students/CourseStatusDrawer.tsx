"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { CloseIcon } from "../../dashboard/_components/icons";
import { setCourseStatusAction } from "./actions";
import {
  COURSE_STATUS_REASON_MAX,
  courseStatusStyle,
  statusOptions,
  type CourseStatus,
} from "@/lib/course-status";
import { initials } from "@/lib/format";
import type { StudentLogDTO } from "@/lib/student-logs";

// What a status change does — said plainly. Course status is the student's standing in the course; unit access is
// still decided by each unit's own status and opening (LMS guide), so we never claim it pauses access by itself.
const effect = (to: CourseStatus) =>
  to === "Active"
    ? "The course shows as Active again. Units open and close as before. Other course enrolments and account login stay unchanged."
    : `The course shows as ${to} to the student and staff. Units keep their own status and opening. Other course enrolments and account login stay unchanged.`;

// Side panel: change one course's status for one student, with a required reason and a confirmation tick.
// Shared by the Students table (Manage) and the student's own page. `children` = extra sections (batch, account).
export default function CourseStatusDrawer({
  student,
  course,
  current,
  onClose,
  onSaved,
  children,
}: {
  student: { studentId: string; name: string };
  course: { code: string; name: string; detail?: string };
  current: CourseStatus;
  onClose: () => void;
  onSaved: (status: CourseStatus, change: StudentLogDTO) => void;
  children?: ReactNode;
}) {
  const [next, setNext] = useState<CourseStatus>(current);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, start] = useTransition();
  const changed = next !== current;
  const ready = changed && reason.trim().length > 0 && confirmed && !saving;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () =>
    start(async () => {
      const res = await setCourseStatusAction(
        student.studentId,
        course.code,
        next,
        reason,
      );
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${student.name}: ${course.code} is now ${next}`);
      onSaved(next, res.change);
    });

  const field =
    "w-full rounded-xl bg-white px-3.5 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/15 focus:ring-2 focus:ring-plum/40";

  // Rendered at the portal root (outside the page's animated container, which would trap a fixed panel inside it).
  // No dark overlay: the page stays visible and usable beside the panel, like the mockup.
  return createPortal(
    <aside
      role="dialog"
      aria-labelledby="status-drawer-title"
      className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-md flex-col overflow-y-auto border-l border-ink/10 bg-white shadow-[-12px_0_40px_-16px_rgba(29,24,56,0.35)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-6 py-5">
        <h2 id="status-drawer-title" className="text-xl font-semibold text-ink">
          Change course status
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="rounded-full p-1.5 text-ink hover:bg-lilac"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 px-6 py-5">
        <div className="flex items-center gap-3 border-b border-ink/10 pb-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-lilac text-base font-bold text-plum">
            {initials(student.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-semibold text-ink">
              {student.name}
            </span>
            <span className="block text-sm text-ink">{student.studentId}</span>
          </span>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-ink">Selected course</p>
          <div className="rounded-xl bg-lilac/60 px-4 py-3">
            <p className="font-semibold text-ink">{course.name}</p>
            <p className="text-sm text-ink">
              {course.code}
              {course.detail ? ` · ${course.detail}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-ink">Current status</p>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${courseStatusStyle[current]}`}
          >
            {current}
          </span>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">New status</span>
          <select
            value={next}
            onChange={(e) => (
              setNext(e.target.value as CourseStatus),
              setConfirmed(false)
            )}
            className={field}
          >
            {statusOptions(current).map((s) => (
              <option key={s} value={s}>
                {s}
                {s === current ? " (current)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">
            Reason for change <span className="text-rose-700">*</span>
          </span>
          <textarea
            value={reason}
            maxLength={COURSE_STATUS_REASON_MAX}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Student requested a temporary study break."
            className={`${field} resize-y`}
          />
        </label>

        {changed && (
          <div className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="font-semibold text-ink">Review before saving</p>
            <p className="text-sm text-ink">
              {current} → {next}. {effect(next)}
            </p>
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={!changed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-plum"
          />
          I confirm this change applies to the selected course.
        </label>
        <p className="text-sm text-ink">
          Changes are recorded with your name, date and reason.
        </p>

        {children}
      </div>

      <div className="sticky bottom-0 space-y-2 border-t border-ink/10 bg-white px-6 py-4">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-ink/20 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-lilac"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!ready}
            className="rounded-xl bg-plum px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-plum-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save status change"}
          </button>
        </div>
        <p className="text-right text-xs text-ink">
          Nothing changes until you save.
        </p>
      </div>
    </aside>,
    document.getElementById("portal-root") ?? document.body,
  );
}
