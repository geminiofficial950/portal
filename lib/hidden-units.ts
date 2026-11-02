import "server-only";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";

// Units Super Admin has hidden from one student. A hidden unit doesn't appear anywhere for that
// student and can't be worked on; their work in it is kept and comes back when it's shown again.
type HiddenUnitDoc = { _id?: ObjectId; studentId: string; courseCode: string; unitCode: string; hiddenAt: Date };

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<HiddenUnitDoc>("hiddenUnits");
  indexesReady ??= col.createIndex({ studentId: 1, courseCode: 1, unitCode: 1 }, { unique: true });
  await indexesReady;
  return col;
}

// Unit codes hidden from this student in this course
export async function listHiddenUnits(studentId: string, courseCode: string) {
  const docs = await (await collection()).find({ studentId, courseCode }).toArray();
  return new Set(docs.map((d) => d.unitCode));
}

export async function isUnitHidden(studentId: string, courseCode: string, unitCode: string) {
  return (await (await collection()).countDocuments({ studentId, courseCode, unitCode })) > 0;
}

export async function setUnitHidden(studentId: string, courseCode: string, unitCode: string, hidden: boolean) {
  const col = await collection();
  if (hidden) {
    await col.updateOne({ studentId, courseCode, unitCode }, { $setOnInsert: { hiddenAt: new Date() } }, { upsert: true });
  } else {
    await col.deleteOne({ studentId, courseCode, unitCode });
  }
}
