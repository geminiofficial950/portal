"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import type { UnitAssessment } from "@/lib/assessment-meta";
import { validateAssessment } from "@/lib/assessment-validate";
import { getAssessment, saveAssessment } from "@/lib/assessments";
import { adminActor, DATES_SUPER_ADMIN_ONLY, requireAdmin } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { deleteUploads, ownedUploads } from "@/lib/files";

type Result = { ok: true; assessment: UnitAssessment } | { ok: false; error: string };

export async function saveAssessmentAction(courseCode: string, unitCode: string, input: UnitAssessment): Promise<Result> {
  const admin = await requireAdmin();
  const course = await getCourse(courseCode);
  if (!course?.units.some((u) => u.code === unitCode)) return { ok: false, error: "This unit isn’t in the course any more." };

  const checked = validateAssessment(input);
  if (!checked.ok) return checked;
  const assessment = checked.value;

  // Task documents must be files Super Admin uploaded (names and sizes come from storage, not the browser)
  const owned = new Map(
    (await ownedUploads([...assessment.theory.files, ...assessment.workplace.files].map((f) => f.id), admin.sub)).map((f) => [f.id, f]),
  );
  assessment.theory.files = assessment.theory.files.flatMap((f) => owned.get(f.id) ?? []);
  assessment.workplace.files = assessment.workplace.files.flatMap((f) => owned.get(f.id) ?? []);

  const before = await getAssessment(courseCode, unitCode);
  // An Admin can edit the assessment but not its due date
  if (!admin.isSuper && (before.dueAt ?? null) !== (assessment.dueAt ?? null)) return { ok: false, error: DATES_SUPER_ADMIN_ONLY };
  await saveAssessment(courseCode, unitCode, assessment);
  const kept = new Set([...assessment.theory.files, ...assessment.workplace.files].map((f) => f.id));
  await deleteUploads([...before.theory.files, ...before.workplace.files].map((f) => f.id).filter((id) => !kept.has(id)));

  await logActivity(await adminActor(), `updated the assessment for ${unitCode} (${courseCode})`, "course");
  revalidatePath("/superadmin/courses", "layout");
  revalidatePath("/dashboard/assessment", "layout");
  return { ok: true, assessment };
}
