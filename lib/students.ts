import "server-only";
import { compare, hash } from "bcryptjs";
import type { ObjectId } from "mongodb";
import type { CourseStatus } from "./course-status";
import { nextSeq } from "./counters";
import { getDb } from "./db";
import { formatDate } from "./format";

export type StudentStatus = "Active" | "Pending" | "Suspended";

type StudentDoc = {
  _id?: ObjectId;
  studentId: string;
  name: string;
  email: string;
  // A student can be enrolled in several courses. `courses` is the list; `course` mirrors the first one
  // (older records only have `course`).
  courses?: string[];
  course: string;
  status: StudentStatus;
  progress: number;
  groupId?: string | null; // Super Admin group, see lib/groups.ts
  courseStatuses?: Record<string, CourseStatus>; // standing per course, set by Super Admin (missing = Active)
  courseEnrolledAt?: Record<string, Date>; // when each course was added (missing = createdAt)
  courseStatus?: CourseStatus; // older records: status of `course`
  passwordHash: string;
  createdAt: Date;
};

export type StudentCourse = { code: string; status: CourseStatus; enrolled: string };

// What leaves the server: never the password hash
export type StudentDTO = {
  studentId: string;
  name: string;
  email: string;
  courses: StudentCourse[];
  status: StudentStatus;
  progress: number;
  groupId: string | null;
  enrolled: string;
};

const courseCodes = (d: Pick<StudentDoc, "courses" | "course">) => (d.courses?.length ? d.courses : d.course ? [d.course] : []);

const toDTO = (d: StudentDoc): StudentDTO => ({
  studentId: d.studentId,
  name: d.name,
  email: d.email,
  courses: courseCodes(d).map((code) => ({
    code,
    status: d.courseStatuses?.[code] ?? (code === d.course ? d.courseStatus : undefined) ?? "Active",
    enrolled: formatDate(d.courseEnrolledAt?.[code] ?? d.createdAt),
  })),
  status: d.status,
  progress: d.progress,
  groupId: d.groupId ?? null,
  enrolled: formatDate(d.createdAt),
});

export const hasCourse = (s: StudentDTO, courseCode: string) => s.courses.some((c) => c.code === courseCode);

// The course to show when none is picked, or the picked one if the student has it
export const pickCourse = (s: StudentDTO, courseCode?: string | null) =>
  (courseCode && s.courses.find((c) => c.code === courseCode)) || s.courses[0] || null;

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const db = await getDb();
  const col = db.collection<StudentDoc>("students");
  indexesReady ??= col.createIndexes([
    { key: { studentId: 1 }, unique: true },
    { key: { email: 1 }, unique: true },
  ]);
  await indexesReady;
  return col;
}

// Next free S-number; skips any that Super Admin already typed in by hand
async function nextStudentId(col: Awaited<ReturnType<typeof collection>>) {
  for (;;) {
    const id = `S${1000 + (await nextSeq("studentId"))}`;
    if (!(await col.countDocuments({ studentId: id }))) return id;
  }
}

export async function listStudents() {
  const col = await collection();
  const docs = await col.find().sort({ createdAt: -1 }).toArray();
  return docs.map(toDTO);
}

export async function getStudent(studentId: string) {
  const doc = await (await collection()).findOne({ studentId });
  return doc ? toDTO(doc) : null;
}

export async function countStudents() {
  const col = await collection();
  const [total, pending] = await Promise.all([
    col.countDocuments(),
    col.countDocuments({ status: "Pending" }),
  ]);
  return { total, pending };
}

// New students per calendar month for the last `months` months (oldest first, zero-filled)
export async function enrolmentsByMonth(months = 6) {
  const col = await collection();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const rows = await col
    .aggregate<{ _id: { y: number; m: number }; n: number }>([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } }, n: { $sum: 1 } } },
    ])
    .toArray();
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const hit = rows.find((r) => r._id.y === d.getFullYear() && r._id.m === d.getMonth() + 1);
    return {
      month: d.toLocaleDateString("en-AU", { month: "short" }),
      year: d.getFullYear(),
      value: hit?.n ?? 0,
    };
  });
}

