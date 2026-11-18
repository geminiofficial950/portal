"use server";

import { revalidatePath } from "next/cache";
import { mailUpdates } from "@/lib/student-mail";
import { logActivity } from "@/lib/activity";
import { partsOf, unitDueAt, type AssessmentPart } from "@/lib/assessment-meta";
import { trainerCanSee } from "@/lib/trainer-access";
import { getUnitRecord, listUnitRecords, setUnitDecidedAt, setUnitOpening, setUnitStatus, type FullUnitRecord } from "@/lib/unit-records";
import { formatStamp } from "@/lib/format";
import { canSetUnitStatus, checkUnitStatusChange, isUnitStatus, type UnitStatus } from "@/lib/unit-status-meta";
import { getAssessment } from "@/lib/assessments";
import { adminActor, DATES_SUPER_ADMIN_ONLY, requireAdmin, requireStaff } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { clearStudentDueDate, setStudentDueDate } from "@/lib/due-dates";
import { setUnitHidden } from "@/lib/hidden-units";
import { notifyUnitChange } from "@/lib/student-notifications";
import { getSettings } from "@/lib/settings";
import type { SubmissionStatus } from "@/lib/submission-meta";
import { getStudent, hasCourse } from "@/lib/students";
import { listStudentSubmissions } from "@/lib/submissions";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const refresh = (studentId: string) => {
  revalidatePath(`/superadmin/students/${studentId}`);
  revalidatePath(`/trainer/students/${studentId}`);
  revalidatePath("/dashboard/assessment", "layout");
};

// Records a unit status (Active, Inactive, Withdrawn, Cancelled, Deferred, Competent, Not Yet Competent) and unit
// feedback. Admin may set any status. A trainer may do it only for a student currently in their batch and a unit
// assigned to them, may record a non-active status, but can never bring a non-active unit back to Active.
// Nothing is automatic: module results never set the unit status by themselves.
export async function setUnitStatusAction(
  studentId: string,
  courseCode: string,
  unitCode: string,
  status: UnitStatus,
  feedbackIn: string,
): Promise<Result<{ record: FullUnitRecord }>> {
  const staff = await requireStaff();
  if (staff.role === "trainer") {
    if (!(await getSettings()).trainerPermissions.markAssessments) return { ok: false, error: "Assessment marking is turned off for trainers." };
    if (!(await trainerCanSee(staff.id, studentId, unitCode))) return { ok: false, error: "You can only work on units assigned to you in this student’s current batch." };
  }
  const student = await getStudent(studentId);
  const course = student && hasCourse(student, courseCode) ? await getCourse(courseCode) : null;
  const unit = course?.units.find((u) => u.code === unitCode);
  if (!student || !course || !unit) return { ok: false, error: "Student or unit not found." };
  if (!isUnitStatus(status)) return { ok: false, error: "Unknown unit status." };

  const current = await getUnitRecord(student.studentId, course.code, unit.code);
  const denied = canSetUnitStatus(staff.role, current.status, status);
  if (denied) return { ok: false, error: denied };

  const feedback = String(feedbackIn ?? "").trim().slice(0, 4000);
  const [assessment, submissions] = await Promise.all([getAssessment(course.code, unit.code), listStudentSubmissions(student.studentId, course.code)]);
  const statuses: Partial<Record<AssessmentPart, SubmissionStatus>> = Object.fromEntries(
    submissions.filter((s) => s.unitCode === unit.code).map((s) => [s.part, s.status]),
  );
  const problem = checkUnitStatusChange(status, feedback, partsOf(assessment), statuses);
  if (problem) return { ok: false, error: problem };

  await setUnitStatus(student.studentId, course.code, unit.code, status, { name: staff.role === "admin" ? staff.name : `${staff.name} · Trainer`, role: staff.role }, feedback);
  await logActivity(staff.name, `set ${unit.code} to ${status} for ${student.name}`, staff.role === "admin" ? "student" : "trainer");
  refresh(student.studentId);
  revalidatePath("/dashboard", "layout");
  return { ok: true, record: await getUnitRecord(student.studentId, course.code, unit.code) };
}

// Super Admin: change the date of a unit's status — e.g. the day it became Competent. The record has to read in
// order, so it can't be before the unit's last module was submitted or marked (change those dates first), or in
// the future. The status itself, who decided it and the feedback don't change; the old date stays in the history.
export async function setUnitDecidedAtAction(
  studentId: string,
  courseCode: string,
  unitCode: string,
  iso: string,
): Promise<Result<{ record: FullUnitRecord }>> {
  if (!(await requireAdmin()).isSuper) return { ok: false, error: DATES_SUPER_ADMIN_ONLY };
  const student = await getStudent(studentId);
  const course = student && hasCourse(student, courseCode) ? await getCourse(courseCode) : null;
  const unit = course?.units.find((u) => u.code === unitCode);
  if (!student || !course || !unit) return { ok: false, error: "Student or unit not found." };
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Pick a valid date and time." };
  if (when.getTime() > Date.now() + 60_000) return { ok: false, error: "The date can’t be in the future." };

  const current = await getUnitRecord(student.studentId, course.code, unit.code);
  if (!current.decidedAt) return { ok: false, error: "This unit has no status decision yet. Set the unit status first." };

  // the latest submitted / marked date of the unit's work
  const work = (await listStudentSubmissions(student.studentId, course.code)).filter((s) => s.unitCode === unit.code);
  const last = work
    .flatMap((s) => [s.submittedAt && { at: s.submittedAt, what: "submitted" }, s.decidedAt && { at: s.decidedAt, what: "marked" }])
    .filter((x): x is { at: string; what: string } => !!x)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  if (last && when < new Date(last.at)) {
    return {
      ok: false,
      error: `${unit.code} can’t be ${current.status} before its last module was ${last.what} (${formatStamp(new Date(last.at))}). Change that date first.`,
    };
  }

  const admin = await adminActor();
  const saved = await setUnitDecidedAt(student.studentId, course.code, unit.code, when, admin);
  if (!saved) return { ok: false, error: "This unit has no status decision yet. Set the unit status first." };
  const { previous, ...record } = saved;
  await logActivity(
    admin,
    `changed the ${current.status} date of ${unit.code} for ${student.name} from ${formatStamp(new Date(previous))} to ${formatStamp(when)}`,
    "student",
  );
  refresh(student.studentId);
  revalidatePath("/dashboard", "layout");
  return { ok: true, record };
}

