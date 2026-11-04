import "server-only";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";

// Units staff (Super Admin, Admin, trainer) have unlocked for one student. Every unit starts locked:
// a locked unit shows grey in the student's course content and can't be opened or worked on.
type UnlockDoc = { _id?: ObjectId; studentId: string; courseCode: string; unitCode: string; unlockedAt: Date; unlockedBy: string };

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<UnlockDoc>("unitUnlocks");
  indexesReady ??= col.createIndex({ studentId: 1, courseCode: 1, unitCode: 1 }, { unique: true });
  await indexesReady;
  return col;
}

// Unit codes unlocked for this student in this course
export async function listUnlockedUnits(studentId: string, courseCode: string) {
  const docs = await (await collection()).find({ studentId, courseCode }).toArray();
  return new Set(docs.map((d) => d.unitCode));
}

export async function isUnitUnlocked(studentId: string, courseCode: string, unitCode: string) {
  return (await (await collection()).countDocuments({ studentId, courseCode, unitCode })) > 0;
}

export async function setUnitsUnlocked(studentId: string, courseCode: string, unitCodes: string[], unlocked: boolean, by: string) {
  const col = await collection();
  if (!unitCodes.length) return;
  if (unlocked) {
    await col.bulkWrite(
      unitCodes.map((unitCode) => ({
        updateOne: {
          filter: { studentId, courseCode, unitCode },
          update: { $setOnInsert: { unlockedAt: new Date(), unlockedBy: by } },
          upsert: true,
        },
      })),
    );
  } else {
    await col.deleteMany({ studentId, courseCode, unitCode: { $in: unitCodes } });
  }
}
