import "server-only";
import { randomUUID } from "node:crypto";
import type { ObjectId } from "mongodb";
import { DEFAULT_TZ, sortClasses, type BatchDTO, type ClassSession, type TrainerAssignment } from "./batch-meta";
import { listCourses } from "./courses";
import { getDb } from "./db";

// Batches (lib/batch-meta.ts): a batch belongs to one course, has one trainer, many students and its Classroom
// (class days, times and links). Stored in "studentGroups" — batches used to be plain student groups, and those
// older ones simply have no course or trainer yet. Which students are in a batch is kept on the student
// (`batchIds`, lib/students.ts), so moving a student never touches their work.
type BatchDoc = {
  _id?: ObjectId;
  groupId: string; // the batch id
  name: string;
  nameKey: string; // lower-case name, keeps names unique regardless of case
  code?: string;
  courseCode?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  timezone?: string;
  units?: string[]; // assigned units; older batches: every unit of the course
  trainers?: TrainerAssignment[];
  trainerId?: string | null; // older batches: one trainer for every unit
  classes?: ClassSession[];
  createdAt: Date;
};

export class DuplicateBatchError extends Error {}

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<BatchDoc>("studentGroups");
  indexesReady ??= col.createIndexes([
    { key: { groupId: 1 }, unique: true },
    { key: { nameKey: 1 }, unique: true },
    { key: { trainerId: 1 } },
    { key: { "classes.id": 1 } },
  ]);
  await indexesReady;
  return col;
}

// `courseUnits`: the course's unit codes, for older batches that never stored their units
const toDTO = (d: BatchDoc, students = 0, courseUnits: string[] = []): BatchDTO => {
  const units = d.units ?? courseUnits;
  return {
    batchId: d.groupId,
    name: d.name,
    code: d.code ?? "",
    courseCode: d.courseCode ?? null,
    startDate: d.startDate ?? null,
    endDate: d.endDate ?? null,
    timezone: d.timezone ?? DEFAULT_TZ,
    units,
    trainers: d.trainers ?? (d.trainerId ? [{ trainerId: d.trainerId, unitCodes: units }] : []),
    classes: sortClasses(d.classes ?? []),
    students,
  };
};

async function courseUnitMap() {
  return new Map((await listCourses()).map((c) => [c.code, c.units.map((u) => u.code)]));
}

// Students per batch (newer records list `batchIds`; older ones have a single `groupId`)
async function studentCounts() {
  const rows = await (await getDb())
    .collection("students")
    .aggregate<{ _id: string; n: number }>([
      {
        $project: {
          ids: {
            $setUnion: [
              { $ifNull: ["$batchIds", []] },
              { $cond: [{ $eq: [{ $type: "$groupId" }, "string"] }, ["$groupId"], []] },
            ],
          },
        },
      },
      { $unwind: "$ids" },
      { $group: { _id: "$ids", n: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id, r.n]));
}

// Every batch (or only those a trainer is assigned to), A–Z, with how many students are in it
export async function listBatches(filter: { trainerId?: string } = {}) {
  const [docs, counts, units] = await Promise.all([
    (await collection()).find(filter.trainerId ? { $or: [{ "trainers.trainerId": filter.trainerId }, { trainers: { $exists: false }, trainerId: filter.trainerId }] } : {}).sort({ nameKey: 1 }).toArray(),
    studentCounts(),
    courseUnitMap(),
  ]);
  return docs.map((d) => toDTO(d, counts.get(d.groupId) ?? 0, units.get(d.courseCode ?? "") ?? []));
}

export async function getBatch(batchId: string) {
  const doc = await (await collection()).findOne({ groupId: String(batchId) });
  if (!doc) return null;
  const [counts, units] = await Promise.all([studentCounts(), courseUnitMap()]);
  return toDTO(doc, counts.get(doc.groupId) ?? 0, units.get(doc.courseCode ?? "") ?? []);
}

export async function createBatch(input: {
  name: string;
  code: string;
  courseCode: string;
  startDate: string | null;
  endDate: string | null;
  timezone: string;
  units: string[];
  trainers: TrainerAssignment[];
}) {
  const { name, ...rest } = input;
  const doc: BatchDoc = { groupId: randomUUID(), name, nameKey: name.toLowerCase(), ...rest, classes: [], createdAt: new Date() };
  try {
    await (await collection()).insertOne(doc);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new DuplicateBatchError();
    throw err;
  }
  return toDTO(doc);
}

export async function updateBatch(
  batchId: string,
  change: { name?: string; code?: string; courseCode?: string; startDate?: string | null; endDate?: string | null; timezone?: string; units?: string[]; trainers?: TrainerAssignment[] },
) {
  const set: Partial<BatchDoc> = { ...change };
  if (change.name) set.nameKey = change.name.toLowerCase();
  try {
    // trainers now live in `trainers`; the older single `trainerId` is dropped once they're saved
    const res = await (await collection()).updateOne({ groupId: batchId }, change.trainers ? { $set: set, $unset: { trainerId: "" } } : { $set: set });
    return res.matchedCount === 1;
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new DuplicateBatchError();
    throw err;
  }
}

export async function addBatchClass(batchId: string, session: Omit<ClassSession, "id">) {
  const cls: ClassSession = { id: randomUUID(), ...session };
  const res = await (await collection()).updateOne({ groupId: batchId }, { $push: { classes: cls } });
  return res.matchedCount === 1 ? cls : null;
}

export async function removeBatchClass(batchId: string, classId: string) {
  const res = await (await collection()).updateOne({ groupId: batchId }, { $pull: { classes: { id: classId } } });
  return res.modifiedCount === 1;
}

// A class of a batch by its id, for "Join" (/classroom/[id])
export async function findBatchClass(classId: string) {
  const doc = await (await collection()).findOne({ "classes.id": String(classId) });
  const session = doc?.classes?.find((c) => c.id === classId);
  return doc && session ? { batch: toDTO(doc), session } : null;
}

// Removes the batch; its students stay, just without it (their work is untouched)
export async function deleteBatch(batchId: string) {
  const res = await (await collection()).deleteOne({ groupId: batchId });
  if (res.deletedCount !== 1) return false;
  const students = (await getDb()).collection("students");
  await Promise.all([
    students.updateMany({ batchIds: batchId }, { $pull: { batchIds: batchId } } as never),
    students.updateMany({ groupId: batchId }, { $set: { groupId: null } }),
  ]);
  return true;
}
