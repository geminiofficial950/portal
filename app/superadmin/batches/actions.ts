"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { DELETE_SUPER_ADMIN_ONLY, requireAdmin } from "@/lib/auth";
import {
  canJoinBatch,
  checkBatchDetails,
  checkBatchName,
  checkClassSession,
  checkTrainerAssignments,
  CLASSES_MAX,
  placeInBatch,
  TIMEZONES,
  transferPreview,
  type BatchDTO,
  type ClassSession,
  type TrainerAssignment,
} from "@/lib/batch-meta";
import { getCourse } from "@/lib/courses";
import { addBatchClass, createBatch, deleteBatch, DuplicateBatchError, getBatch, listBatches, removeBatchClass, updateBatch } from "@/lib/groups";
import { logStudent } from "@/lib/student-logs";
import { getStudent, hasCourse, listStudentsInBatch, setStudentBatches } from "@/lib/students";
import { listTrainers } from "@/lib/trainers";
import { listUnitRecords, listUnitRecordsFor, setUnitOpening } from "@/lib/unit-records";
import { listStudentSubmissions } from "@/lib/submissions";
import { planBulkOpen, unitAccess } from "@/lib/unit-status-meta";
import { addSession, cancelSession, updateSession } from "@/lib/class-sessions";
import { checkSession, sessionWhen, type ClassSessionDTO, type SessionInput } from "@/lib/session-meta";
import { notifyStudents } from "@/lib/student-notifications";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const refresh = () => {
  revalidatePath("/superadmin", "layout");
  revalidatePath("/trainer", "layout");
  revalidatePath("/dashboard", "layout");
};

async function activeTrainerIds() {
  return (await listTrainers()).filter((t) => t.active).map((t) => t.trainerId);
}

// LMS guide: only admin creates batches, assigns trainers to units, moves students and opens units.

// A course comes first, then its batches. A new batch is assigned every unit of the course.
export async function createBatchAction(input: {
  name: string;
  courseCode: string;
  code?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  trainerId?: string; // optional: first trainer, for every unit
}): Promise<Result<{ batch: BatchDTO }>> {
  const admin = await requireAdmin();
  const name = checkBatchName(input?.name);
  if ("error" in name) return { ok: false, error: name.error };
  const details = checkBatchDetails(input ?? {});
  if (!details.ok) return details;
  const course = await getCourse(String(input?.courseCode ?? ""));
  if (!course) return { ok: false, error: "Choose the course this batch is for." };
  const units = course.units.map((u) => u.code);
  const trainers = input?.trainerId ? checkTrainerAssignments([{ trainerId: input.trainerId, unitCodes: units }], units, await activeTrainerIds()) : [];
  if (input?.trainerId && !trainers.length) return { ok: false, error: "That trainer isn’t active." };
  try {
    const batch = await createBatch({ name: name.name, ...details.value, courseCode: course.code, units, trainers });
    await logActivity(admin.label, `created the batch ${batch.name} for ${course.code}`, "student");
    refresh();
    return { ok: true, batch };
  } catch (err) {
    if (err instanceof DuplicateBatchError) return { ok: false, error: "A batch with this name already exists." };
    throw err;
  }
}

export async function updateBatchDetailsAction(
  batchId: string,
  input: { name: string; code: string; startDate: string; endDate: string; timezone: string },
): Promise<Result<{ batch: BatchDTO }>> {
  const admin = await requireAdmin();
  const name = checkBatchName(input?.name);
  if ("error" in name) return { ok: false, error: name.error };
  const details = checkBatchDetails(input ?? {});
  if (!details.ok) return details;
  try {
    if (!(await updateBatch(String(batchId), { name: name.name, ...details.value }))) return { ok: false, error: "Batch not found." };
  } catch (err) {
    if (err instanceof DuplicateBatchError) return { ok: false, error: "A batch with this name already exists." };
    throw err;
  }
  await logActivity(admin.label, `updated the details of the batch ${name.name}`, "student");
  refresh();
  return { ok: true, batch: (await getBatch(String(batchId)))! };
}

