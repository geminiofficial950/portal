import "server-only";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";
import type { UnitResultDTO, UnitResultValue } from "./unit-meta";

// One final outcome per student per unit; older outcomes are kept in history when it's changed
type UnitResultDoc = Omit<UnitResultDTO, "decidedAt"> & {
  _id?: ObjectId;
  decidedAt: Date;
  history: { result: UnitResultValue | "Cleared"; feedback: string; decidedBy: string; decidedAt: Date }[];
};

const toDTO = (d: UnitResultDoc): UnitResultDTO => ({
  studentId: d.studentId,
  courseCode: d.courseCode,
  unitCode: d.unitCode,
  result: d.result,
  feedback: d.feedback,
  decidedBy: d.decidedBy,
  decidedAt: d.decidedAt.toISOString(),
});

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<UnitResultDoc>("unitResults");
  indexesReady ??= col.createIndex({ studentId: 1, courseCode: 1, unitCode: 1 }, { unique: true });
  await indexesReady;
  return col;
}

export async function listStudentResults(studentId: string, courseCode: string) {
  const docs = await (await collection()).find({ studentId, courseCode }).toArray();
  return docs.map(toDTO);
}

export async function getUnitResult(studentId: string, courseCode: string, unitCode: string) {
  const doc = await (await collection()).findOne({ studentId, courseCode, unitCode });
  return doc ? toDTO(doc) : null;
}

export async function setUnitResult(input: Omit<UnitResultDTO, "decidedAt">) {
  const col = await collection();
  const key = { studentId: input.studentId, courseCode: input.courseCode, unitCode: input.unitCode };
  const prev = await col.findOne(key);
  const now = new Date();
  const history = prev?.history ?? [];
  if (prev) history.push({ result: prev.result, feedback: prev.feedback, decidedBy: prev.decidedBy, decidedAt: prev.decidedAt });
  await col.updateOne(key, { $set: { ...input, decidedAt: now, history } }, { upsert: true });
  return toDTO({ ...input, decidedAt: now, history });
}

export async function clearUnitResult(studentId: string, courseCode: string, unitCode: string) {
  const res = await (await collection()).deleteOne({ studentId, courseCode, unitCode });
  return res.deletedCount === 1;
}
