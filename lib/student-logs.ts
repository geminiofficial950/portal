import "server-only";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";

// Everything a student does in the portal (log in, open units and files, upload, submit…), kept per student so
// Admins and Super Admin can see and download it. Separate from lib/activity.ts, which is the staff overview feed.
type StudentLogDoc = {
  _id?: ObjectId;
  studentId: string;
  studentName: string;
  courseCode: string | null;
  unitCode: string | null;
  action: string; // short, e.g. "Logged in", "Viewed", "Downloaded file", "Submitted"
  detail: string; // e.g. "Theory Task", a file name, a quiz score
  at: Date;
  dedupe?: string; // same entry + time window; unique, so repeats inside the window are dropped
};

export type StudentLogDTO = Omit<StudentLogDoc, "_id" | "at" | "dedupe"> & { at: string };

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<StudentLogDoc>("studentLogs");
  indexesReady ??= col.createIndexes([
    { key: { studentId: 1, at: -1 } },
    { key: { at: -1 } },
    { key: { dedupe: 1 }, unique: true, partialFilterExpression: { dedupe: { $exists: true } } },
  ]);
  await indexesReady;
  return col;
}

/**
 * Records one thing a student did. Never throws: a failed log must not stop the student's work.
 * `dedupeSeconds` keeps one entry per time window for the same thing (e.g. a PDF viewer asking for a file several
 * times at once). A unique key does it, so requests arriving together can't both get in.
 */
export async function logStudent(
  entry: { studentId: string; studentName: string; courseCode?: string | null; unitCode?: string | null; action: string; detail?: string },
  dedupeSeconds = 0,
) {
  try {
    const col = await collection();
    const doc: StudentLogDoc = {
      studentId: entry.studentId,
      studentName: entry.studentName,
      courseCode: entry.courseCode ?? null,
      unitCode: entry.unitCode ?? null,
      action: entry.action,
      detail: (entry.detail ?? "").slice(0, 500),
      at: new Date(),
    };
    if (dedupeSeconds > 0) {
      const window = Math.floor(doc.at.getTime() / (dedupeSeconds * 1000));
      doc.dedupe = [doc.studentId, doc.courseCode, doc.unitCode, doc.action, doc.detail, window].join("|");
    }
    await col.insertOne(doc);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return; // already logged in this window
    console.error("logStudent failed:", err);
  }
}

const toDTO = (d: StudentLogDoc): StudentLogDTO => ({
  studentId: d.studentId,
  studentName: d.studentName,
  courseCode: d.courseCode,
  unitCode: d.unitCode,
  action: d.action,
  detail: d.detail,
  at: d.at.toISOString(),
});

// Newest first. `courseCode` narrows to one course (entries without a course, like logins, are kept).
export async function listStudentLogs(studentId: string, opts: { courseCode?: string | null; limit?: number } = {}) {
  const filter = opts.courseCode ? { studentId, courseCode: { $in: [opts.courseCode, null] } } : { studentId };
  const docs = await (await collection())
    .find(filter)
    .sort({ at: -1 })
    .limit(opts.limit ?? 500)
    .toArray();
  return docs.map(toDTO);
}

// The latest entries of one kind across all students (e.g. course status changes for the Students page)
export async function listRecentLogs(action: string, limit = 8) {
  const docs = await (await collection()).find({ action }).sort({ at: -1 }).limit(limit).toArray();
  return docs.map(toDTO);
}

// Every student's log, newest first (for the "all students" download)
export async function listAllStudentLogs(limit = 50000) {
  const docs = await (await collection()).find().sort({ at: -1 }).limit(limit).toArray();
  return docs.map(toDTO);
}

export async function countStudentLogs(studentId: string) {
  return (await collection()).countDocuments({ studentId });
}
