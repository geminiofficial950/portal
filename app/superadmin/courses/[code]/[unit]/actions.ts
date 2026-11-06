"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import type { UnitAssessment } from "@/lib/assessment-meta";
import { validateAssessment } from "@/lib/assessment-validate";
import { getAssessment, saveAssessment } from "@/lib/assessments";
import { adminActor, DATES_SUPER_ADMIN_ONLY, requireAdmin } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { keepTaskFiles } from "@/lib/file-names";
import { deleteUploads, ownedUploads, renameUpload } from "@/lib/files";
import { mergeModules } from "@/lib/module-save";
import { moduleFiles, type Activity } from "@/lib/module-meta";
import { moduleIdsWithWork } from "@/lib/submissions";
import { logDefaultDueChange, resetModuleDues } from "@/lib/deadlines";

type Result = { ok: true; assessment: UnitAssessment } | { ok: false; error: string };

// Admin saves a unit's modules (any number, any order). Rules from the LMS guide:
// - only files already on the unit or just uploaded by this person are kept (names/sizes from storage; a new name renames)
// - a module that students have work in is never deleted: it's archived (hidden, evidence kept)
// - due dates are Super Admin only
// `dates`: when a module's default due date changes — the reason (required, goes in the deadline log) and whether to
// also reset students' own dates for those modules (off by default: exceptions are kept unless staff chooses to reset)
export async function saveAssessmentAction(
  courseCode: string,
  unitCode: string,
  input: UnitAssessment,
  dates: { reason?: string; resetExceptions?: boolean } = {},
): Promise<Result & { reset?: number }> {
  const admin = await requireAdmin();
  const course = await getCourse(courseCode);
  if (!course?.units.some((u) => u.code === unitCode)) return { ok: false, error: "This unit isn’t in the course any more." };

  const checked = validateAssessment(input);
  if (!checked.ok) return checked;
  const before = await getAssessment(courseCode, unitCode);
  const withWork = await moduleIdsWithWork(courseCode, unitCode);
  const merged = mergeModules(before.modules, checked.value.modules, withWork);
  if (!admin.isSuper && merged.dueChanged) return { ok: false, error: DATES_SUPER_ADMIN_ONLY };
  const reason = String(dates?.reason ?? "").trim().slice(0, 1000);
  if (merged.dueChanges.length && !reason) return { ok: false, error: "Write the reason for the due-date change (it goes in the deadline log)." };
  const modules = merged.modules;

  // Files: keep what the unit already had (whoever uploaded it) plus fresh uploads by this person
  const previous = moduleFiles(before.modules);
  const requested = moduleFiles(modules);
  const fresh = await ownedUploads(
    requested.map((f) => f.id).filter((id) => !previous.some((p) => p.id === id)),
    admin.sub,
  );
  const renames: { id: string; name: string }[] = [];
  for (const m of modules) {
    const kept = keepTaskFiles(m.files, previous, fresh);
    m.files = kept.files;
    renames.push(...kept.renames);
    m.activities = m.activities.flatMap((a): Activity[] => {
      if (a.type !== "image") return [a];
      const img = keepTaskFiles(a.image ? [a.image] : [], previous, fresh).files[0];
      return img ? [{ ...a, image: img }] : []; // an image question whose picture didn't upload is dropped
    });
  }

  const assessment = { modules };
  await saveAssessment(courseCode, unitCode, assessment);
  for (const r of renames) await renameUpload(r.id, r.name);
  const kept = new Set(moduleFiles(modules).map((f) => f.id));
  await deleteUploads(previous.map((f) => f.id).filter((id) => !kept.has(id)));

  // audit: who, role, reason, old and new default date — and, only if chosen, reset students' own dates
  const by = { name: admin.label, role: "admin" as const, reason };
  for (const c of merged.dueChanges) await logDefaultDueChange({ courseCode, unitCode, moduleId: c.moduleId }, c.oldDue, c.newDue, by);
  const reset = dates?.resetExceptions
    ? await resetModuleDues(courseCode, unitCode, merged.dueChanges.map((c) => c.moduleId), by, (id) => modules.find((m) => m.id === id)?.dueAt ?? null)
    : 0;
  await logActivity(await adminActor(), `updated the modules of ${unitCode} (${courseCode})${merged.dueChanges.length ? ` — due dates changed: ${reason}` : ""}`, "course");
  revalidatePath("/superadmin/courses", "layout");
  revalidatePath("/dashboard", "layout");
  return { ok: true, assessment, reset };
}
