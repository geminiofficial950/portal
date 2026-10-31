import "server-only";
import { getDb } from "./db";
import { emptyUnitContent, type Resource, type UnitContent } from "./unit-meta";

// Overview text + reading resources for one unit of one course
type UnitContentDoc = UnitContent & { courseCode: string; unitCode: string; updatedAt: Date };

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<UnitContentDoc>("unitContent");
  indexesReady ??= col.createIndexes([
    { key: { courseCode: 1, unitCode: 1 }, unique: true },
    { key: { "resources.file.id": 1 } },
  ]);
  await indexesReady;
  return col;
}

export async function getUnitContent(courseCode: string, unitCode: string): Promise<UnitContent> {
  const doc = await (await collection()).findOne({ courseCode, unitCode });
  return doc ? { overview: doc.overview ?? "", resources: doc.resources ?? [] } : emptyUnitContent();
}

export type UnitContentSummary = { overviewSnippet: string; resources: number };

const toText = (html: string) =>
  html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

// Per unit: the start of the overview + how many resources, for unit lists
export async function listUnitContentSummaries(courseCode?: string): Promise<Record<string, UnitContentSummary>> {
  const docs = await (await collection()).find(courseCode ? { courseCode } : {}).toArray();
  return Object.fromEntries(
    docs.map((d) => [
      courseCode ? d.unitCode : `${d.courseCode}/${d.unitCode}`,
      { overviewSnippet: toText(d.overview ?? "").slice(0, 220), resources: d.resources?.length ?? 0 },
    ]),
  );
}

// Resource counts per unit of a course (for the students' unit list)
export async function countResources(courseCode: string): Promise<Record<string, number>> {
  const all = await listUnitContentSummaries(courseCode);
  return Object.fromEntries(Object.entries(all).map(([unit, s]) => [unit, s.resources]));
}

export async function saveOverview(courseCode: string, unitCode: string, overview: string) {
  await (await collection()).updateOne(
    { courseCode, unitCode },
    { $set: { overview, updatedAt: new Date() }, $setOnInsert: { resources: [] } },
    { upsert: true },
  );
}

export async function addResource(courseCode: string, unitCode: string, resource: Resource) {
  await (await collection()).updateOne(
    { courseCode, unitCode },
    { $push: { resources: resource }, $set: { updatedAt: new Date() }, $setOnInsert: { overview: "" } },
    { upsert: true },
  );
}

export async function removeResource(courseCode: string, unitCode: string, resourceId: string) {
  const col = await collection();
  const before = await col.findOne({ courseCode, unitCode });
  const removed = before?.resources?.find((r) => r.id === resourceId) ?? null;
  if (!removed) return null;
  await col.updateOne({ courseCode, unitCode }, { $pull: { resources: { id: resourceId } }, $set: { updatedAt: new Date() } });
  return removed;
}

export async function deleteUnitContent(courseCode: string, unitCode: string) {
  const col = await collection();
  const doc = await col.findOneAndDelete({ courseCode, unitCode });
  return doc?.resources ?? [];
}

// Which course a resource file belongs to (so only that course's students can download it)
export async function findResourceFile(fileId: string) {
  const doc = await (await collection()).findOne({ "resources.file.id": fileId });
  return doc ? { courseCode: doc.courseCode, unitCode: doc.unitCode } : null;
}
