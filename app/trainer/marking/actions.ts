"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { ASSESSMENT_PARTS } from "@/lib/assessment-meta";
import { DECISIONS, statusLabel, type Decision } from "@/lib/submission-meta";
import { getAssessment } from "@/lib/assessments";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import type { SubmissionDTO } from "@/lib/submission-meta";
import { decide, getSubmission } from "@/lib/submissions";

type Result = { ok: true; submission: SubmissionDTO } | { ok: false; error: string };

// Accept / reject submitted work. Trainers (when allowed in Settings) and Super Admin.
export async function decideAction(
  submissionId: string,
  input: { status: Decision; feedback: string; criteriaMet: string[] },
): Promise<Result> {
  const staff = await requireStaff();
  if (staff.role === "trainer" && !(await getSettings()).trainerPermissions.markAssessments) {
    return { ok: false, error: "Super Admin has turned off assessment marking for trainers." };
  }
  if (!DECISIONS.includes(input?.status)) return { ok: false, error: "Choose a status." };

  const feedback = String(input.feedback ?? "").trim().slice(0, 4000);
  if (input.status !== "Accepted" && !feedback) {
    return { ok: false, error: input.status === "MoreDocs" ? "Write which documents the student needs to add." : "Tell the student what to fix first." };
  }

  const current = await getSubmission(submissionId);
  if (!current || current.status === "Draft") return { ok: false, error: "Submission not found." };

  // Only real criteria of this unit's role play can be ticked
  let criteriaMet: string[] = [];
  if (current.part === "rolePlay") {
    const valid = new Set((await getAssessment(current.courseCode, current.unitCode)).rolePlay.criteria.map((c) => c.id));
    criteriaMet = (Array.isArray(input.criteriaMet) ? input.criteriaMet : []).map(String).filter((id) => valid.has(id));
  }

  const saved = await decide(submissionId, { status: input.status, feedback, criteriaMet, decidedBy: staff.role === "admin" ? staff.name : `${staff.name} · Trainer` });
  if (!saved) return { ok: false, error: "This work changed — refresh the page." };

  const label = ASSESSMENT_PARTS.find((p) => p.key === saved.part)!.label.toLowerCase();
  await logActivity(staff.name, `marked ${saved.studentName}’s ${label} for ${saved.unitCode} as ${statusLabel[input.status]}`, staff.role === "admin" ? "student" : "trainer");
  revalidatePath("/trainer", "layout");
  revalidatePath("/superadmin/students", "layout");
  revalidatePath("/dashboard/assessment", "layout");
  return { ok: true, submission: saved };
}
