import "server-only";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";
import { certificateSeed } from "./course-seed";

export type Unit = { code: string; title: string };

type CourseDoc = {
  _id?: ObjectId;
  code: string;
  name: string;
  release: string;
  category: string;
  duration: string;
  units: Unit[];
  createdAt: Date;
};

export type CourseDTO = Omit<CourseDoc, "_id" | "createdAt">;

const toDTO = ({ code, name, release, category, duration, units }: CourseDoc): CourseDTO => ({
  code,
  name,
  release,
  category,
  duration,
  units,
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

export async function listCourses() {
  const col = await collection();
  return (await col.find().sort({ code: 1 }).toArray()).map(toDTO);
}

export async function getCourse(code: string) {
  const doc = await (await collection()).findOne({ code });
  return doc ? toDTO(doc) : null;
}

export async function countCourses() {
  return (await collection()).countDocuments();
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
