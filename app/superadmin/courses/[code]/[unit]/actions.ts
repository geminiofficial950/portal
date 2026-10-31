"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import type { UnitAssessment } from "@/lib/assessment-meta";
import { validateAssessment } from "@/lib/assessment-validate";
import { saveAssessment } from "@/lib/assessments";
import { requireAdmin } from "@/lib/auth";
import { getCourse } from "@/lib/courses";

type Result = { ok: true; assessment: UnitAssessment } | { ok: false; error: string };

export async function saveAssessmentAction(courseCode: string, unitCode: string, input: UnitAssessment): Promise<Result> {
  await requireAdmin();
  const course = await getCourse(courseCode);
  if (!course?.units.some((u) => u.code === unitCode)) return { ok: false, error: "This unit isn’t in the course any more." };

  const checked = validateAssessment(input);
  if (!checked.ok) return checked;
  const assessment = checked.value;

  await saveAssessment(courseCode, unitCode, assessment);
  await logActivity("Super Admin", `updated the assessment for ${unitCode} (${courseCode})`, "course");
  revalidatePath("/superadmin/courses", "layout");
  revalidatePath("/dashboard/assessment", "layout");
  return { ok: true, assessment };
}
