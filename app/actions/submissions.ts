"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { adminActor, DATES_SUPER_ADMIN_ONLY, requireAdmin } from "@/lib/auth";
import { formatStamp } from "@/lib/format";
import { getSubmission, setDecidedAt, setSubmittedAt } from "@/lib/submissions";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Super Admin: change the date a student's work counts as submitted
export async function setSubmittedAtAction(submissionId: string, iso: string): Promise<Result<{ submittedAt: string }>> {
  if (!(await requireAdmin()).isSuper) return { ok: false, error: DATES_SUPER_ADMIN_ONLY };
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Pick a valid date and time." };
  if (when.getTime() > Date.now() + 60_000) return { ok: false, error: "The submitted date can’t be in the future." };
  const before = await getSubmission(submissionId);
  if (!before?.submittedAt) return { ok: false, error: "This work hasn’t been submitted yet." };
  // the record has to read in order: submitted, then marked
  if (before.decidedAt && when > new Date(before.decidedAt)) {
    return { ok: false, error: `It can’t be submitted after it was marked (${formatStamp(new Date(before.decidedAt))}). Change the marked date first.` };
  }
  const saved = await setSubmittedAt(submissionId, when);
  if (!saved?.submittedAt) return { ok: false, error: "This work hasn’t been submitted yet." };
  await logActivity(
    await adminActor(),
    `changed the submitted date of ${saved.studentName}’s ${saved.unitCode} ${saved.part} from ${formatStamp(new Date(before.submittedAt))} to ${formatStamp(when)}`,
    "student",
  );
  refresh(saved.studentId, submissionId);
  return { ok: true, submittedAt: saved.submittedAt };
}

// Super Admin: change the date a student's work counts as marked (Satisfactory, Not satisfactory …).
// It can't be before the work was submitted, or in the future.
export async function setMarkedAtAction(submissionId: string, iso: string): Promise<Result<{ decidedAt: string }>> {
  if (!(await requireAdmin()).isSuper) return { ok: false, error: DATES_SUPER_ADMIN_ONLY };
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Pick a valid date and time." };
  if (when.getTime() > Date.now() + 60_000) return { ok: false, error: "The marked date can’t be in the future." };
  const before = await getSubmission(submissionId);
  if (!before?.decidedAt) return { ok: false, error: "This work hasn’t been marked yet." };
  if (before.submittedAt && when < new Date(before.submittedAt)) {
    return { ok: false, error: `It can’t be marked before it was submitted (${formatStamp(new Date(before.submittedAt))}). Change the submitted date first.` };
  }
  const saved = await setDecidedAt(submissionId, when);
  if (!saved?.decidedAt) return { ok: false, error: "This work hasn’t been marked yet." };
  await logActivity(
    await adminActor(),
    `changed the marked date of ${saved.studentName}’s ${saved.unitCode} ${saved.part} from ${formatStamp(new Date(before.decidedAt))} to ${formatStamp(when)}`,
    "student",
  );
  refresh(saved.studentId, submissionId);
  return { ok: true, decidedAt: saved.decidedAt };
}

function refresh(studentId: string, submissionId: string) {
  revalidatePath(`/superadmin/students/${studentId}`, "layout");
  revalidatePath(`/superadmin/marking/${submissionId}`);
  revalidatePath("/trainer", "layout");
  revalidatePath("/dashboard", "layout");
}