// Admin opens units for one student now, schedules them, or closes them again. Used to open a missed unit later
// for one student even when the batch has moved on. Work and statuses are never changed by this.
export async function setUnitOpeningAction(
  studentId: string,
  courseCode: string,
  unitCodes: string[],
  change: { open: boolean; releaseAt?: string | null },
): Promise<Result<{ records: Record<string, FullUnitRecord> }>> {
  const admin = await requireAdmin();
  const student = await getStudent(studentId);
  const course = student && hasCourse(student, courseCode) ? await getCourse(courseCode) : null;
  const codes = Array.isArray(unitCodes) ? unitCodes.filter((c) => course?.units.some((u) => u.code === c)) : [];
  if (!student || !course || !codes.length) return { ok: false, error: "Student or unit not found." };
  let releaseAt: Date | null = null;
  if (!change.open && change.releaseAt) {
    releaseAt = new Date(change.releaseAt);
    if (Number.isNaN(releaseAt.getTime())) return { ok: false, error: "Pick a valid release date and time." };
  }
  for (const code of codes) await setUnitOpening([student.studentId], course.code, code, { open: change.open, releaseAt }, admin.label);
  if (change.open || releaseAt) await notifyUnitChange(student.studentId, course.code, "unlocked", course.units.filter((u) => codes.includes(u.code)));
  if (change.open) await mailUpdates({ studentIds: [student.studentId], kind: "course", courseCodes: [course.code], unitCodes: codes }); // a unit was opened for them
  const what = codes.length === 1 ? codes[0] : `${codes.length} units`;
  await logActivity(admin.label, `${change.open ? "opened" : releaseAt ? "scheduled" : "closed"} ${what} for ${student.name}`, "student");
  refresh(student.studentId);
  revalidatePath("/dashboard", "layout");
  return { ok: true, records: await listUnitRecords(student.studentId, course.code) };
}

// Gives one student their own due date for a unit (an extension), or puts them back on the unit's date (null).
// Super Admin only.
export async function setStudentDueAction(
  studentId: string,
  courseCode: string,
  unitCode: string,
  dueIn: string | null,
): Promise<Result<{ dueAt: string | null; extended: boolean }>> {
  if (!(await requireAdmin()).isSuper) return { ok: false, error: DATES_SUPER_ADMIN_ONLY };
  const student = await getStudent(studentId);
  const course = student && hasCourse(student, courseCode) ? await getCourse(courseCode) : null;
  const unit = course?.units.find((u) => u.code === unitCode);
  if (!student || !course || !unit) return { ok: false, error: "Student or unit not found." };

  if (dueIn === null) {
    await clearStudentDueDate(student.studentId, course.code, unit.code);
    await logActivity(await adminActor(), `put ${student.name} back on the ${unit.code} due date`, "student");
    refresh(student.studentId);
    return { ok: true, dueAt: unitDueAt(await getAssessment(course.code, unit.code)), extended: false };
  }

  const due = new Date(dueIn);
  if (Number.isNaN(due.getTime())) return { ok: false, error: "Pick a valid date and time." };
  await setStudentDueDate(student.studentId, course.code, unit.code, due);
  await logActivity(await adminActor(), `changed ${student.name}’s due date for ${unit.code}`, "student");
  refresh(student.studentId);
  return { ok: true, dueAt: due.toISOString(), extended: true };
}

// Hides a unit from one student (or shows it again). Their work in it is kept. Super Admin only.
export async function setUnitHiddenAction(studentId: string, courseCode: string, unitCode: string, hidden: boolean): Promise<Result> {
  await requireAdmin();
  const student = await getStudent(studentId);
  const course = student && hasCourse(student, courseCode) ? await getCourse(courseCode) : null;
  const unit = course?.units.find((u) => u.code === unitCode);
  if (!student || !course || !unit) return { ok: false, error: "Student or unit not found." };
  await setUnitHidden(student.studentId, course.code, unit.code, hidden);
  await notifyUnitChange(student.studentId, course.code, hidden ? "hidden" : "shown", [unit]);
  await logActivity(await adminActor(), `${hidden ? "hid" : "showed"} ${unit.code} ${hidden ? "from" : "to"} ${student.name}`, "student");
  refresh(student.studentId);
  revalidatePath("/dashboard/course");
  revalidatePath("/dashboard");
  return { ok: true };
}
