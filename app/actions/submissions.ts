"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { adminActor, DATES_SUPER_ADMIN_ONLY, requireAdmin } from "@/lib/auth";
import { getSubmission, setSubmittedAt } from "@/lib/submissions";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Super Admin: change the date a student's work counts as submitted
export async function setSubmittedAtAction(submissionId: string, iso: string): Promise<Result<{ submittedAt: string }>> {
  if (!(await requireAdmin()).isSuper) return { ok: false, error: DATES_SUPER_ADMIN_ONLY };
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Pick a valid date and time." };
  if (when.getTime() > Date.now() + 60_000) return { ok: false, error: "The submitted date can’t be in the future." };
  const before = await getSubmission(submissionId);
  if (!before?.submittedAt) return { ok: false, error: "This work hasn’t been submitted yet." };
  const saved = await setSubmittedAt(submissionId, when);
  if (!saved?.submittedAt) return { ok: false, error: "This work hasn’t been submitted yet." };
  await logActivity(await adminActor(), `changed the submitted date of ${saved.studentName}’s ${saved.unitCode} ${saved.part}`, "student");
  revalidatePath(`/superadmin/students/${saved.studentId}`, "layout");
  revalidatePath(`/superadmin/marking/${submissionId}`);
  revalidatePath("/trainer", "layout");
  revalidatePath("/dashboard/assessment", "layout");
  return { ok: true, submittedAt: saved.submittedAt };
}
