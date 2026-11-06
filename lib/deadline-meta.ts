// Module deadlines, locks and extension requests (LMS guide, "Deadlines locks and extension requests").
// Each module has a default due date; a student can have their own (an exception). When the deadline passes, the
// module's content and submission lock, but its name, deadline and "Request extension" stay. Unit status still
// overrides everything: an extension never opens a non-active or unopened unit, and never changes a result.
// Shared by server code and client components (no server-only imports here).

export const EXTENSION_STATUSES = ["Pending", "Approved", "Declined"] as const;
export type ExtensionStatus = (typeof EXTENSION_STATUSES)[number];

export type ExtensionRequestDTO = {
  requestId: string;
  studentId: string;
  studentName: string;
  courseCode: string;
  unitCode: string;
  moduleId: string;
  moduleTitle: string;
  reason: string;
  proposedDue: string; // ISO
  status: ExtensionStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string; // why it was declined (or a note on approval)
  newDue: string | null; // the deadline set on approval
  createdAt: string;
};

export const DEADLINE_LIMITS = { reason: 1000 } as const;

/** The deadline that applies to one student: their own module date, else an older per-unit date, else the module's */
export const effectiveDue = (moduleDue: string | null, unitOverride: string | null, moduleOverride: string | null) => moduleOverride ?? unitOverride ?? moduleDue;

export const isOverdue = (due: string | null, now = Date.now()) => !!due && now > new Date(due).getTime();

/**
 * Is this module locked for the student by its deadline? Only work they still have to hand in locks:
 * work already submitted (Pending marking) or marked Satisfactory isn't affected, and staff can always mark it.
 */
export function deadlineLocked(due: string | null, status: string | undefined, now = Date.now()) {
  if (!isOverdue(due, now)) return false;
  return !status || status === "Draft" || status === "Rejected" || status === "MoreDocs";
}

const parseFuture = (raw: unknown, now: number, label: string): { iso: string } | { error: string } => {
  const d = new Date(String(raw ?? ""));
  if (!raw || Number.isNaN(d.getTime())) return { error: `Choose the ${label}.` };
  if (d.getTime() <= now) return { error: `The ${label} must be in the future.` };
  return { iso: d.toISOString() };
};

/** A student's extension request: a reason and a proposed new date. No second request while one is pending. */
export function checkExtensionRequest(
  input: { reason?: unknown; proposedDue?: unknown },
  ctx: { now: number; pending: boolean },
): { ok: true; reason: string; proposedDue: string } | { ok: false; error: string } {
  if (ctx.pending) return { ok: false, error: "You already have a request waiting for a decision." };
  const reason = String(input?.reason ?? "").trim().slice(0, DEADLINE_LIMITS.reason);
  if (!reason) return { ok: false, error: "Tell your trainer why you need more time." };
  const due = parseFuture(input?.proposedDue, ctx.now, "date you’re asking for");
  if ("error" in due) return { ok: false, error: due.error };
  return { ok: true, reason, proposedDue: due.iso };
}

/** Staff decision. Approving needs a new deadline in the future; declining needs a reason the student will see. */
export function checkExtensionDecision(
  input: { approve: boolean; newDue?: unknown; reason?: unknown },
  now: number,
): { ok: true; approve: boolean; newDue: string | null; reason: string } | { ok: false; error: string } {
  const reason = String(input?.reason ?? "").trim().slice(0, DEADLINE_LIMITS.reason);
  if (!input?.approve) {
    if (!reason) return { ok: false, error: "Give the reason for declining — the student will see it." };
    return { ok: true, approve: false, newDue: null, reason };
  }
  const due = parseFuture(input?.newDue, now, "new due date");
  if ("error" in due) return { ok: false, error: due.error };
  return { ok: true, approve: true, newDue: due.iso, reason };
}

/** Staff changing a deadline (one student, a selected group, or the whole batch): a valid date and a reason for the log */
export function checkDeadlineChange(input: { dueAt?: unknown; reason?: unknown }): { ok: true; dueAt: string; reason: string } | { ok: false; error: string } {
  const d = new Date(String(input?.dueAt ?? ""));
  if (!input?.dueAt || Number.isNaN(d.getTime())) return { ok: false, error: "Choose the new due date and time." };
  const reason = String(input?.reason ?? "").trim().slice(0, DEADLINE_LIMITS.reason);
  if (!reason) return { ok: false, error: "Write the reason for the change (it goes in the log)." };
  return { ok: true, dueAt: d.toISOString(), reason };
}

/**
 * Preview of a deadline change for selected students: old and new date for each, before saving.
 * Only the selected students get an exception — students added to the batch later keep the module's default date.
 */
export function previewDeadlineChange(students: { studentId: string; name: string; currentDue: string | null }[], newDue: string) {
  return students.map((s) => ({ ...s, newDue, changes: s.currentDue !== newDue }));
}