// Student count + average progress per course code (a student counts once in each of their courses)
export async function progressByCourse() {
  const col = await collection();
  return col
    .aggregate<{ _id: string; students: number; avg: number }>([
      {
        $project: {
          progress: 1,
          codes: { $cond: [{ $gt: [{ $size: { $ifNull: ["$courses", []] } }, 0] }, "$courses", ["$course"]] },
        },
      },
      { $unwind: "$codes" },
      { $group: { _id: "$codes", students: { $sum: 1 }, avg: { $avg: "$progress" } } },
    ])
    .toArray();
}

export class DuplicateEmailError extends Error {}
export class DuplicateStudentIdError extends Error {}

// `studentId` is optional: Super Admin can type one (already checked with checkStudentId), else the next S-number
export async function createStudent(input: {
  name: string;
  email: string;
  courses: string[];
  password: string;
  studentId?: string;
  groupId?: string | null;
}) {
  const col = await collection();
  const doc: StudentDoc = {
    studentId: input.studentId || (await nextStudentId(col)),
    name: input.name,
    email: input.email.toLowerCase(),
    courses: input.courses,
    course: input.courses[0],
    courseEnrolledAt: Object.fromEntries(input.courses.map((c) => [c, new Date()])),
    status: "Active",
    progress: 0,
    groupId: input.groupId ?? null,
    passwordHash: await hash(input.password, 10),
    createdAt: new Date(),
  };
  try {
    await col.insertOne(doc);
  } catch (err) {
    const dup = err as { code?: number; keyPattern?: Record<string, unknown> };
    if (dup.code === 11000) throw dup.keyPattern?.studentId ? new DuplicateStudentIdError() : new DuplicateEmailError();
    throw err;
  }
  return toDTO(doc);
}

export async function updateStudentStatus(studentId: string, status: StudentStatus) {
  const col = await collection();
  const res = await col.updateOne({ studentId }, { $set: { status } });
  return res.matchedCount === 1;
}

export async function setStudentCourseStatus(studentId: string, courseCode: string, status: CourseStatus) {
  const res = await (await collection()).updateOne({ studentId }, { $set: { [`courseStatuses.${courseCode}`]: status } });
  return res.matchedCount === 1;
}

// Replaces the student's course list (work already done in a removed course is kept, just hidden)
export async function setStudentCourses(studentId: string, courses: string[]) {
  const col = await collection();
  const doc = await col.findOne({ studentId });
  if (!doc) return false;
  // Older records keep their course status in `courseStatus`; move it before `course` changes
  const legacy = doc.courseStatus && doc.course && !doc.courseStatuses?.[doc.course] ? { [`courseStatuses.${doc.course}`]: doc.courseStatus } : {};
  // Newly added courses get today as their enrolment date
  const before = new Set(courseCodes(doc));
  const added = Object.fromEntries(courses.filter((c) => !before.has(c)).map((c) => [`courseEnrolledAt.${c}`, new Date()]));
  await col.updateOne({ studentId }, { $set: { courses, course: courses[0], ...legacy, ...added }, $unset: { courseStatus: "" } });
  return true;
}

export async function setStudentGroup(studentId: string, groupId: string | null) {
  const res = await (await collection()).updateOne({ studentId }, { $set: { groupId } });
  return res.matchedCount === 1;
}

export async function resetStudentPassword(studentId: string, password: string) {
  const col = await collection();
  const res = await col.updateOne({ studentId }, { $set: { passwordHash: await hash(password, 10) } });
  return res.matchedCount === 1;
}

export async function deleteStudent(studentId: string) {
  const col = await collection();
  const res = await col.deleteOne({ studentId });
  return res.deletedCount === 1;
}

// Login by student ID (S1001) or email
export async function verifyStudentLogin(identifier: string, password: string) {
  const col = await collection();
  const id = identifier.trim();
  const doc = await col.findOne(
    id.includes("@") ? { email: id.toLowerCase() } : { studentId: id.toUpperCase() },
  );
  if (!doc || !(await compare(password, doc.passwordHash))) return { ok: false as const, reason: "invalid" as const };
  if (doc.status !== "Active") return { ok: false as const, reason: doc.status };
  return { ok: true as const, student: toDTO(doc) };
}
