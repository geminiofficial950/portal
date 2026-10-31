"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/auth";
import {
  createStudent,
  deleteStudent,
  DuplicateEmailError,
  resetStudentPassword,
  updateStudentStatus,
  type StudentDTO,
  type StudentStatus,
} from "@/lib/students";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES: StudentStatus[] = ["Active", "Pending", "Suspended"];

export async function createStudentAction(input: {
  name: string;
  email: string;
  course: string;
  password: string;
}): Promise<Result<{ student: StudentDTO }>> {
  await requireAdmin();

  const name = input.name.trim();
  const email = input.email.trim();
  const course = input.course.trim();
  if (!name || !course) return { ok: false, error: "Name and course are required." };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email." };
  if (input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  try {
    const student = await createStudent({ name, email, course, password: input.password });
    await logActivity(student.name, `was enrolled in ${student.course} (${student.studentId})`, "student");
    revalidatePath("/superadmin", "layout");
    return { ok: true, student };
  } catch (err) {
    if (err instanceof DuplicateEmailError) return { ok: false, error: "A student with this email already exists." };
    console.error("createStudent failed:", err);
    return { ok: false, error: "Couldn’t save the student. Try again." };
  }
}

export async function setStudentStatusAction(studentId: string, status: StudentStatus): Promise<Result> {
  await requireAdmin();
  if (!STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  const found = await updateStudentStatus(studentId, status);
  if (found) await logActivity("Super Admin", `set ${studentId} to ${status.toLowerCase()}`, "student");
  revalidatePath("/superadmin", "layout");
  return found ? { ok: true } : { ok: false, error: "Student not found." };
}

export async function resetPasswordAction(studentId: string, password: string): Promise<Result> {
  await requireAdmin();
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  const found = await resetStudentPassword(studentId, password);
  if (found) await logActivity("Super Admin", `reset the password for ${studentId}`, "student");
  return found ? { ok: true } : { ok: false, error: "Student not found." };
}

export async function deleteStudentAction(studentId: string): Promise<Result> {
  await requireAdmin();
  const found = await deleteStudent(studentId);
  if (found) await logActivity("Super Admin", `deleted student ${studentId}`, "student");
  revalidatePath("/superadmin", "layout");
  return found ? { ok: true } : { ok: false, error: "Student not found." };
}