// Older groups have no course yet: give them one (only while empty, so no student ends up in the wrong course)
export async function setBatchCourseAction(batchId: string, courseCode: string): Promise<Result> {
  await requireAdmin();
  const batch = await getBatch(String(batchId));
  if (!batch) return { ok: false, error: "Batch not found." };
  if (batch.courseCode && batch.students) return { ok: false, error: "Move the students out before changing the course." };
  const course = await getCourse(String(courseCode));
  if (!course) return { ok: false, error: "Course not found." };
  await updateBatch(batch.batchId, { courseCode: course.code, units: course.units.map((u) => u.code), trainers: [] });
  refresh();
  return { ok: true };
}

// Which units of the course this batch takes, and which trainer covers which unit (several trainers per batch)
export async function setBatchPlanAction(batchId: string, unitCodes: string[], assignments: TrainerAssignment[]): Promise<Result<{ batch: BatchDTO }>> {
  const admin = await requireAdmin();
  const batch = await getBatch(String(batchId));
  const course = batch?.courseCode ? await getCourse(batch.courseCode) : null;
  if (!batch || !course) return { ok: false, error: "Batch not found." };
  const wanted = new Set((Array.isArray(unitCodes) ? unitCodes : []).map(String));
  const units = course.units.map((u) => u.code).filter((c) => wanted.has(c));
  if (!units.length) return { ok: false, error: "Assign at least one unit to the batch." };
  const trainers = checkTrainerAssignments(assignments, units, await activeTrainerIds());
  await updateBatch(batch.batchId, { units, trainers });
  await logActivity(admin.label, `updated the units and trainers of the batch ${batch.name}`, "student");
  refresh();
  return { ok: true, batch: (await getBatch(batch.batchId))! };
}

// Super Admin only; the students stay, just without this batch (their work is untouched)
export async function deleteBatchAction(batchId: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!admin.isSuper) return { ok: false, error: DELETE_SUPER_ADMIN_ONLY };
  const batch = await getBatch(String(batchId));
  if (!batch || !(await deleteBatch(batch.batchId))) return { ok: false, error: "Batch not found." };
  await logActivity(admin.label, `deleted the batch ${batch.name}`, "student");
  refresh();
  return { ok: true };
}

// ---------- Opening units for the batch, selected students or one student ----------

type Scope = { studentIds?: string[] | null }; // null / missing = the whole batch

async function scopeStudents(batch: BatchDTO, scope: Scope) {
  const members = await listStudentsInBatch(batch.batchId);
  const picked = scope?.studentIds?.length ? members.filter((m) => scope.studentIds!.includes(m.studentId)) : members;
  return picked;
}

export type OpeningPreview = { unitCode: string; affected: { studentId: string; name: string }[]; skipped: { studentId: string; name: string; reason: string }[] }[];

/** Who a bulk open / schedule would change, per unit — shown before admin confirms */
export async function previewOpeningAction(batchId: string, unitCodes: string[], scope: Scope, resetExceptions: boolean): Promise<Result<{ preview: OpeningPreview }>> {
  await requireAdmin();
  const batch = await getBatch(String(batchId));
  if (!batch?.courseCode) return { ok: false, error: "Batch not found." };
  const students = await scopeStudents(batch, scope);
  const name = (id: string) => students.find((s) => s.studentId === id)?.name ?? id;
  const preview: OpeningPreview = [];
  for (const unitCode of (unitCodes ?? []).filter((u) => batch.units.includes(u))) {
    const recs = await listUnitRecordsFor(students.map((s) => s.studentId), batch.courseCode, unitCode);
    const plan = planBulkOpen(students.map((s) => ({ studentId: s.studentId, record: recs[s.studentId] ?? null })), resetExceptions);
    preview.push({
      unitCode,
      affected: plan.affected.map((id) => ({ studentId: id, name: name(id) })),
      skipped: plan.skipped.map((s) => ({ ...s, name: name(s.studentId) })),
    });
  }
  return { ok: true, preview };
}

