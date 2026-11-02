"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { summarise, type AssessmentPart } from "@/lib/assessment-meta";
import { getAssessment } from "@/lib/assessments";
import { adminActor, DATES_SUPER_ADMIN_ONLY, requireAdmin, requireStaff } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { clearStudentDueDate, setStudentDueDate } from "@/lib/due-dates";
import { setUnitHidden } from "@/lib/hidden-units";
import { getSettings } from "@/lib/settings";
import type { SubmissionStatus } from "@/lib/submission-meta";
import { getStudent, hasCourse } from "@/lib/students";
import { listStudentSubmissions } from "@/lib/submissions";
import { listResultOptions } from "@/lib/result-options";
import { checkUnitResult, type UnitResultDTO } from "@/lib/unit-meta";
import { clearUnitResult, setUnitResult } from "@/lib/unit-results";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const refresh = (studentId: string) => {
  revalidatePath(`/superadmin/students/${studentId}`);
  revalidatePath(`/trainer/students/${studentId}`);
  revalidatePath("/dashboard/assessment", "layout");
};

// Final unit outcome (one of the result options, e.g. Pass / Fail / Withdrawn) + feedback. Super Admin, or a trainer allowed to mark.
export async function setUnitResultAction(
  studentId: string,
  courseCode: string,
  unitCode: string,
  result: string,
  feedbackIn: string,
): Promise<Result<{ outcome: UnitResultDTO }>> {
  const staff = await requireStaff();
  if (staff.role === "trainer" && !(await getSettings()).trainerPermissions.markAssessments) {
    return { ok: false, error: "Super Admin has turned off assessment marking for trainers." };
  }

  const student = await getStudent(studentId);
  const course = student && hasCourse(student, courseCode) ? await getCourse(courseCode) : null;
  const unit = course?.units.find((u) => u.code === unitCode);
  if (!student || !course || !unit) return { ok: false, error: "Student or unit not found." };

  const feedback = String(feedbackIn ?? "").trim().slice(0, 4000);
  const [assessment, submissions, options] = await Promise.all([
    getAssessment(course.code, unit.code),
    listStudentSubmissions(student.studentId, course.code),
    listResultOptions(),
  ]);
  const statuses: Partial<Record<AssessmentPart, SubmissionStatus>> = Object.fromEntries(
    submissions.filter((s) => s.unitCode === unit.code).map((s) => [s.part, s.status]),
  );
  const option = options.find((o) => o.id === result);
  const problem = checkUnitResult(option, feedback, summarise(assessment), statuses);
  if (problem) return { ok: false, error: problem };

  const outcome = await setUnitResult({
    studentId: student.studentId,
    courseCode: course.code,
    unitCode: unit.code,
    result: option!.id,
    feedback,
    decidedBy: staff.role === "admin" ? staff.name : `${staff.name} · Trainer`,
  });
  await logActivity(staff.name, `gave ${student.name} a ${outcome.label} for ${unit.code}`, staff.role === "admin" ? "student" : "trainer");
  refresh(student.studentId);
  return { ok: true, outcome };
}

// Re-opens the unit for the student. Super Admin only.
export async function clearUnitResultAction(studentId: string, courseCode: string, unitCode: string): Promise<Result> {
  await requireAdmin();
  const student = await getStudent(studentId);
  if (!student || !hasCourse(student, courseCode)) return { ok: false, error: "Student not found." };
  const cleared = await clearUnitResult(student.studentId, courseCode, unitCode);
  if (!cleared) return { ok: false, error: "There’s no result to remove." };
  await logActivity(await adminActor(), `removed the final result for ${student.name} in ${unitCode}`, "student");
  refresh(student.studentId);
  return { ok: true };
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
    return { ok: true, dueAt: (await getAssessment(course.code, unit.code)).dueAt, extended: false };
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
  await logActivity(await adminActor(), `${hidden ? "hid" : "showed"} ${unit.code} ${hidden ? "from" : "to"} ${student.name}`, "student");
  refresh(student.studentId);
  revalidatePath("/dashboard/course");
  return { ok: true };
}
