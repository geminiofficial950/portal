import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import type { ClassLinkDTO } from "./classroom-meta";

// Google Meet links per course (lib/classroom-meta.ts)
type ClassLinkDoc = Omit<ClassLinkDTO, "id" | "updatedAt"> & { _id: string; createdAt: Date; updatedAt: Date };

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<ClassLinkDoc>("classLinks");
  indexesReady ??= col.createIndex({ courseCode: 1, createdAt: 1 });
  await indexesReady;
  return col;
}

const toDTO = (d: ClassLinkDoc): ClassLinkDTO => ({
  id: d._id,
  courseCode: d.courseCode,
  title: d.title,
  url: d.url,
  addedBy: d.addedBy,
  updatedAt: d.updatedAt.toISOString(),
});

// Every class link, or only those of these courses
export async function listClassLinks(courseCodes?: string[]) {
  const filter = courseCodes ? { courseCode: { $in: courseCodes } } : {};
  return (await (await collection()).find(filter).sort({ courseCode: 1, createdAt: 1 }).toArray()).map(toDTO);
}

export async function getClassLink(id: string) {
  const doc = await (await collection()).findOne({ _id: String(id) });
  return doc ? toDTO(doc) : null;
}

export async function countClassLinks(courseCode: string) {
  return (await collection()).countDocuments({ courseCode });
}

export async function addClassLink(link: { courseCode: string; title: string; url: string; addedBy: string }) {
  const now = new Date();
  const doc: ClassLinkDoc = { _id: randomUUID(), ...link, createdAt: now, updatedAt: now };
  await (await collection()).insertOne(doc);
  return toDTO(doc);
}

export async function updateClassLink(id: string, change: { title: string; url: string; addedBy: string }) {
  const doc = await (await collection()).findOneAndUpdate(
    { _id: String(id) },
    { $set: { ...change, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return doc ? toDTO(doc) : null;
}

export async function removeClassLink(id: string) {
  const doc = await (await collection()).findOneAndDelete({ _id: String(id) });
  return doc ? toDTO(doc) : null;
}
