"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { adminActor, requireAdmin } from "@/lib/auth";
import { deleteAssessment } from "@/lib/assessments";
import { deleteUploads } from "@/lib/files";
import { deleteUnitContent } from "@/lib/unit-content";
import { addUnit, removeUnit, setPlacementHours, type Unit } from "@/lib/courses";
import { PLACEMENT_HOURS_MAX } from "@/lib/course-status";

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
  await logActivity(await adminActor(), `added unit ${unit.code} to ${courseCode}`, "course");
  revalidatePath("/superadmin", "layout");
  return { ok: true, unit };
}

// Work placement hours shown on the student's Course page; null clears it
export async function setPlacementHoursAction(courseCode: string, hours: number | null): Promise<Result<{ hours: number | null }>> {
  await requireAdmin();
  if (hours !== null && (!Number.isInteger(hours) || hours < 0 || hours > PLACEMENT_HOURS_MAX)) {
    return { ok: false, error: `Placement hours must be a whole number from 0 to ${PLACEMENT_HOURS_MAX}.` };
  }
  if (!(await setPlacementHours(courseCode, hours))) return { ok: false, error: "Course not found." };
  await logActivity(await adminActor(), `set work placement hours for ${courseCode}`, "course");
  revalidatePath("/superadmin/courses");
  revalidatePath("/dashboard/course");
  return { ok: true, hours };
}

export async function removeUnitAction(courseCode: string, unitCode: string): Promise<Result> {
  await requireAdmin();
  const res = await removeUnit(courseCode, unitCode);
  if (res === "not-found") return { ok: false, error: "Course not found." };
  await deleteAssessment(courseCode, unitCode);
  const resources = await deleteUnitContent(courseCode, unitCode);
  await deleteUploads(resources.flatMap((r) => (r.kind === "file" ? [r.file.id] : [])));
  await logActivity(await adminActor(), `removed unit ${unitCode} from ${courseCode}`, "course");
  revalidatePath("/superadmin", "layout");
  return { ok: true };
}
