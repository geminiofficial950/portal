"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { getAssessment } from "@/lib/assessments";
import { requireStaff, requireStudent } from "@/lib/auth";
import { checkDeadlineChange, checkExtensionDecision, checkExtensionRequest, deadlineLocked, previewDeadlineChange, type ExtensionRequestDTO } from "@/lib/deadline-meta";
import {
  createExtensionRequest,
  decideExtensionRequest,
  DuplicateRequestError,
  getExtensionRequest,
  listExtensionRequests,
  setModuleDues,
  studentModuleDues,
} from "@/lib/deadlines";
import { liveModules } from "@/lib/module-meta";
import { notifyStudents } from "@/lib/student-notifications";
import { getStudent, hasCourse } from "@/lib/students";
import { getWork } from "@/lib/submissions";
import { trainerCanSee } from "@/lib/trainer-access";
import { getUnitRecord } from "@/lib/unit-records";
import { unitAccess } from "@/lib/unit-status-meta";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const refresh = () => {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/trainer", "layout");
  revalidatePath("/superadmin", "layout");
};

// ---------- Student ----------

/**
 * A student asks for more time on an overdue module: a reason and a proposed date. The module stays locked while
 * the request is pending, and only one request can be pending at a time (a retry or double click makes no second one).
 */
export async function requestExtensionAction(courseCode: string, unitCode: string, moduleId: string, input: { reason: string; proposedDue: string }): Promise<Result<{ request: ExtensionRequestDTO }>> {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  if (!student || student.status !== "Active" || !hasCourse(student, courseCode)) return { ok: false, error: "This isn’t one of your courses." };
  // only while the unit itself is Active and opened (an extension can't open a unit)
  const access = unitAccess(await getUnitRecord(student.studentId, courseCode, unitCode));
  if (!access.open) return { ok: false, error: `${access.reason}. ${access.next}` };
  const mod = liveModules((await getAssessment(courseCode, unitCode)).modules).find((m) => m.id === moduleId);
  if (!mod) return { ok: false, error: "Module not found." };
  const due = (await studentModuleDues(student.studentId, courseCode))[`${unitCode}/${moduleId}`] ?? null;
  const work = await getWork({ studentId: student.studentId, courseCode, unitCode, part: moduleId });
  if (!deadlineLocked(due, work?.status)) return { ok: false, error: "This module isn’t locked by its deadline." };
  const pending = (await listExtensionRequests({ studentId: student.studentId, status: "Pending" })).some((r) => r.unitCode === unitCode && r.moduleId === moduleId);
  const checked = checkExtensionRequest(input, { now: Date.now(), pending });
  if (!checked.ok) return checked;
  try {
    const request = await createExtensionRequest({
      studentId: student.studentId,
      studentName: student.name,
      courseCode,
      unitCode,
      moduleId,
      moduleTitle: mod.title,
      reason: checked.reason,
      proposedDue: new Date(checked.proposedDue),
    });
    await logActivity(student.name, `asked for an extension on “${mod.title}” (${unitCode})`, "student");
    refresh();
    return { ok: true, request };
  } catch (err) {
    if (err instanceof DuplicateRequestError) return { ok: false, error: "You already have a request waiting for a decision." };
    throw err;
  }
}

// ---------- Staff: admin, or the trainer assigned to that unit in the student's current batch ----------

async function staffMay(studentId: string, unitCode: string) {
  const staff = await requireStaff();
  if (staff.role === "trainer" && !(await trainerCanSee(staff.id, studentId, unitCode))) return null;
  return { ...staff, by: staff.role === "admin" ? staff.name : `${staff.name} · Trainer` };
}

