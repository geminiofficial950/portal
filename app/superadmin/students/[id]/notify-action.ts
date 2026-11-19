"use server";

import { requireAdmin } from "@/lib/auth";
import { getStudent } from "@/lib/students";
import { notifyPortalUpdate } from "@/lib/student-notifications";

export async function sendStudentPortalUpdate(studentId: string, _previous: string, form: FormData) {
  await requireAdmin();
  const student = await getStudent(studentId);
  if (!student || student.status === "Suspended") return "This student cannot receive portal notifications.";

  const value = form.get("message");
  const message = typeof value === "string" ? value.trim() : "";
  if (!message || message.length > 300) return "Enter an update of up to 300 characters.";

  await notifyPortalUpdate(student.studentId, message);
  return "Notification sent to the student portal.";
}
