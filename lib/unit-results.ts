import "server-only";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";
import { resolveResult, type ResultOption } from "./result-meta";
import { listResultOptions } from "./result-options";
import type { UnitResultDTO } from "./unit-meta";

// One final outcome per student per unit; older outcomes are kept in history when it's changed.
// `result` is a result option id; its name and colour are looked up when read, so renaming an option updates every result.
type UnitResultInput = Omit<UnitResultDTO, "decidedAt" | "label" | "kind" | "tone">;
type UnitResultDoc = UnitResultInput & {
  _id?: ObjectId;
  decidedAt: Date;
  history: { result: string; feedback: string; decidedBy: string; decidedAt: Date }[];
};

const toDTO = (d: UnitResultDoc, options: ResultOption[]): UnitResultDTO => {
  const { label, kind, tone } = resolveResult(d.result, options);
  return {
    studentId: d.studentId,
    courseCode: d.courseCode,
    unitCode: d.unitCode,
    result: d.result,
    label,
    kind,
    tone,
    feedback: d.feedback,
    decidedBy: d.decidedBy,
    decidedAt: d.decidedAt.toISOString(),
  };
};

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<UnitResultDoc>("unitResults");
  indexesReady ??= col.createIndex({ studentId: 1, courseCode: 1, unitCode: 1 }, { unique: true });
  await indexesReady;
  return col;
}

export async function listStudentResults(studentId: string, courseCode: string) {
  const [docs, options] = await Promise.all([(await collection()).find({ studentId, courseCode }).toArray(), listResultOptions()]);
  return docs.map((d) => toDTO(d, options));
}

export async function getUnitResult(studentId: string, courseCode: string, unitCode: string) {
  const [doc, options] = await Promise.all([(await collection()).findOne({ studentId, courseCode, unitCode }), listResultOptions()]);
  return doc ? toDTO(doc, options) : null;
}

export async function setUnitResult(input: UnitResultInput) {
  const col = await collection();
  const key = { studentId: input.studentId, courseCode: input.courseCode, unitCode: input.unitCode };
  const prev = await col.findOne(key);
  const now = new Date();
  const history = prev?.history ?? [];
  if (prev) history.push({ result: prev.result, feedback: prev.feedback, decidedBy: prev.decidedBy, decidedAt: prev.decidedAt });
  await col.updateOne(key, { $set: { ...input, decidedAt: now, history } }, { upsert: true });
  return toDTO({ ...input, decidedAt: now, history }, await listResultOptions());
}

// How many students currently hold this result (an option in use can't be deleted)
export async function countResultsUsing(resultId: string) {
  return (await collection()).countDocuments({ result: resultId });
}

export async function clearUnitResult(studentId: string, courseCode: string, unitCode: string) {
  const res = await (await collection()).deleteOne({ studentId, courseCode, unitCode });
  return res.deletedCount === 1;
}
