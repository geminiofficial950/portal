"use server";

import { revalidatePath } from "next/cache";
import { mailUpdates } from "@/lib/student-mail";
import { logActivity } from "@/lib/activity";
import { studentRecords, type AffectedRecords } from "@/lib/affected-records";
import { adminActor, DELETE_SUPER_ADMIN_ONLY, requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { COURSE_STATUS_LOG, COURSE_STATUS_REASON_MAX, isCourseStatus, type CourseStatus } from "@/lib/course-status";
import { listCourses } from "@/lib/courses";
import { listBatches } from "@/lib/groups";
import { checkLoginEmail, checkStudentId } from "@/lib/group-meta";
import { changeStudentLogin, IdentityTakenError } from "@/lib/identity";
import {
  createStudent,
  deleteStudent,
  getStudent,
  DuplicateEmailError,
  DuplicateStudentIdError,
  resetStudentPassword,
  setStudentCourseStatus,
  setStudentBatches,
  setStudentCourses,
  updateStudentProfile,
  updateStudentStatus,
  type StudentDTO,
  type StudentStatus,
} from "@/lib/students";
import { generatePassword } from "@/lib/password";
import { checkProfile, fullName } from "@/lib/student-profile-meta";
import { getStudentProgress, type StudentProgressDTO } from "@/lib/progress";
import { importContext } from "@/lib/student-import";
import { EXTRA_FIELD_MAX, EXTRA_VALUE_MAX, IMPORT_MAX_ROWS, checkRows, type ImportRow } from "@/lib/student-import-meta";
import { logStudent, type StudentLogDTO } from "@/lib/student-logs";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES: StudentStatus[] = ["Active", "Pending", "Suspended"];

// Unique, existing course codes in the order given — or an error
async function checkCourses(codesIn: unknown): Promise<{ codes: string[] } | { error: string }> {
  const codes = [...new Set((Array.isArray(codesIn) ? codesIn : []).map((c) => String(c).trim()).filter(Boolean))];
  if (codes.length === 0) return { error: "Pick at least one course." };
  const known = new Set((await listCourses()).map((c) => c.code));
  const unknown = codes.find((c) => !known.has(c));
  return unknown ? { error: `Course ${unknown} doesn’t exist.` } : { codes };
}

export async function createStudentAction(input: {
  firstName: string;
  lastName: string;
  phone: string;
  state?: string; // optional, e.g. VIC
  notes?: string; // optional
  email: string;
  courses: string[];
  password: string;
  studentId?: string; // blank = next S-number
  batchIds?: string[]; // optional: a batch for any of the chosen courses (one per course)
  startDate: string; // required, YYYY-MM-DD
  endDate: string;
}): Promise<Result<{ student: StudentDTO }>> {
  const admin = await requireAdmin();

  const profile = checkProfile(input);
  if (!profile.ok) return profile;
  const name = fullName(profile.value);
  const email = input.email.trim();
  const courses = await checkCourses(input.courses);
  if ("error" in courses) return { ok: false, error: courses.error };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email." };
  if (input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
  if (!isDay(input.startDate)) return { ok: false, error: "Enter the student’s start date." };
  if (!isDay(input.endDate)) return { ok: false, error: "Enter the student’s end date." };
  if (input.endDate < input.startDate) return { ok: false, error: "The end date must be after the start date." };

  // batches picked while enrolling: each must exist and belong to one of the chosen courses, one per course
  const picked = [...new Set((Array.isArray(input.batchIds) ? input.batchIds : []).map(String).filter(Boolean))];
  const allBatches = picked.length ? await listBatches() : [];
  const batches = picked.map((id) => allBatches.find((b) => b.batchId === id));
  if (batches.some((b) => !b)) return { ok: false, error: "A chosen batch no longer exists." };
  if (batches.some((b) => !b!.courseCode || !courses.codes.includes(b!.courseCode))) return { ok: false, error: "Each batch must belong to one of the student’s courses." };
  if (new Set(batches.map((b) => b!.courseCode)).size !== batches.length) return { ok: false, error: "Pick at most one batch per course." };

  let studentId: string | undefined;
  if (input.studentId?.trim()) {
    const checked = checkStudentId(input.studentId);
    if ("error" in checked) return { ok: false, error: checked.error };
    studentId = checked.id;
  }

  try {
    const student = await createStudent({ name, email, courses: courses.codes, password: input.password, studentId, startDate: input.startDate, endDate: input.endDate, profile: profile.value });
    await logActivity(student.name, `was enrolled in ${courses.codes.join(", ")} (${student.studentId})`, "student");
    if (batches.length) {
      await setStudentBatches(student.studentId, picked);
      for (const b of batches) {
        await logStudent({ studentId: student.studentId, studentName: student.name, courseCode: b!.courseCode, action: "Batch changed", detail: `added to ${b!.name} by ${admin.label} (when enrolled)` });
      }
      await logActivity(admin.label, `put ${student.name} in ${batches.map((b) => b!.name).join(", ")}`, "student");
    }
    // staff are told (after the batch is set, so the batch's trainers too); the student gets no welcome email
    await mailUpdates({ studentIds: [student.studentId], kind: "course", courseCodes: courses.codes, skipStudents: true }); // no welcome email to the student
    revalidatePath("/superadmin", "layout");
    return { ok: true, student: { ...student, batchIds: picked } };
  } catch (err) {
    if (err instanceof DuplicateEmailError) return { ok: false, error: "A student with this email already exists." };
    if (err instanceof DuplicateStudentIdError) return { ok: false, error: `Student ID ${studentId} is already taken.` };
    console.error("createStudent failed:", err);
    return { ok: false, error: "Couldn’t save the student. Try again." };
  }
}

export async function setStudentStatusAction(studentId: string, status: StudentStatus): Promise<Result> {
  await requireAdmin();
  if (!STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  const found = await updateStudentStatus(studentId, status);
  if (found) await logActivity(await adminActor(), `set ${studentId} to ${status.toLowerCase()}`, "student");
  revalidatePath("/superadmin", "layout");
  return found ? { ok: true } : { ok: false, error: "Student not found." };
}

export async function resetPasswordAction(studentId: string, password: string): Promise<Result> {
  await requireAdmin();
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  const found = await resetStudentPassword(studentId, password);
  if (found) await logActivity(await adminActor(), `reset the password for ${studentId}`, "student");
  return found ? { ok: true } : { ok: false, error: "Student not found." };
}

// What deleting this student would affect (shown before confirming). Super Admin only.
export async function previewStudentDeletionAction(studentId: string): Promise<Result<{ records: AffectedRecords }>> {
  const admin = await requireAdmin();
  if (!admin.isSuper) return { ok: false, error: DELETE_SUPER_ADMIN_ONLY };
  return { ok: true, records: await studentRecords(String(studentId)) };
}

// Super Admin only — an Admin disables the account instead. Removes the login and profile; the student's academic
// records (submissions, statuses, documents, logs) are kept, never deleted in a cascade.
export async function deleteStudentAction(studentId: string): Promise<Result> {
  const admin = await requireAdmin();
  if (!admin.isSuper) return { ok: false, error: DELETE_SUPER_ADMIN_ONLY };
  const found = await deleteStudent(studentId);
  if (found) await logActivity(await adminActor(), `deleted student ${studentId}`, "student");
  revalidatePath("/superadmin", "layout");
  return found ? { ok: true } : { ok: false, error: "Student not found." };
}

// Active, Completed, Risk of withdrawal… for one of the student's courses — shown on their Course page
// A reason is required; the change is recorded on the student's log with the staff name, date and reason
export async function setCourseStatusAction(studentId: string, courseCode: string, courseStatus: CourseStatus, reasonIn: string): Promise<Result<{ change: StudentLogDTO }>> {
  const actor = await adminActor();
  if (!isCourseStatus(courseStatus)) return { ok: false, error: "Unknown course status." };
  const reason = String(reasonIn ?? "").replace(/\s+/g, " ").trim();
  if (!reason) return { ok: false, error: "Write the reason for the change." };
  if (reason.length > COURSE_STATUS_REASON_MAX) return { ok: false, error: `Keep the reason under ${COURSE_STATUS_REASON_MAX} characters.` };
  const student = await getStudent(studentId);
  const current = student?.courses.find((c) => c.code === courseCode);
  if (!student || !current) return { ok: false, error: "Student or course not found." };
  if (current.status === courseStatus) return { ok: false, error: `${courseCode} is already ${courseStatus}.` };
  await setStudentCourseStatus(studentId, courseCode, courseStatus);
  await logActivity(actor, `set ${studentId}’s course status for ${courseCode} to ${courseStatus} — ${reason}`, "student");
  const detail = `${current.status} → ${courseStatus} · ${reason} · by ${actor}`;
  await logStudent({ studentId, studentName: student.name, courseCode, action: COURSE_STATUS_LOG, detail });
  const change: StudentLogDTO = { studentId, studentName: student.name, courseCode, unitCode: null, action: COURSE_STATUS_LOG, detail, at: new Date().toISOString() };
  revalidatePath(`/superadmin/students/${studentId}`);
  revalidatePath("/superadmin/students");
  revalidatePath("/dashboard/course");
  return { ok: true, change };
}

// Enrol a student in more courses or take one away. Work done in a removed course is kept.
export async function setStudentCoursesAction(studentId: string, codesIn: string[]): Promise<Result> {
  await requireAdmin();
  const courses = await checkCourses(codesIn);
  if ("error" in courses) return { ok: false, error: courses.error };
  const before = new Set((await getStudent(studentId))?.courses.map((c) => c.code) ?? []);
  if (!(await setStudentCourses(studentId, courses.codes))) return { ok: false, error: "Student not found." };
  const added = courses.codes.filter((c) => !before.has(c));
  if (added.length) await mailUpdates({ studentIds: [studentId], kind: "course", courseCodes: added }); // enrolled in a new course
  await logActivity(await adminActor(), `set ${studentId}’s courses to ${courses.codes.join(", ")}`, "student");
  revalidatePath("/superadmin", "layout");
  revalidatePath("/trainer", "layout");
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

// Admin edits a student's profile details (first / last name, phone, state, notes)
export async function updateStudentProfileAction(studentId: string, input: { firstName: string; lastName: string; phone: string; state?: string; notes?: string }): Promise<Result<{ student: StudentDTO }>> {
  const admin = await requireAdmin();
  const profile = checkProfile(input ?? {});
  if (!profile.ok) return profile;
  if (!(await updateStudentProfile(String(studentId), profile.value))) return { ok: false, error: "Student not found." };
  const student = (await getStudent(String(studentId)))!;
  await logStudent({ studentId: student.studentId, studentName: student.name, action: "Profile updated", detail: `by ${admin.label}` });
  revalidatePath("/superadmin", "layout");
  revalidatePath("/trainer", "layout");
  return { ok: true, student };
}

// ---------- Bulk upload: create the ready rows of a checked sheet ----------
export type ImportResult = {
  created: { row: number; studentId: string; name: string; email: string; password: string; courses: string[] }[];
  skipped: { row: number; name: string; errors: string[] }[];
  students: StudentDTO[]; // the new students, for the list on screen
};

// Rows come from the upload preview; they're checked again here against the current students, courses and batches.
// `keepColumns`: the sheet's extra columns the admin chose to import (the rest are skipped). Blank passwords are made up.
export async function importStudentsAction(rowsIn: ImportRow[], keepColumns: string[]): Promise<Result<ImportResult>> {
  const keep = new Set((Array.isArray(keepColumns) ? keepColumns : []).map((c) => String(c)));
  const admin = await requireAdmin();
  const rows = (Array.isArray(rowsIn) ? rowsIn : []).slice(0, IMPORT_MAX_ROWS).map((r) => ({
    row: Number(r?.row) || 0,
    name: fullName({ firstName: String(r?.firstName ?? "").trim(), lastName: String(r?.lastName ?? "").trim() }),
    firstName: String(r?.firstName ?? "").trim(),
    lastName: String(r?.lastName ?? "").trim(),
    phone: String(r?.phone ?? "").trim(),
    state: String(r?.state ?? "").trim(),
    notes: String(r?.notes ?? ""),
    email: String(r?.email ?? "").trim().toLowerCase(),
    courses: Array.isArray(r?.courses) ? r.courses.map((c) => String(c).trim().toUpperCase()).filter(Boolean) : [],
    startDate: String(r?.startDate ?? ""),
    endDate: String(r?.endDate ?? ""),
    studentId: String(r?.studentId ?? "").trim().toUpperCase(),
    password: String(r?.password ?? ""),
    batch: String(r?.batch ?? "").trim(),
    extra: r?.extra && typeof r.extra === "object" ? Object.fromEntries(Object.entries(r.extra).filter(([k]) => keep.has(k)).slice(0, EXTRA_FIELD_MAX).map(([k, v]) => [String(k).replace(/[.$]/g, " ").trim().slice(0, 60), String(v ?? "").slice(0, EXTRA_VALUE_MAX)]).filter(([k, v]) => k && v)) : {},
  }));
  if (!rows.length) return { ok: false, error: "There are no students to add." };

  const checked = checkRows(rows, await importContext());
  const out: ImportResult = { created: [], skipped: [], students: [] };
  for (const r of checked) {
    if (r.errors.length) {
      out.skipped.push({ row: r.row, name: r.name, errors: r.errors });
      continue;
    }
    const password = r.password || generatePassword();
    try {
      const student = await createStudent({
        name: r.name,
        email: r.email,
        courses: r.courses,
        password,
        studentId: r.studentId || undefined,
        startDate: r.startDate,
        endDate: r.endDate,
        extra: r.extra,
        profile: { firstName: r.firstName, lastName: r.lastName, phone: r.phone, state: r.state, notes: r.notes },
      });
      if (r.batchId) {
        await setStudentBatches(student.studentId, [r.batchId]);
        await logStudent({ studentId: student.studentId, studentName: student.name, courseCode: r.courses[0], action: "Batch changed", detail: `added to ${r.batch} by ${admin.label} (bulk upload)` });
      }
      out.created.push({ row: r.row, studentId: student.studentId, name: student.name, email: student.email, password, courses: r.courses });
      out.students.push({ ...student, batchIds: r.batchId ? [r.batchId] : [] });
    } catch (err) {
      if (err instanceof DuplicateEmailError) out.skipped.push({ row: r.row, name: r.name, errors: [`${r.email} is already a student`] });
      else if (err instanceof DuplicateStudentIdError) out.skipped.push({ row: r.row, name: r.name, errors: [`Student ID ${r.studentId} is already taken`] });
      else {
        console.error("bulk upload row failed:", err);
        out.skipped.push({ row: r.row, name: r.name, errors: ["couldn’t be saved — try this row again"] });
      }
    }
  }
  if (out.created.length) {
    await logActivity(admin.label, `added ${out.created.length} student${out.created.length === 1 ? "" : "s"} by bulk upload`, "student");
    // staff get one email with the count; the new students aren't sent a welcome email
    await mailUpdates({ studentIds: out.created.map((c) => c.studentId), kind: "course", courseCodes: [...new Set(out.created.flatMap((c) => c.courses))], skipStudents: true });
    revalidatePath("/superadmin", "layout");
    revalidatePath("/trainer", "layout");
  }
  return { ok: true, ...out };
}

// Admin: one course's units, results and dates for a student (shown in the profile's View popup)
export async function getCourseProgressAction(studentId: string, courseCode: string): Promise<Result<{ progress: StudentProgressDTO }>> {
  await requireAdmin();
  const student = await getStudent(String(studentId));
  if (!student || !student.courses.some((c) => c.code === courseCode)) return { ok: false, error: "This course isn’t on the student’s record." };
  const progress = await getStudentProgress(student.studentId, String(courseCode));
  if (!progress) return { ok: false, error: "Couldn’t load the course. Try again." };
  return { ok: true, progress };
}

// Admin adds one course to a student together with its batch (a batch is required when the course has any)
export async function addStudentCourseAction(studentId: string, courseCode: string, batchId: string | null): Promise<Result> {
  const admin = await requireAdmin();
  const student = await getStudent(String(studentId));
  if (!student) return { ok: false, error: "Student not found." };
  const code = String(courseCode ?? "");
  if (!code) return { ok: false, error: "Select a course." };
  if (student.courses.some((c) => c.code === code)) return { ok: false, error: `${student.name} is already in ${code}.` };
  const courses = await checkCourses([...student.courses.map((c) => c.code), code]);
  if ("error" in courses) return { ok: false, error: courses.error };
  const forCourse = (await listBatches()).filter((b) => b.courseCode === code);
  const batch = batchId ? forCourse.find((b) => b.batchId === batchId) : null;
  if (batchId && !batch) return { ok: false, error: "That batch isn’t for this course." };
  if (forCourse.length && !batch) return { ok: false, error: "Select a batch for this course." };

  await setStudentCourses(student.studentId, courses.codes);
  await logActivity(admin.label, `enrolled ${student.name} in ${code}${batch ? ` (${batch.name})` : ""}`, "student");
  if (batch) {
    await setStudentBatches(student.studentId, [...student.batchIds, batch.batchId]);
    await logStudent({ studentId: student.studentId, studentName: student.name, courseCode: code, action: "Batch changed", detail: `added to ${batch.name} by ${admin.label} (when enrolled in ${code})` });
  }
  // after the batch is set, so the batch's trainers are told too
  await mailUpdates({ studentIds: [student.studentId], kind: "course", courseCodes: [code] });
  revalidatePath("/superadmin", "layout");
  revalidatePath("/trainer", "layout");
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

// Batches are managed on their own page: app/superadmin/batches/actions.ts

// Super Admin only: change a student's login email and/or student ID. A new ID is carried across all their records
// (work, results, requests, logs, files), so nothing is left behind. Their old session ends; the password stays.
export async function changeStudentLoginAction(studentId: string, input: { email: string; studentId: string }): Promise<Result<{ student: StudentDTO; moved: number }>> {
  const admin = await requireSuperAdmin();
  const email = checkLoginEmail(String(input?.email ?? ""));
  if ("error" in email) return { ok: false, error: email.error };
  const id = checkStudentId(String(input?.studentId ?? ""));
  if ("error" in id) return { ok: false, error: id.error };
  let res;
  try {
    res = await changeStudentLogin(String(studentId), { id: id.id, email: email.email });
  } catch (err) {
    if (err instanceof IdentityTakenError) return { ok: false, error: err.message };
    throw err;
  }
  if (!res) return { ok: false, error: "Student not found." };
  const student = (await getStudent(id.id))!;
  const changes = [res.before.id !== id.id ? `ID ${res.before.id} → ${id.id}` : "", res.before.email !== email.email ? `email ${res.before.email} → ${email.email}` : ""].filter(Boolean).join(", ");
  if (changes) {
    await logActivity(admin.label, `changed ${student.name}’s login: ${changes}`, "student");
    await logStudent({ studentId: id.id, studentName: student.name, action: "Login details changed", detail: `${changes} · by ${admin.label}` });
  }
  revalidatePath("/superadmin", "layout");
  return { ok: true, student, moved: res.moved };
}
