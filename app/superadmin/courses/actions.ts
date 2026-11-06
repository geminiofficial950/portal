"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { unitRecords, type AffectedRecords } from "@/lib/affected-records";
import { adminActor, DELETE_SUPER_ADMIN_ONLY, requireAdmin } from "@/lib/auth";
import { checkCode, checkNewCourse, checkUnitList, type NewCourse } from "@/lib/course-meta";
import { countStudentsInCourse } from "@/lib/students";
import { deleteAssessment } from "@/lib/assessments";
import { deleteUploads } from "@/lib/files";
import { deleteUnitContent } from "@/lib/unit-content";
import { addUnit, createCourse, deleteCourse, DuplicateCourseError, removeUnit, setPlacementHours, updateCourseDetails, type CourseDTO, type Unit } from "@/lib/courses";
import { PLACEMENT_HOURS_MAX } from "@/lib/course-status";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };


export async function addUnitAction(courseCode: string, input: Unit): Promise<Result<{ unit: Unit }>> {
  await requireAdmin();
  // any code format: each course has its own units with their own codes (only duplicates within this course are refused)
  const code = checkCode(input?.code, "Unit");
  if ("error" in code) return { ok: false, error: code.error };
  const unit = { code: code.code, title: String(input?.title ?? "").trim().replace(/\s+/g, " ") };
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

// Super Admin and Admins can add a course
// The course with its selected units (each with its own code and name)
export async function createCourseAction(input: Partial<NewCourse> & { units?: { code: string; title: string }[] }): Promise<Result<{ course: CourseDTO }>> {
  await requireAdmin();
  const checked = checkNewCourse(input);
  if (!checked.ok) return checked;
  const units = checkUnitList(input?.units);
  if (!units.ok) return units;
  try {
    const course = await createCourse(checked.value, units.units);
    await logActivity(await adminActor(), `added the course ${course.code} – ${course.name} with ${course.units.length} unit(s)`, "course");
    revalidatePath("/superadmin", "layout");
    return { ok: true, course };
  } catch (err) {
    if (err instanceof DuplicateCourseError) return { ok: false, error: `${checked.value.code} already exists.` };
    throw err;
  }
}

// Change a course's details (the code stays: everything is filed under it)
export async function updateCourseAction(code: string, input: Partial<NewCourse>): Promise<Result<{ details: Omit<NewCourse, "code"> }>> {
  await requireAdmin();
  const checked = checkNewCourse({ ...input, code });
  if (!checked.ok) return checked;
  const { name, category, duration, description } = checked.value;
  const details = { name, category, duration, description };
  if (!(await updateCourseDetails(code, details))) return { ok: false, error: "Course not found." };
  await logActivity(await adminActor(), `updated the details of ${code}`, "course");
  revalidatePath("/superadmin", "layout");
  revalidatePath("/dashboard/course");
  return { ok: true, details };
}

// Super Admin only, and only once no student is enrolled in it
export async function deleteCourseAction(courseCode: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!admin.isSuper) return { ok: false, error: DELETE_SUPER_ADMIN_ONLY };
  const enrolled = await countStudentsInCourse(courseCode);
  if (enrolled) return { ok: false, error: `${enrolled} student${enrolled === 1 ? " is" : "s are"} enrolled in ${courseCode}. Move them to another course first.` };
  if (!(await deleteCourse(courseCode))) return { ok: false, error: "Course not found." };
  await logActivity(await adminActor(), `deleted the course ${courseCode}`, "course");
  revalidatePath("/superadmin", "layout");
  return { ok: true };
}

// What removing a unit would affect (shown before confirming). Super Admin only.
export async function previewUnitRemovalAction(courseCode: string, unitCode: string): Promise<Result<{ records: AffectedRecords }>> {
  const admin = await requireAdmin();
  if (!admin.isSuper) return { ok: false, error: DELETE_SUPER_ADMIN_ONLY };
  return { ok: true, records: await unitRecords(courseCode, unitCode) };
}

// Removing a unit deletes its modules and resources: Super Admin only, and refused while any student has work or a
// status in it — evidence is never erased in a cascade (set the students' unit status instead).
export async function removeUnitAction(courseCode: string, unitCode: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!admin.isSuper) return { ok: false, error: DELETE_SUPER_ADMIN_ONLY };
  const affected = (await unitRecords(courseCode, unitCode)).filter((r) => r.count);
  if (affected.length) {
    return { ok: false, error: `Students have records in ${unitCode} (${affected.map((r) => `${r.count} ${r.label}`).join(", ")}), so it can’t be removed. Their evidence is kept.` };
  }
  const res = await removeUnit(courseCode, unitCode);
  if (res === "not-found") return { ok: false, error: "Course not found." };
  await deleteAssessment(courseCode, unitCode);
  const resources = await deleteUnitContent(courseCode, unitCode);
  await deleteUploads(resources.flatMap((r) => (r.kind === "file" ? [r.file.id] : [])));
  await logActivity(await adminActor(), `removed unit ${unitCode} from ${courseCode}`, "course");
  revalidatePath("/superadmin", "layout");
  return { ok: true };
}
