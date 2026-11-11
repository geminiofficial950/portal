"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { studentRecords, type AffectedRecords } from "@/lib/affected-records";
import { adminActor, DELETE_SUPER_ADMIN_ONLY, requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { COURSE_STATUS_LOG, COURSE_STATUS_REASON_MAX, isCourseStatus, type CourseStatus } from "@/lib/course-status";
import { listCourses } from "@/lib/courses";
import { listBatches } from "@/lib/groups";
import { checkLoginEmail, checkStudentId } from "@/lib/group-meta";
import { changeStudentLogin, IdentityTakenError } from "@/lib/identity";
import {
  createStudent,
  deleteStudent,
  getStudent,
  DuplicateEmailError,
  DuplicateStudentIdError,
  resetStudentPassword,
  setStudentCourseStatus,
  setStudentBatches,
  setStudentCourses,
  updateStudentStatus,
  type StudentDTO,
  type StudentStatus,
} from "@/lib/students";
import { logStudent, type StudentLogDTO } from "@/lib/student-logs";

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
  batchIds?: string[]; // optional: a batch for any of the chosen courses (one per course)
}): Promise<Result<{ student: StudentDTO }>> {
  const admin = await requireAdmin();

  const name = input.name.trim();
  const email = input.email.trim();
  if (!name) return { ok: false, error: "Name is required." };
  const courses = await checkCourses(input.courses);
  if ("error" in courses) return { ok: false, error: courses.error };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email." };
  if (input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  // batches picked while enrolling: each must exist and belong to one of the chosen courses, one per course
  const picked = [...new Set((Array.isArray(input.batchIds) ? input.batchIds : []).map(String).filter(Boolean))];
  const allBatches = picked.length ? await listBatches() : [];
  const batches = picked.map((id) => allBatches.find((b) => b.batchId === id));
  if (batches.some((b) => !b)) return { ok: false, error: "A chosen batch no longer exists." };
  if (batches.some((b) => !b!.courseCode || !courses.codes.includes(b!.courseCode))) return { ok: false, error: "Each batch must belong to one of the student’s courses." };
  if (new Set(batches.map((b) => b!.courseCode)).size !== batches.length) return { ok: false, error: "Pick at most one batch per course." };

  let studentId: string | undefined;
  if (input.studentId?.trim()) {
    const checked = checkStudentId(input.studentId);
    if ("error" in checked) return { ok: false, error: checked.error };
    studentId = checked.id;
  }

  try {
    const student = await createStudent({ name, email, courses: courses.codes, password: input.password, studentId });
    await logActivity(student.name, `was enrolled in ${courses.codes.join(", ")} (${student.studentId})`, "student");
    if (batches.length) {
      await setStudentBatches(student.studentId, picked);
      for (const b of batches) {
        await logStudent({ studentId: student.studentId, studentName: student.name, courseCode: b!.courseCode, action: "Batch changed", detail: `added to ${b!.name} by ${admin.label} (when enrolled)` });
      }
      await logActivity(admin.label, `put ${student.name} in ${batches.map((b) => b!.name).join(", ")}`, "student");
    }
    revalidatePath("/superadmin", "layout");
    return { ok: true, student: { ...student, batchIds: picked } };
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
// A reason is required; the change is recorded on the student's log with the staff name, date and reason
export async function setCourseStatusAction(studentId: string, courseCode: string, courseStatus: CourseStatus, reasonIn: string): Promise<Result<{ change: StudentLogDTO }>> {
  const actor = await adminActor();
  if (!isCourseStatus(courseStatus)) return { ok: false, error: "Unknown course status." };
  const reason = String(reasonIn ?? "").replace(/\s+/g, " ").trim();
  if (!reason) return { ok: false, error: "Write the reason for the change." };
  if (reason.length > COURSE_STATUS_REASON_MAX) return { ok: false, error: `Keep the reason under ${COURSE_STATUS_REASON_MAX} characters.` };
  const student = await getStudent(studentId);
  const current = student?.courses.find((c) => c.code === courseCode);
  if (!student || !current) return { ok: false, error: "Student or course not found." };
  if (current.status === courseStatus) return { ok: false, error: `${courseCode} is already ${courseStatus}.` };
  await setStudentCourseStatus(studentId, courseCode, courseStatus);
  await logActivity(actor, `set ${studentId}’s course status for ${courseCode} to ${courseStatus} — ${reason}`, "student");
  const detail = `${current.status} → ${courseStatus} · ${reason} · by ${actor}`;
  await logStudent({ studentId, studentName: student.name, courseCode, action: COURSE_STATUS_LOG, detail });
  const change: StudentLogDTO = { studentId, studentName: student.name, courseCode, unitCode: null, action: COURSE_STATUS_LOG, detail, at: new Date().toISOString() };
  revalidatePath(`/superadmin/students/${studentId}`);
  revalidatePath("/superadmin/students");
  revalidatePath("/dashboard/course");
  return { ok: true, change };
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

// Super Admin only: change a student's login email and/or student ID. A new ID is carried across all their records
// (work, results, requests, logs, files), so nothing is left behind. Their old session ends; the password stays.
export async function changeStudentLoginAction(studentId: string, input: { email: string; studentId: string }): Promise<Result<{ student: StudentDTO; moved: number }>> {
  const admin = await requireSuperAdmin();
  const email = checkLoginEmail(String(input?.email ?? ""));
  if ("error" in email) return { ok: false, error: email.error };
  const id = checkStudentId(String(input?.studentId ?? ""));
  if ("error" in id) return { ok: false, error: id.error };
  let res;
  try {
    res = await changeStudentLogin(String(studentId), { id: id.id, email: email.email });
  } catch (err) {
    if (err instanceof IdentityTakenError) return { ok: false, error: err.message };
    throw err;
  }
  if (!res) return { ok: false, error: "Student not found." };
  const student = (await getStudent(id.id))!;
  const changes = [res.before.id !== id.id ? `ID ${res.before.id} → ${id.id}` : "", res.before.email !== email.email ? `email ${res.before.email} → ${email.email}` : ""].filter(Boolean).join(", ");
  if (changes) {
    await logActivity(admin.label, `changed ${student.name}’s login: ${changes}`, "student");
    await logStudent({ studentId: id.id, studentName: student.name, action: "Login details changed", detail: `${changes} · by ${admin.label}` });
  }
  revalidatePath("/superadmin", "layout");
  return { ok: true, student, moved: res.moved };
}