/**
 * Open units now, schedule them (`releaseAt`), or close them again — for the whole batch or selected students.
 * Students with an explicit exception (a non-active unit status) are left alone unless `resetExceptions`.
 */
export async function openUnitsAction(
  batchId: string,
  unitCodes: string[],
  scope: Scope,
  when: { mode: "now" } | { mode: "schedule"; releaseAt: string } | { mode: "close" },
  resetExceptions: boolean,
): Promise<Result<{ changed: number }>> {
  const admin = await requireAdmin();
  const batch = await getBatch(String(batchId));
  if (!batch?.courseCode) return { ok: false, error: "Batch not found." };
  let releaseAt: Date | null = null;
  if (when?.mode === "schedule") {
    releaseAt = new Date(when.releaseAt);
    if (Number.isNaN(releaseAt.getTime())) return { ok: false, error: "Choose the release date and time." };
    if (releaseAt.getTime() < Date.now()) return { ok: false, error: "The release time has passed — use Open now instead." };
  }
  const units = (unitCodes ?? []).filter((u) => batch.units.includes(u));
  if (!units.length) return { ok: false, error: "Pick the units first." };
  const students = await scopeStudents(batch, scope);
  let changed = 0;
  for (const unitCode of units) {
    const recs = await listUnitRecordsFor(students.map((s) => s.studentId), batch.courseCode, unitCode);
    const plan = planBulkOpen(students.map((s) => ({ studentId: s.studentId, record: recs[s.studentId] ?? null })), resetExceptions);
    await setUnitOpening(plan.affected, batch.courseCode, unitCode, { open: when.mode === "now", releaseAt }, admin.label);
    changed += plan.affected.length;
  }
  const what = when.mode === "now" ? "opened" : when.mode === "close" ? "closed" : `scheduled for ${releaseAt!.toISOString()}`;
  await logActivity(admin.label, `${what} ${units.join(", ")} for ${scope?.studentIds?.length ? `${students.length} student(s) of` : ""} ${batch.name}`, "student");
  refresh();
  return { ok: true, changed };
}

// ---------- Classes (admin only for now — see "Class editing" decision) ----------

export async function addBatchClassAction(batchId: string, input: { day: string; time: string; link: string }): Promise<Result<{ session: ClassSession }>> {
  const admin = await requireAdmin();
  const batch = await getBatch(String(batchId));
  if (!batch) return { ok: false, error: "Batch not found." };
  if (batch.classes.length >= CLASSES_MAX) return { ok: false, error: `A batch can have up to ${CLASSES_MAX} classes a week.` };
  const checked = checkClassSession(input);
  if (!checked.ok) return checked;
  const session = await addBatchClass(batch.batchId, checked.value);
  if (!session) return { ok: false, error: "Batch not found." };
  await logActivity(admin.label, `added a ${session.day} class to the batch ${batch.name}`, "course");
  refresh();
  return { ok: true, session };
}

export async function removeBatchClassAction(batchId: string, classId: string): Promise<Result> {
  await requireAdmin();
  if (!(await removeBatchClass(String(batchId), String(classId)))) return { ok: false, error: "That class was already removed." };
  refresh();
  return { ok: true };
}

/**
 * What a transfer would mean, shown before admin confirms: the destination batch, which trainer covers each of its
 * units, units with no trainer there, and units the student has work or a status in that the destination doesn't take.
 * The student's work, results, deadlines, extensions and opened units go with them either way.
 */
