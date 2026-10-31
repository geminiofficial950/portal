"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { summarise, type AssessmentPart } from "@/lib/assessment-meta";
import { getAssessment } from "@/lib/assessments";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { clearStudentDueDate, setStudentDueDate } from "@/lib/due-dates";
import { getSettings } from "@/lib/settings";
import type { SubmissionStatus } from "@/lib/submission-meta";
import { getStudent } from "@/lib/students";
import { listStudentSubmissions } from "@/lib/submissions";
import { checkUnitResult, type UnitResultDTO, type UnitResultValue } from "@/lib/unit-meta";
import { clearUnitResult, setUnitResult } from "@/lib/unit-results";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const refresh = (studentId: string) => {
  revalidatePath(`/superadmin/students/${studentId}`);
  revalidatePath(`/trainer/students/${studentId}`);
  revalidatePath("/dashboard/assessment", "layout");
};

// Final unit outcome (Pass / Fail / Withdrawn) + feedback. Super Admin, or a trainer allowed to mark.
export async function setUnitResultAction(
  studentId: string,
  unitCode: string,
  result: UnitResultValue,
  feedbackIn: string,
): Promise<Result<{ outcome: UnitResultDTO }>> {
  const staff = await requireStaff();
  if (staff.role === "trainer" && !(await getSettings()).trainerPermissions.markAssessments) {
    return { ok: false, error: "Super Admin has turned off assessment marking for trainers." };
  }

  const student = await getStudent(studentId);
  const course = student ? await getCourse(student.course) : null;
  const unit = course?.units.find((u) => u.code === unitCode);
  if (!student || !course || !unit) return { ok: false, error: "Student or unit not found." };

  const feedback = String(feedbackIn ?? "").trim().slice(0, 4000);
  const [assessment, submissions] = await Promise.all([
    getAssessment(course.code, unit.code),
    listStudentSubmissions(student.studentId, course.code),
  ]);
  const statuses: Partial<Record<AssessmentPart, SubmissionStatus>> = Object.fromEntries(
    submissions.filter((s) => s.unitCode === unit.code).map((s) => [s.part, s.status]),
  );
  const problem = checkUnitResult(result, feedback, summarise(assessment), statuses);
  if (problem) return { ok: false, error: problem };

  const outcome = await setUnitResult({
    studentId: student.studentId,
    courseCode: course.code,
    unitCode: unit.code,
    result,
    feedback,
    decidedBy: staff.role === "admin" ? "Super Admin" : `${staff.name} · Trainer`,
  });
  await logActivity(staff.name, `gave ${student.name} a ${result} for ${unit.code}`, staff.role === "admin" ? "student" : "trainer");
  refresh(student.studentId);
  return { ok: true, outcome };
}

// Re-opens the unit for the student. Super Admin only.
export async function clearUnitResultAction(studentId: string, unitCode: string): Promise<Result> {
  await requireAdmin();
  const student = await getStudent(studentId);
  if (!student) return { ok: false, error: "Student not found." };
  const cleared = await clearUnitResult(student.studentId, student.course, unitCode);
  if (!cleared) return { ok: false, error: "There’s no result to remove." };
  await logActivity("Super Admin", `removed the final result for ${student.name} in ${unitCode}`, "student");
  refresh(student.studentId);
  return { ok: true };
}

// Gives one student their own due date for a unit (an extension), or puts them back on the unit's date (null).
// Super Admin only.
export async function setStudentDueAction(
  studentId: string,
  unitCode: string,
  dueIn: string | null,
): Promise<Result<{ dueAt: string | null; extended: boolean }>> {
  await requireAdmin();
  const student = await getStudent(studentId);
  const course = student ? await getCourse(student.course) : null;
  const unit = course?.units.find((u) => u.code === unitCode);
  if (!student || !course || !unit) return { ok: false, error: "Student or unit not found." };

  if (dueIn === null) {
    await clearStudentDueDate(student.studentId, course.code, unit.code);
    await logActivity("Super Admin", `put ${student.name} back on the ${unit.code} due date`, "student");
    refresh(student.studentId);
    return { ok: true, dueAt: (await getAssessment(course.code, unit.code)).dueAt, extended: false };
  }

  const due = new Date(dueIn);
  if (Number.isNaN(due.getTime())) return { ok: false, error: "Pick a valid date and time." };
  await setStudentDueDate(student.studentId, course.code, unit.code, due);
  await logActivity("Super Admin", `changed ${student.name}’s due date for ${unit.code}`, "student");
  refresh(student.studentId);
  return { ok: true, dueAt: due.toISOString(), extended: true };
}
