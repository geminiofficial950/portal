import "server-only";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";
import { certificateSeed } from "./course-seed";

export type Unit = { code: string; title: string };

type CourseDoc = {
  _id?: ObjectId;
  code: string;
  name: string;
  release?: string; // older courses only — no longer shown or asked for
  category: string;
  duration: string;
  units: Unit[];
  placementHours?: number | null; // work placement hours, set by Super Admin
  placementText?: string; // placement information for students, set by Super Admin
  description?: string; // what the course is about, shown on the student's course page
  deleted?: boolean; // deleted by Super Admin: hidden everywhere (kept so the starter courses aren't added back)
  createdAt: Date;
};

export type CourseDTO = Omit<CourseDoc, "_id" | "createdAt" | "placementHours" | "placementText" | "description" | "deleted" | "release"> & {
  placementHours: number | null;
  placementText: string;
  description: string;
};

const toDTO = ({ code, name, category, duration, units, placementHours, placementText, description }: CourseDoc): CourseDTO => ({
  code,
  name,
  category,
  duration,
  units,
  placementHours: placementHours ?? null,
  placementText: placementText ?? "",
  description: description ?? "",
});

let ready: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<CourseDoc>("courses");
  // Index + one-time seed. $setOnInsert never overwrites units edited by the admin.
  ready ??= Promise.all([
    col.createIndex({ code: 1 }, { unique: true }),
    col.bulkWrite(
      certificateSeed.map((c) => ({
        updateOne: {
          filter: { code: c.code },
          update: { $setOnInsert: { ...c, createdAt: new Date() } },
          upsert: true,
        },
      })),
    ),
  ]).catch((err) => {
    ready = undefined; // retry on next request
    throw err;
  });
  await ready;
  return col;
}

const LIVE = { deleted: { $ne: true } };

export async function listCourses() {
  const col = await collection();
  return (await col.find(LIVE).sort({ code: 1 }).toArray()).map(toDTO);
}

export async function getCourse(code: string) {
  const doc = await (await collection()).findOne({ code, ...LIVE });
  return doc ? toDTO(doc) : null;
}

export async function countCourses() {
  return (await collection()).countDocuments(LIVE);
}

export class DuplicateCourseError extends Error {}

// Super Admin / Admins add a course; its batches and units come after. A code that was deleted before can be used again.
// `units`: the units chosen while creating the course (more can be added later)
export async function createCourse(c: { code: string; name: string; category: string; duration: string; description: string }, units: Unit[] = []) {
  const col = await collection();
  const existing = await col.findOne({ code: c.code });
  if (existing && !existing.deleted) throw new DuplicateCourseError();
  if (existing) {
    await col.updateOne({ code: c.code }, { $set: { ...c, units, deleted: false, createdAt: new Date() } });
  } else {
    await col.insertOne({ ...c, units, placementHours: null, placementText: "", createdAt: new Date() });
  }
  return toDTO({ ...c, units, createdAt: new Date() });
}

// Name, category, duration and description (not the code: students and work are filed under it)
export async function updateCourseDetails(code: string, d: { name: string; category: string; duration: string; description: string }) {
  const res = await (await collection()).updateOne({ code, ...LIVE }, { $set: d });
  return res.matchedCount === 1;
}

// Super Admin only (checked by the caller)
export async function deleteCourse(code: string) {
  const res = await (await collection()).updateOne({ code, ...LIVE }, { $set: { deleted: true } });
  return res.matchedCount === 1;
}

export async function setPlacementHours(code: string, hours: number | null) {
  const res = await (await collection()).updateOne({ code }, { $set: { placementHours: hours } });
  return res.matchedCount === 1;
}

export async function setPlacementText(code: string, text: string) {
  const res = await (await collection()).updateOne({ code }, { $set: { placementText: text } });
  return res.matchedCount === 1;
}

export type UnitChange = "ok" | "not-found" | "duplicate";

export async function addUnit(courseCode: string, unit: Unit): Promise<UnitChange> {
  const col = await collection();
  const res = await col.updateOne(
    { code: courseCode, "units.code": { $ne: unit.code } },
    { $push: { units: unit } },
  );
  if (res.matchedCount === 1) return "ok";
  return (await col.countDocuments({ code: courseCode })) ? "duplicate" : "not-found";
}

export async function removeUnit(courseCode: string, unitCode: string): Promise<UnitChange> {
  const col = await collection();
  const res = await col.updateOne({ code: courseCode }, { $pull: { units: { code: unitCode } } });
  return res.matchedCount === 1 ? "ok" : "not-found";
}
