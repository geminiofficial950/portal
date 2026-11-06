"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { partLabel } from "@/lib/assessment-meta";
import { getAssessment } from "@/lib/assessments";
import { requireStaff } from "@/lib/auth";
import { getModuleDue, setModuleDues, studentModuleDues } from "@/lib/deadlines";
import { deleteUploads, ownedUploads } from "@/lib/files";
import { getSettings } from "@/lib/settings";
import { DECISIONS, FILE_RULES, statusLabel, type Decision, type SubmissionDTO } from "@/lib/submission-meta";
import { decide, getSubmission, replyToReview, saveMarkingDraft, setMarkedFiles, setPendingMarking } from "@/lib/submissions";
import { trainerCanSee } from "@/lib/trainer-access";

type Result = { ok: true; submission: SubmissionDTO } | { ok: false; error: string };

const refresh = () => {
  revalidatePath("/trainer", "layout");
  revalidatePath("/superadmin", "layout");
  revalidatePath("/dashboard", "layout");
};

// Admin, or a trainer allowed to mark who is assigned to this unit in the student's current batch
async function staffFor(submissionId: string) {
  const staff = await requireStaff();
  if (staff.role === "trainer" && !(await getSettings()).trainerPermissions.markAssessments) {
    return { error: "Super Admin has turned off assessment marking for trainers." } as const;
  }
  const sub = await getSubmission(submissionId);
  if (!sub || sub.status === "Draft") return { error: "Submission not found." } as const;
  if (staff.role === "trainer" && !(await trainerCanSee(staff.id, sub.studentId, sub.unitCode))) {
    return { error: "You can only mark units assigned to you in this student’s current batch." } as const;
  }
  return { staff, sub, by: staff.role === "admin" ? staff.name : `${staff.name} · Trainer` } as const;
}

/**
 * Marks a module by hand: Satisfactory, Not satisfactory (request resubmission) or Additional information requested.
 * `publish: false` only saves the marking (the student doesn't see it); `publish: true` releases status + feedback.
 * For a resubmission or more information, `dueAt` gives the student a new deadline for THIS module only — other
 * modules and their results are untouched. A deadline never reopens a unit that isn't Active and opened.
 */
export async function decideAction(
  submissionId: string,
  input: { status: Decision; feedback: string; publish: boolean; dueAt?: string | null; criteriaMet?: string[] },
): Promise<Result> {
  const ctx = await staffFor(String(submissionId));
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const { staff, sub, by } = ctx;
  if (!DECISIONS.includes(input?.status)) return { ok: false, error: "Choose a module status." };
  const feedback = String(input.feedback ?? "").trim().slice(0, 4000);
  if (input.status !== "Accepted" && !feedback) {
    return { ok: false, error: input.status === "MoreDocs" ? "Describe the information or documents the student must add." : "Write what the student must change before resubmitting." };
  }

  if (!input.publish) {
    const saved = await saveMarkingDraft(sub.submissionId, { status: input.status, feedback, savedBy: by });
    if (!saved) return { ok: false, error: "This work changed — refresh the page." };
    return { ok: true, submission: saved };
  }

  let due: Date | null = null;
  if (input.status !== "Accepted" && input.dueAt) {
    due = new Date(input.dueAt);
    if (Number.isNaN(due.getTime()) || due.getTime() <= Date.now()) return { ok: false, error: "The new due date must be in the future." };
  }
  const saved = await decide(sub.submissionId, { status: input.status, feedback, criteriaMet: sub.criteriaMet, decidedBy: by });
  if (!saved) return { ok: false, error: "This work changed — refresh the page." };
  if (due) {
    const where = { courseCode: sub.courseCode, unitCode: sub.unitCode, moduleId: sub.part };
    const old = (await studentModuleDues(sub.studentId, sub.courseCode))[`${sub.unitCode}/${sub.part}`] ?? null;
    const reason = input.status === "MoreDocs" ? "Additional information requested" : "Resubmission requested";
    await setModuleDues([sub.studentId], where, due, { name: by, role: staff.role, reason }, () => old);
  }
  const label = partLabel(await getAssessment(sub.courseCode, sub.unitCode), sub.part);
  await logActivity(staff.name, `marked ${sub.studentName}’s “${label}” for ${sub.unitCode} as ${statusLabel[input.status]}`, staff.role === "admin" ? "student" : "trainer");
  refresh();
  return { ok: true, submission: saved };
}

// Back to "Pending marking" (e.g. marked by mistake)
export async function setPendingAction(submissionId: string): Promise<Result> {
  const ctx = await staffFor(String(submissionId));
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const saved = await setPendingMarking(ctx.sub.submissionId);
  if (!saved) return { ok: false, error: "Only marked work can go back to Pending marking." };
  await logActivity(ctx.staff.name, `put ${ctx.sub.studentName}’s work for ${ctx.sub.unitCode} back to Pending marking`, "trainer");
  refresh();
  return { ok: true, submission: saved };
}

// The marked copy of the student's work (files this staff member just uploaded); replacing it removes the old copy
export async function setMarkedFilesAction(submissionId: string, fileIds: string[]): Promise<Result> {
  const ctx = await staffFor(String(submissionId));
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const ids = (Array.isArray(fileIds) ? fileIds : []).map(String).slice(0, FILE_RULES.maxFiles);
  const current = new Set(ctx.sub.markedFiles.map((f) => f.id));
  const fresh = await ownedUploads(ids.filter((id) => !current.has(id)), ctx.staff.id);
  const files = ids.flatMap((id) => ctx.sub.markedFiles.find((f) => f.id === id) ?? fresh.find((f) => f.id === id) ?? []);
  const res = await setMarkedFiles(ctx.sub.submissionId, files);
  if (!res) return { ok: false, error: "This work changed — refresh the page." };
  const kept = new Set(files.map((f) => f.id));
  await deleteUploads(res.before.filter((f) => !kept.has(f.id)).map((f) => f.id));
  refresh();
  return { ok: true, submission: res.after };
}

// Reply to the student's review request; the original feedback and the reply are both kept
export async function replyToReviewAction(submissionId: string, text: string): Promise<Result> {
  const ctx = await staffFor(String(submissionId));
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const body = String(text ?? "").trim().slice(0, 4000);
  if (!body) return { ok: false, error: "Write your reply first." };
  const saved = await replyToReview(ctx.sub.submissionId, { by: ctx.by, text: body });
  if (!saved) return { ok: false, error: "There’s no review request to reply to." };
  refresh();
  return { ok: true, submission: saved };
}

// Current deadline of this module for this student (for the marking screen)
export async function moduleDueFor(submissionId: string) {
  const ctx = await staffFor(String(submissionId));
  if ("error" in ctx) return null;
  return (await getModuleDue(ctx.sub.studentId, ctx.sub.courseCode, ctx.sub.unitCode, ctx.sub.part)) ?? (await studentModuleDues(ctx.sub.studentId, ctx.sub.courseCode))[`${ctx.sub.unitCode}/${ctx.sub.part}`] ?? null;
}
