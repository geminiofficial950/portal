import "server-only";
import { compare, hash } from "bcryptjs";
import type { ObjectId } from "mongodb";
import { nextSeq } from "./counters";
import { getDb } from "./db";
import { formatDate } from "./format";

export type StudentStatus = "Active" | "Pending" | "Suspended";

type StudentDoc = {
  _id?: ObjectId;
  studentId: string;
  name: string;
  email: string;
  course: string;
  status: StudentStatus;
  progress: number;
  passwordHash: string;
  createdAt: Date;
};

// What leaves the server: never the password hash
export type StudentDTO = Omit<StudentDoc, "_id" | "passwordHash" | "createdAt"> & { enrolled: string };

const toDTO = ({ studentId, name, email, course, status, progress, createdAt }: StudentDoc): StudentDTO => ({
  studentId,
  name,
  email,
  course,
  status,
  progress,
  enrolled: formatDate(createdAt),
});

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

async function nextStudentId() {
  return `S${1000 + (await nextSeq("studentId"))}`;
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

// Student count + average progress per course code
export async function progressByCourse() {
  const col = await collection();
  return col
    .aggregate<{ _id: string; students: number; avg: number }>([
      { $group: { _id: "$course", students: { $sum: 1 }, avg: { $avg: "$progress" } } },
    ])
    .toArray();
}

export class DuplicateEmailError extends Error {}

export async function createStudent(input: { name: string; email: string; course: string; password: string }) {
  const col = await collection();
  const doc: StudentDoc = {
    studentId: await nextStudentId(),
    name: input.name,
    email: input.email.toLowerCase(),
    course: input.course,
    status: "Active",
    progress: 0,
    passwordHash: await hash(input.password, 10),
    createdAt: new Date(),
  };
  try {
    await col.insertOne(doc);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new DuplicateEmailError();
    throw err;
  }
  return toDTO(doc);
}

export async function updateStudentStatus(studentId: string, status: StudentStatus) {
  const col = await collection();
  const res = await col.updateOne({ studentId }, { $set: { status } });
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
