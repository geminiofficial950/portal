"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/auth";
import { deleteAssessment } from "@/lib/assessments";
import { deleteUploads } from "@/lib/files";
import { deleteUnitContent } from "@/lib/unit-content";
import { addUnit, removeUnit, type Unit } from "@/lib/courses";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// e.g. CHCCCS031, HLTAID011, FBPFSY2002
const UNIT_CODE = /^[A-Z]{3,}\d{3,4}[A-Z]?$/;

export async function addUnitAction(courseCode: string, input: Unit): Promise<Result<{ unit: Unit }>> {
  await requireAdmin();
  const unit = { code: input.code.trim().toUpperCase(), title: input.title.trim().replace(/\s+/g, " ") };
  if (!UNIT_CODE.test(unit.code)) return { ok: false, error: "Unit code looks wrong — e.g. CHCCCS031." };
  if (!unit.title) return { ok: false, error: "Enter the unit name." };

  const res = await addUnit(courseCode, unit);
  if (res === "duplicate") return { ok: false, error: `${unit.code} is already in this course.` };
  if (res === "not-found") return { ok: false, error: "Course not found." };
  await logActivity("Super Admin", `added unit ${unit.code} to ${courseCode}`, "course");
  revalidatePath("/superadmin", "layout");
  return { ok: true, unit };
}

export async function removeUnitAction(courseCode: string, unitCode: string): Promise<Result> {
  await requireAdmin();
  const res = await removeUnit(courseCode, unitCode);
  if (res === "not-found") return { ok: false, error: "Course not found." };
  await deleteAssessment(courseCode, unitCode);
  const resources = await deleteUnitContent(courseCode, unitCode);
  await deleteUploads(resources.flatMap((r) => (r.kind === "file" ? [r.file.id] : [])));
  await logActivity("Super Admin", `removed unit ${unitCode} from ${courseCode}`, "course");
  revalidatePath("/superadmin", "layout");
  return { ok: true };
}