/** Approve (with a new deadline) or decline (with a reason) an extension request. It never changes a result or opens a unit. */
export async function decideExtensionAction(requestId: string, input: { approve: boolean; newDue?: string; reason?: string }): Promise<Result<{ request: ExtensionRequestDTO }>> {
  const req = await getExtensionRequest(String(requestId));
  if (!req) return { ok: false, error: "Request not found." };
  const staff = await staffMay(req.studentId, req.unitCode);
  if (!staff) return { ok: false, error: "Only admin or the trainer assigned to this unit can decide." };
  const checked = checkExtensionDecision(input, Date.now());
  if (!checked.ok) return checked;
  const old = (await studentModuleDues(req.studentId, req.courseCode))[`${req.unitCode}/${req.moduleId}`] ?? null;
  const decided = await decideExtensionRequest(req.requestId, { approve: checked.approve, newDue: checked.newDue ? new Date(checked.newDue) : null, reason: checked.reason, by: staff.by });
  if (!decided) return { ok: false, error: "This request was already decided." };
  if (checked.approve) {
    await setModuleDues([req.studentId], { courseCode: req.courseCode, unitCode: req.unitCode, moduleId: req.moduleId }, new Date(checked.newDue!), {
      name: staff.by,
      role: staff.role,
      reason: `Extension approved${checked.reason ? `: ${checked.reason}` : ""} (student’s reason: ${req.reason})`,
    }, () => old);
  }
  // the student is told the decision (LMS guide: notify affected students of the decision)
  const when = (iso: string) => new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  await notifyStudents(
    [req.studentId],
    req.courseCode,
    checked.approve
      ? `Extension approved for “${req.moduleTitle}” (${req.unitCode}) — new due date ${when(checked.newDue!)}.`
      : `Extension declined for “${req.moduleTitle}” (${req.unitCode}): ${checked.reason}`,
  );
  await logActivity(staff.name, `${checked.approve ? "approved" : "declined"} ${req.studentName}’s extension for “${req.moduleTitle}”`, staff.role === "admin" ? "student" : "trainer");
  refresh();
  return { ok: true, request: decided };
}

type DeadlineScope = { courseCode: string; unitCode: string; moduleId: string; studentIds: string[] };

async function scopeCheck(input: DeadlineScope) {
  const staff = await requireStaff();
  const ids = [...new Set((Array.isArray(input?.studentIds) ? input.studentIds : []).map(String))];
  if (!ids.length) return { error: "Choose the students first." } as const;
  const mod = liveModules((await getAssessment(String(input.courseCode), String(input.unitCode))).modules).find((m) => m.id === input.moduleId);
  if (!mod) return { error: "Module not found." } as const;
  const students = (await Promise.all(ids.map((id) => getStudent(id)))).filter((s) => s && hasCourse(s, input.courseCode));
  if (students.length !== ids.length) return { error: "Some of those students aren’t in this course." } as const;
  if (staff.role === "trainer") {
    for (const s of students) if (!(await trainerCanSee(staff.id, s!.studentId, input.unitCode))) return { error: `${s!.name} isn’t in your batch for this unit.` } as const;
  }
  const rows = await Promise.all(
    students.map(async (s) => ({ studentId: s!.studentId, name: s!.name, currentDue: (await studentModuleDues(s!.studentId, input.courseCode))[`${input.unitCode}/${input.moduleId}`] ?? null })),
  );
  return { staff, mod, rows, by: staff.role === "admin" ? staff.name : `${staff.name} · Trainer` } as const;
}

/** Shows old and new date, module and students before a deadline change is saved */
export async function previewDeadlineAction(input: DeadlineScope & { dueAt: string }): Promise<Result<{ module: string; rows: ReturnType<typeof previewDeadlineChange> }>> {
  const ctx = await scopeCheck(input);
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const d = new Date(input.dueAt);
  if (Number.isNaN(d.getTime())) return { ok: false, error: "Choose the new due date and time." };
  return { ok: true, module: ctx.mod.title, rows: previewDeadlineChange(ctx.rows, d.toISOString()) };
}

/**
 * Sets or extends a module deadline for one student, a selected group, or every student of the batch (pass them all).
 * Only those students get an exception; later joiners keep the default. Each change is logged with who, role,
 * reason, old and new date. Results are never changed.
 */
export async function changeDeadlineAction(input: DeadlineScope & { dueAt: string; reason: string }): Promise<Result<{ changed: number }>> {
  const ctx = await scopeCheck(input);
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const checked = checkDeadlineChange(input);
  if (!checked.ok) return checked;
  const old = new Map(ctx.rows.map((r) => [r.studentId, r.currentDue]));
  await setModuleDues(ctx.rows.map((r) => r.studentId), { courseCode: input.courseCode, unitCode: input.unitCode, moduleId: input.moduleId }, new Date(checked.dueAt), {
    name: ctx.by,
    role: ctx.staff.role,
    reason: checked.reason,
  }, (id) => old.get(id) ?? null);
  const newWhen = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(checked.dueAt));
  await notifyStudents(ctx.rows.map((r) => r.studentId), input.courseCode, `New due date for “${ctx.mod.title}” (${input.unitCode}): ${newWhen}.`);
  await logActivity(ctx.staff.name, `changed the due date of “${ctx.mod.title}” (${input.unitCode}) for ${ctx.rows.length} student(s): ${checked.reason}`, ctx.staff.role === "admin" ? "student" : "trainer");
  refresh();
  return { ok: true, changed: ctx.rows.length };
}
