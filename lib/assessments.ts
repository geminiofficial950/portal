import "server-only";
import { getDb } from "./db";
import type { UnitAssessment } from "./assessment-meta";
import { liveModules, modulesFromLegacy, type LegacyAssessment, type Module } from "./module-meta";

// One record per unit of a course: its modules. Older records hold the fixed quiz / theory / workplace parts
// instead (kept untouched); they're read as modules until admin saves the unit, which writes `modules`.
type AssessmentDoc = LegacyAssessment & {
  courseCode: string;
  unitCode: string;
  modules?: Module[];
  updatedAt: Date;
};

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<AssessmentDoc>("assessments");
  indexesReady ??= col.createIndex({ courseCode: 1, unitCode: 1 }, { unique: true });
  await indexesReady;
  return col;
}

const toAssessment = (doc: AssessmentDoc | null): UnitAssessment => ({
  modules: Array.isArray(doc?.modules) ? doc.modules : modulesFromLegacy(doc),
});

export async function getAssessment(courseCode: string, unitCode: string): Promise<UnitAssessment> {
  return toAssessment(await (await collection()).findOne({ courseCode, unitCode }));
}

export async function saveAssessment(courseCode: string, unitCode: string, a: UnitAssessment) {
  await (await collection()).updateOne({ courseCode, unitCode }, { $set: { modules: a.modules, updatedAt: new Date() } }, { upsert: true });
}

export async function deleteAssessment(courseCode: string, unitCode: string) {
  await (await collection()).deleteOne({ courseCode, unitCode });
}

// Every unit assessment of one course, keyed by unit code
export async function listCourseAssessments(courseCode: string): Promise<Record<string, UnitAssessment>> {
  const docs = await (await collection()).find({ courseCode }).toArray();
  return Object.fromEntries(docs.map((d) => [d.unitCode, toAssessment(d)]));
}

// "COURSE/UNIT" → assessment, for every unit that has one saved
export async function listAllAssessments(): Promise<Record<string, UnitAssessment>> {
  const docs = await (await collection()).find().toArray();
  return Object.fromEntries(docs.map((d) => [`${d.courseCode}/${d.unitCode}`, toAssessment(d)]));
}

// The unit and module whose task documents or activity images include this file, if any
export async function findAssessmentFile(fileId: string) {
  const doc = await (await collection()).findOne({
    $or: [
      { "modules.files.id": fileId },
      { "modules.activities.image.id": fileId },
      { modules: { $exists: false }, "theory.files.id": fileId },
      { modules: { $exists: false }, "workplace.files.id": fileId },
    ],
  });
  if (!doc) return null;
  const mod = toAssessment(doc).modules.find(
    (m) => m.files.some((f) => f.id === fileId) || m.activities.some((a) => a.type === "image" && a.image?.id === fileId),
  );
  return mod ? { courseCode: doc.courseCode, unitCode: doc.unitCode, moduleId: mod.id } : null;
}

// Trainer dashboard: module due dates between now and `days` ahead, soonest first
export async function listUpcomingDue(days = 14, now = new Date()) {
  const until = now.getTime() + days * 86400000;
  const docs = await (await collection()).find().toArray();
  return docs
    .flatMap((d) =>
      liveModules(toAssessment(d).modules)
        .filter((m) => m.dueAt && new Date(m.dueAt).getTime() >= now.getTime() && new Date(m.dueAt).getTime() <= until)
        .map((m) => ({ courseCode: d.courseCode, unitCode: d.unitCode, moduleId: m.id, moduleTitle: m.title, dueAt: m.dueAt! })),
    )
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}
