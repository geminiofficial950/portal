import "server-only";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";

// Super Admin can give one student a different due date for a unit (an extension).
// It replaces the unit's due date for that student only.
type DueDateDoc = {
  _id?: ObjectId;
  studentId: string;
  courseCode: string;
  unitCode: string;
  dueAt: Date;
  setAt: Date;
};

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<DueDateDoc>("studentDueDates");
  indexesReady ??= col.createIndex({ studentId: 1, courseCode: 1, unitCode: 1 }, { unique: true });
  await indexesReady;
  return col;
}

// unitCode → ISO due date, for every unit this student has their own date in
export async function listStudentDueDates(studentId: string, courseCode: string) {
  const docs = await (await collection()).find({ studentId, courseCode }).toArray();
  return Object.fromEntries(docs.map((d) => [d.unitCode, d.dueAt.toISOString()])) as Record<string, string>;
}

export async function getStudentDueDate(studentId: string, courseCode: string, unitCode: string) {
  const doc = await (await collection()).findOne({ studentId, courseCode, unitCode });
  return doc ? doc.dueAt.toISOString() : null;
}

export async function setStudentDueDate(studentId: string, courseCode: string, unitCode: string, dueAt: Date) {
  await (await collection()).updateOne(
    { studentId, courseCode, unitCode },
    { $set: { dueAt, setAt: new Date() } },
    { upsert: true },
  );
}

export async function clearStudentDueDate(studentId: string, courseCode: string, unitCode: string) {
  const res = await (await collection()).deleteOne({ studentId, courseCode, unitCode });
  return res.deletedCount === 1;
}
