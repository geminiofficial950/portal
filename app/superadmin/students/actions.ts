"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { adminActor, requireAdmin } from "@/lib/auth";
import { isCourseStatus, type CourseStatus } from "@/lib/course-status";
import { listCourses } from "@/lib/courses";
import { checkStudentId, GROUP_NAME_MAX, type GroupDTO } from "@/lib/group-meta";
import { createGroup, deleteGroup, DuplicateGroupError, groupExists, renameGroup } from "@/lib/groups";
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
  setStudentGroup,
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
  groupId?: string | null;
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
  const groupId = input.groupId || null;
  if (groupId && !(await groupExists(groupId))) return { ok: false, error: "That group no longer exists." };

  try {
    const student = await createStudent({ name, email, courses: courses.codes, password: input.password, studentId, groupId });
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

export async function deleteStudentAction(studentId: string): Promise<Result> {
  await requireAdmin();
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

// ---------- Groups ----------

const cleanGroupName = (raw: string) => String(raw ?? "").trim().replace(/s+/g, " ");

export async function createGroupAction(rawName: string): Promise<Result<{ group: GroupDTO }>> {
  await requireAdmin();
  const name = cleanGroupName(rawName);
  if (!name || name.length > GROUP_NAME_MAX) return { ok: false, error: `Group name must be 1–${GROUP_NAME_MAX} characters.` };
  try {
    const group = await createGroup(name);
    await logActivity(await adminActor(), `created the group ${name}`, "student");
    revalidatePath("/superadmin/students");
    return { ok: true, group };
  } catch (err) {
    if (err instanceof DuplicateGroupError) return { ok: false, error: "A group with this name already exists." };
    throw err;
  }
}

export async function renameGroupAction(groupId: string, rawName: string): Promise<Result<{ name: string }>> {
  await requireAdmin();
  const name = cleanGroupName(rawName);
  if (!name || name.length > GROUP_NAME_MAX) return { ok: false, error: `Group name must be 1–${GROUP_NAME_MAX} characters.` };
  try {
    if (!(await renameGroup(groupId, name))) return { ok: false, error: "Group not found." };
  } catch (err) {
    if (err instanceof DuplicateGroupError) return { ok: false, error: "A group with this name already exists." };
    throw err;
  }
  revalidatePath("/superadmin/students");
  return { ok: true, name };
}

// Students in the group are kept, just without a group
export async function deleteGroupAction(groupId: string): Promise<Result> {
  await requireAdmin();
  if (!(await deleteGroup(groupId))) return { ok: false, error: "Group not found." };
  await logActivity(await adminActor(), "deleted a student group", "student");
  revalidatePath("/superadmin/students");
  return { ok: true };
}

export async function setStudentGroupAction(studentId: string, groupId: string | null): Promise<Result> {
  await requireAdmin();
  if (groupId && !(await groupExists(groupId))) return { ok: false, error: "That group no longer exists." };
  if (!(await setStudentGroup(studentId, groupId))) return { ok: false, error: "Student not found." };
  revalidatePath("/superadmin/students");
  return { ok: true };
}
