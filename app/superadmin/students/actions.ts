"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { studentRecords, type AffectedRecords } from "@/lib/affected-records";
import { adminActor, DELETE_SUPER_ADMIN_ONLY, requireAdmin } from "@/lib/auth";
import { isCourseStatus, type CourseStatus } from "@/lib/course-status";
import { listCourses } from "@/lib/courses";
import { checkStudentId } from "@/lib/group-meta";
import {
  createStudent,
  deleteStudent,
  getStudent,
  hasCourse,
  DuplicateEmailError,
  DuplicateStudentIdError,
  resetStudentPassword,
  setStudentCourseStatus,
  setStudentCourses,
  updateStudentStatus,
  type StudentDTO,
  type StudentStatus,
} from "@/lib/students";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES: StudentStatus[] = ["Active", "Pending", "Suspended"];

// Unique, existing course codes in the order given — or an error
async function checkCourses(codesIn: unknown): Promise<{ codes: string[] } | { error: string }> {
  const codes = [...new Set((Array.isArray(codesIn) ? codesIn : []).map((c) => String(c).trim()).filter(Boolean))];
  if (codes.length === 0) return { error: "Pick at least one course." };
  const known = new Set((await listCourses()).map((c) => c.code));
  const unknown = codes.find((c) => !known.has(c));
  return unknown ? { error: `Course ${unknown} doesn’t exist.` } : { codes };
}

export async function createStudentAction(input: {
  name: string;
  email: string;
  courses: string[];
  password: string;
  studentId?: string; // blank = next S-number
}): Promise<Result<{ student: StudentDTO }>> {
  await requireAdmin();

  const name = input.name.trim();
  const email = input.email.trim();
  if (!name) return { ok: false, error: "Name is required." };
  const courses = await checkCourses(input.courses);
  if ("error" in courses) return { ok: false, error: courses.error };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email." };
  if (input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  let studentId: string | undefined;
  if (input.studentId?.trim()) {
    const checked = checkStudentId(input.studentId);
    if ("error" in checked) return { ok: false, error: checked.error };
    studentId = checked.id;
  }

  try {
    const student = await createStudent({ name, email, courses: courses.codes, password: input.password, studentId });
    await logActivity(student.name, `was enrolled in ${courses.codes.join(", ")} (${student.studentId})`, "student");
    revalidatePath("/superadmin", "layout");
    return { ok: true, student };
  } catch (err) {
    if (err instanceof DuplicateEmailError) return { ok: false, error: "A student with this email already exists." };
    if (err instanceof DuplicateStudentIdError) return { ok: false, error: `Student ID ${studentId} is already taken.` };
    console.error("createStudent failed:", err);
    return { ok: false, error: "Couldn’t save the student. Try again." };
  }
}

export async function setStudentStatusAction(studentId: string, status: StudentStatus): Promise<Result> {
  await requireAdmin();
  if (!STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  const found = await updateStudentStatus(studentId, status);
  if (found) await logActivity(await adminActor(), `set ${studentId} to ${status.toLowerCase()}`, "student");
  revalidatePath("/superadmin", "layout");
  return found ? { ok: true } : { ok: false, error: "Student not found." };
}

export async function resetPasswordAction(studentId: string, password: string): Promise<Result> {
  await requireAdmin();
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  const found = await resetStudentPassword(studentId, password);
  if (found) await logActivity(await adminActor(), `reset the password for ${studentId}`, "student");
  return found ? { ok: true } : { ok: false, error: "Student not found." };
}

// What deleting this student would affect (shown before confirming). Super Admin only.
export async function previewStudentDeletionAction(studentId: string): Promise<Result<{ records: AffectedRecords }>> {
  const admin = await requireAdmin();
  if (!admin.isSuper) return { ok: false, error: DELETE_SUPER_ADMIN_ONLY };
  return { ok: true, records: await studentRecords(String(studentId)) };
}

// Super Admin only — an Admin disables the account instead. Removes the login and profile; the student's academic
// records (submissions, statuses, documents, logs) are kept, never deleted in a cascade.
export async function deleteStudentAction(studentId: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!admin.isSuper) return { ok: false, error: DELETE_SUPER_ADMIN_ONLY };
  const found = await deleteStudent(studentId);
  if (found) await logActivity(await adminActor(), `deleted student ${studentId}`, "student");
  revalidatePath("/superadmin", "layout");
  return found ? { ok: true } : { ok: false, error: "Student not found." };
}

// Active, Completed, Risk of withdrawal… for one of the student's courses — shown on their Course page
export async function setCourseStatusAction(studentId: string, courseCode: string, courseStatus: CourseStatus): Promise<Result> {
  await requireAdmin();
  if (!isCourseStatus(courseStatus)) return { ok: false, error: "Unknown course status." };
  const student = await getStudent(studentId);
  if (!student || !hasCourse(student, courseCode)) return { ok: false, error: "Student or course not found." };
  await setStudentCourseStatus(studentId, courseCode, courseStatus);
  await logActivity(await adminActor(), `set ${studentId}’s course status for ${courseCode} to ${courseStatus}`, "student");
  revalidatePath(`/superadmin/students/${studentId}`);
  revalidatePath("/superadmin/students");
  revalidatePath("/dashboard/course");
  return { ok: true };
}

// Enrol a student in more courses or take one away. Work done in a removed course is kept.
export async function setStudentCoursesAction(studentId: string, codesIn: string[]): Promise<Result> {
  await requireAdmin();
  const courses = await checkCourses(codesIn);
  if ("error" in courses) return { ok: false, error: courses.error };
  if (!(await setStudentCourses(studentId, courses.codes))) return { ok: false, error: "Student not found." };
  await logActivity(await adminActor(), `set ${studentId}’s courses to ${courses.codes.join(", ")}`, "student");
  revalidatePath("/superadmin", "layout");
  revalidatePath("/trainer", "layout");
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

// Batches are managed on their own page: app/superadmin/batches/actions.ts
