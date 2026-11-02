import "server-only";
import { getDb } from "./db";
import { emptyAssessment, summarise, type AssessmentSummary, type UnitAssessment } from "./assessment-meta";

type AssessmentDoc = Omit<UnitAssessment, "dueAt"> & {
  courseCode: string;
  unitCode: string;
  dueAt: Date | null;
  updatedAt: Date;
};

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<AssessmentDoc>("assessments");
  indexesReady ??= col.createIndex({ courseCode: 1, unitCode: 1 }, { unique: true });
  await indexesReady;
  return col;
}

// Missing parts fall back to empty ones, so older documents still load
function withDefaults(doc: Partial<AssessmentDoc> | null): UnitAssessment {
  const e = emptyAssessment();
  return {
    dueAt: doc?.dueAt ? doc.dueAt.toISOString() : null,
    quiz: { ...e.quiz, ...doc?.quiz },
    theory: { ...e.theory, ...doc?.theory },
    rolePlay: { ...e.rolePlay, ...doc?.rolePlay },
    workplace: { ...e.workplace, ...doc?.workplace },
  };
}

export async function getAssessment(courseCode: string, unitCode: string): Promise<UnitAssessment> {
  return withDefaults(await (await collection()).findOne({ courseCode, unitCode }));
}

export async function saveAssessment(courseCode: string, unitCode: string, a: UnitAssessment) {
  await (await collection()).updateOne(
    { courseCode, unitCode },
    { $set: { ...a, dueAt: a.dueAt ? new Date(a.dueAt) : null, updatedAt: new Date() } },
    { upsert: true },
  );
}

export async function deleteAssessment(courseCode: string, unitCode: string) {
  await (await collection()).deleteOne({ courseCode, unitCode });
}

// Every unit assessment of one course, keyed by unit code
export async function listCourseAssessments(courseCode: string): Promise<Record<string, UnitAssessment>> {
  const docs = await (await collection()).find({ courseCode }).toArray();
  return Object.fromEntries(docs.map((d) => [d.unitCode, withDefaults(d)]));
}

// "COURSE/UNIT" → summary, for every unit that has an assessment saved
export async function listAssessmentSummaries(): Promise<Record<string, AssessmentSummary>> {
  const docs = await (await collection()).find().toArray();
  return Object.fromEntries(docs.map((d) => [`${d.courseCode}/${d.unitCode}`, summarise(withDefaults(d))]));
}

// The unit whose Theory Task or Workplacement Task uses this file, if any
export async function findAssessmentFile(fileId: string) {
  const doc = await (await collection()).findOne({ $or: [{ "theory.files.id": fileId }, { "workplace.files.id": fileId }] });
  return doc ? { courseCode: doc.courseCode, unitCode: doc.unitCode } : null;
}