export async function previewTransferAction(studentId: string, courseCode: string, toBatchId: string): Promise<Result<ReturnType<typeof transferPreview>>> {
  await requireAdmin();
  const [target, student, trainers] = await Promise.all([getBatch(String(toBatchId)), getStudent(String(studentId)), listTrainers()]);
  if (!target || !student) return { ok: false, error: "Batch or student not found." };
  const records = await listUnitRecords(student.studentId, courseCode);
  const worked = [...Object.keys(records), ...(await listStudentSubmissions(student.studentId, courseCode)).map((s) => s.unitCode)];
  // schedule: units open for this student, and units open for anyone already in the destination batch
  const studentOpen = Object.entries(records).filter(([, r]) => unitAccess(r).open).map(([u]) => u);
  const members = (await listStudentsInBatch(target.batchId)).map((m) => m.studentId);
  const destinationOpen: string[] = [];
  for (const unit of target.units) {
    const recs = await listUnitRecordsFor(members, courseCode, unit);
    if (Object.values(recs).some((r) => unitAccess(r).open)) destinationOpen.push(unit);
  }
  return { ok: true, ...transferPreview(target, worked, (id) => trainers.find((t) => t.trainerId === id)?.name ?? id, { studentOpen, destinationOpen }) };
}

/**
 * Put a student in a batch of one of their courses, move them to another batch of it, or take them out (`toBatchId` null).
 * Admin only. Their submissions, results, statuses and deadlines belong to the student and course, not the batch,
 * so nothing they've done changes; trainer access follows the new batch straight away.
 */
export async function moveStudentAction(
  studentId: string,
  courseCode: string,
  toBatchId: string | null,
  // conflicts the admin chose to resolve with the destination plan (nothing is changed unless chosen)
  resolve: { openUnits?: string[]; addUnitsToPlan?: string[] } = {},
): Promise<Result<{ batchIds: string[] }>> {
  const admin = await requireAdmin();
  const student = await getStudent(String(studentId));
  if (!student) return { ok: false, error: "Student not found." };
  // Taking a student OUT of a batch always works (older data can have a student in a batch of a course they
  // aren't enrolled in). Putting them IN needs the course on their profile first.
  if (toBatchId && !hasCourse(student, courseCode)) {
    return { ok: false, error: `${student.name} isn’t enrolled in ${courseCode}. Add the course on their profile first, then put them in the batch.` };
  }
  const all = await listBatches();
  const byId = new Map(all.map((b) => [b.batchId, b]));
  const target = toBatchId ? byId.get(String(toBatchId)) : null;
  if (toBatchId && !target) return { ok: false, error: "That batch no longer exists." };
  if (target) {
    const why = canJoinBatch(student.courses.map((c) => c.code), target.courseCode);
    if (why) return { ok: false, error: why };
    if (target.courseCode !== courseCode) return { ok: false, error: `That batch is for ${target.courseCode}, not ${courseCode}.` };
  }
  const from = student.batchIds.map((id) => byId.get(id)).find((b) => b?.courseCode === courseCode) ?? null;
  const batchIds = placeInBatch(student.batchIds, (id) => byId.get(id)?.courseCode, courseCode, target?.batchId ?? null);
  await setStudentBatches(student.studentId, batchIds);
  if (target) {
    const course = await getCourse(courseCode);
    const order = (course?.units ?? []).map((u) => u.code);
    // add units the student has work in to the destination plan (in course order)
    const add = (resolve?.addUnitsToPlan ?? []).map(String).filter((u) => order.includes(u) && !target.units.includes(u));
    if (add.length) await updateBatch(target.batchId, { units: order.filter((u) => target.units.includes(u) || add.includes(u)) });
    // open, for this student, units the destination batch already has open
    const open = (resolve?.openUnits ?? []).map(String).filter((u) => target.units.includes(u) || add.includes(u));
    for (const unit of open) await setUnitOpening([student.studentId], courseCode, unit, { open: true }, admin.label);
    if (add.length || open.length) await logActivity(admin.label, `resolved transfer conflicts for ${student.name}: ${[add.length ? `added ${add.join(", ")} to ${target.name}` : "", open.length ? `opened ${open.join(", ")}` : ""].filter(Boolean).join("; ")}`, "student");
  }
  const what = target ? (from ? `moved from ${from.name} to ${target.name}` : `added to ${target.name}`) : `removed from ${from?.name ?? "their batch"}`;
  await logActivity(admin.label, `${student.name} (${student.studentId}) ${what}`, "student");
  // internal transfer record: old batch, new batch, date and administrator
  await logStudent({ studentId: student.studentId, studentName: student.name, courseCode, action: "Batch changed", detail: `${what} by ${admin.label}` });
  refresh();
  return { ok: true, batchIds };
}

