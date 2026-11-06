// Unit status and access (LMS guide, "Unit and module statuses" + "Important access checks").
// Every unit of a student's course has a record: its status, whether admin has opened it, and an optional
// scheduled release. Unit status is the highest content access rule: only an Active unit that admin opened
// (or whose scheduled release time has passed) shows its modules. Any other status hides and disables them all.
// Shared by server code and client components (no server-only imports here).

export const UNIT_STATUSES = ["Active", "Inactive", "Withdrawn", "Cancelled", "Deferred", "Competent", "Not Yet Competent"] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];
export const isUnitStatus = (v: unknown): v is UnitStatus => UNIT_STATUSES.includes(v as UnitStatus);

export const unitStatusStyle: Record<UnitStatus, string> = {
  Active: "bg-emerald-100 text-emerald-800",
  Inactive: "bg-slate-200 text-slate-800",
  Withdrawn: "bg-rose-100 text-rose-800",
  Cancelled: "bg-rose-100 text-rose-800",
  Deferred: "bg-amber-100 text-amber-900",
  Competent: "bg-sky-100 text-sky-800",
  "Not Yet Competent": "bg-orange-100 text-orange-900",
};

export type UnitRecord = { status: UnitStatus; opened: boolean; releaseAt: string | null };

/** A unit nobody has touched yet: assigned, Active, not opened */
export const defaultRecord = (): UnitRecord => ({ status: "Active", opened: false, releaseAt: null });

export type UnitAccess = { open: boolean; reason: string | null; next: string | null };

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/**
 * Can the student see this unit's modules right now? A lock always comes with a reason and what happens next.
 * Order matters: a non-active status wins over everything (an opened or released unit stays hidden).
 */
export function unitAccess(rec: UnitRecord | null | undefined, now = Date.now()): UnitAccess {
  const r = rec ?? defaultRecord();
  if (r.status !== "Active") {
    const done = r.status === "Competent" || r.status === "Not Yet Competent";
    return { open: false, reason: `Unit status: ${r.status}`, next: done ? "This unit has its result. Its activities are closed." : "Contact the college if you think this is wrong." };
  }
  if (r.opened) return { open: true, reason: null, next: null };
  if (r.releaseAt && new Date(r.releaseAt).getTime() <= now) return { open: true, reason: null, next: null };
  if (r.releaseAt) return { open: false, reason: `Opens ${fmt(r.releaseAt)}`, next: "It opens by itself at that time." };
  return { open: false, reason: "Not open yet", next: "The college opens each unit when it’s time." };
}

/**
 * Who may change a unit's status. Admin may set any status. An assigned trainer may record a non-active status
 * (e.g. Competent, Withdrawn) but can never bring a non-active unit back to Active.
 */
export function canSetUnitStatus(role: "admin" | "trainer", from: UnitStatus, to: UnitStatus): string | null {
  if (!isUnitStatus(to)) return "Unknown unit status.";
  if (role === "trainer" && to === "Active" && from !== "Active") return "Only admin can reactivate a unit.";
  return null;
}

export const NON_ACTIVE_WARNING = "Setting a non-active status hides every module of this unit from the student straight away.";

/**
 * Opening (or scheduling) a unit for many students at once. Students whose record for this unit is an explicit
 * exception — a non-active status — are left alone unless admin chooses to reset exceptions. Returns who will
 * change and who is skipped (with why), for the preview shown before saving.
 */
export function planBulkOpen(students: { studentId: string; record: UnitRecord | null }[], resetExceptions = false) {
  const affected: string[] = [];
  const skipped: { studentId: string; reason: string }[] = [];
  for (const s of students) {
    const status = s.record?.status ?? "Active";
    if (status !== "Active" && !resetExceptions) skipped.push({ studentId: s.studentId, reason: `Unit is ${status} for this student` });
    else affected.push(s.studentId);
  }
  return { affected, skipped };
}

// ---------- Trainers: batch + unit assignments ----------

export type BatchTrainers = { batchId: string; trainers: { trainerId: string; unitCodes: string[] }[]; units: string[] };

/**
 * A trainer may see a student's unit only when the student is CURRENTLY in a batch where that trainer is assigned
 * to that unit. Marking earlier work gives no access, and an old batch gives none after a transfer.
 */
export function trainerCanAccess(trainerId: string, studentBatchIds: string[], unitCode: string, batches: BatchTrainers[]): boolean {
  return batches.some(
    (b) => studentBatchIds.includes(b.batchId) && b.trainers.some((t) => t.trainerId === trainerId && t.unitCodes.includes(unitCode)),
  );
}

/** Units a trainer covers in a batch */
export const trainerUnits = (trainerId: string, b: BatchTrainers) => b.trainers.find((t) => t.trainerId === trainerId)?.unitCodes ?? [];

/**
 * Extra checks when staff record a unit status. Competent needs every marked module Satisfactory (staff still choose it —
 * it is never set automatically); Not Yet Competent needs feedback so the student knows why.
 */
export function checkUnitStatusChange(
  to: UnitStatus,
  feedback: string,
  parts: { key: string; label: string }[],
  statuses: Partial<Record<string, string>>,
): string | null {
  if (to === "Not Yet Competent" && !feedback.trim()) return "Add feedback explaining why the unit is Not Yet Competent.";
  if (to === "Competent") {
    if (!parts.length) return "This unit has no marked modules yet, so it can’t be Competent.";
    const missing = parts.filter((p) => statuses[p.key] !== "Accepted").map((p) => p.label);
    if (missing.length) return `Not every module is Satisfactory yet: ${missing.join(", ")}.`;
  }
  return null;
}
