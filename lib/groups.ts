import "server-only";
import { randomUUID } from "node:crypto";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";
import type { GroupDTO } from "./group-meta";

// Student groups (batches/classes) made by Super Admin. A student is in at most one group.
type GroupDoc = {
  _id?: ObjectId;
  groupId: string;
  name: string;
  nameKey: string; // lower-case name, keeps names unique regardless of case
  createdAt: Date;
};

export class DuplicateGroupError extends Error {}

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<GroupDoc>("studentGroups");
  indexesReady ??= col.createIndexes([
    { key: { groupId: 1 }, unique: true },
    { key: { nameKey: 1 }, unique: true },
  ]);
  await indexesReady;
  return col;
}

const toDTO = (d: GroupDoc, students = 0): GroupDTO => ({ groupId: d.groupId, name: d.name, students });

// Every group with how many students are in it, A–Z
export async function listGroups() {
  const db = await getDb();
  const [docs, counts] = await Promise.all([
    (await collection()).find().sort({ nameKey: 1 }).toArray(),
    db
      .collection("students")
      .aggregate<{ _id: string; n: number }>([
        { $match: { groupId: { $type: "string" } } },
        { $group: { _id: "$groupId", n: { $sum: 1 } } },
      ])
      .toArray(),
  ]);
  return docs.map((d) => toDTO(d, counts.find((c) => c._id === d.groupId)?.n ?? 0));
}

export async function groupExists(groupId: string) {
  return (await (await collection()).countDocuments({ groupId })) === 1;
}

export async function createGroup(name: string) {
  const doc: GroupDoc = { groupId: randomUUID(), name, nameKey: name.toLowerCase(), createdAt: new Date() };
  try {
    await (await collection()).insertOne(doc);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new DuplicateGroupError();
    throw err;
  }
  return toDTO(doc);
}

export async function renameGroup(groupId: string, name: string) {
  try {
    const res = await (await collection()).updateOne({ groupId }, { $set: { name, nameKey: name.toLowerCase() } });
    return res.matchedCount === 1;
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new DuplicateGroupError();
    throw err;
  }
}

// Removes the group; its students stay, just without a group
export async function deleteGroup(groupId: string) {
  const res = await (await collection()).deleteOne({ groupId });
  if (res.deletedCount !== 1) return false;
  await (await getDb()).collection("students").updateMany({ groupId }, { $set: { groupId: null } });
  return true;
}