// ---------- Class sessions (title, unit, trainer, date, start/end, timezone, Meet link, instructions) ----------

async function sessionCtx(batchId: string) {
  const admin = await requireAdmin();
  const batch = await getBatch(String(batchId));
  if (!batch?.courseCode) return { error: "Batch not found." } as const;
  const trainers = (await listTrainers()).filter((t) => t.active);
  return { admin, batch, trainers } as const;
}

async function tellStudents(batch: BatchDTO, text: string) {
  const members = await listStudentsInBatch(batch.batchId);
  await notifyStudents(members.map((m) => m.studentId), batch.courseCode ?? "", text);
}

export async function addSessionAction(batchId: string, input: SessionInput): Promise<Result<{ session: ClassSessionDTO }>> {
  const ctx = await sessionCtx(batchId);
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const checked = checkSession(input, { units: ctx.batch.units, trainerIds: ctx.trainers.map((t) => t.trainerId), timezones: [ctx.batch.timezone, ...TIMEZONES.filter((t) => t !== ctx.batch.timezone)] });
  if (!checked.ok) return checked;
  const trainerName = ctx.trainers.find((t) => t.trainerId === checked.value.trainerId)?.name ?? null;
  const session = await addSession({ batchId: ctx.batch.batchId, courseCode: ctx.batch.courseCode! }, { ...checked.value, trainerName }, ctx.admin.label);
  await tellStudents(ctx.batch, `New class: ${session.title} — ${sessionWhen(session)}`);
  await logActivity(ctx.admin.label, `scheduled the class “${session.title}” for ${ctx.batch.name}`, "course");
  refresh();
  return { ok: true, session };
}

export async function updateSessionAction(batchId: string, sessionId: string, input: SessionInput): Promise<Result<{ session: ClassSessionDTO }>> {
  const ctx = await sessionCtx(batchId);
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const checked = checkSession(input, { units: ctx.batch.units, trainerIds: ctx.trainers.map((t) => t.trainerId), timezones: [ctx.batch.timezone, ...TIMEZONES.filter((t) => t !== ctx.batch.timezone)] });
  if (!checked.ok) return checked;
  const trainerName = ctx.trainers.find((t) => t.trainerId === checked.value.trainerId)?.name ?? null;
  const session = await updateSession(String(sessionId), { ...checked.value, trainerName });
  if (!session || session.batchId !== ctx.batch.batchId) return { ok: false, error: "That class was cancelled or removed." };
  await tellStudents(ctx.batch, `Class changed: ${session.title} — now ${sessionWhen(session)}`);
  refresh();
  return { ok: true, session };
}

export async function cancelSessionAction(batchId: string, sessionId: string): Promise<Result<{ session: ClassSessionDTO }>> {
  const ctx = await sessionCtx(batchId);
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const session = await cancelSession(String(sessionId));
  if (!session || session.batchId !== ctx.batch.batchId) return { ok: false, error: "That class was already cancelled." };
  await tellStudents(ctx.batch, `Class cancelled: ${session.title} (${sessionWhen(session)})`);
  await logActivity(ctx.admin.label, `cancelled the class “${session.title}” for ${ctx.batch.name}`, "course");
  refresh();
  return { ok: true, session };
}
