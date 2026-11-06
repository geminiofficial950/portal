import "server-only";
import { randomUUID } from "node:crypto";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";
import type { ClassSessionDTO } from "./session-meta";

// Class sessions of batches (lib/session-meta.ts). Cancelling keeps the session (shown as cancelled, no Join).
type SessionDoc = Omit<ClassSessionDTO, "startsAt" | "endsAt" | "updatedAt"> & { _id?: ObjectId; startsAt: Date; endsAt: Date; updatedAt: Date; createdBy: string };

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<SessionDoc>("classSessions");
  indexesReady ??= col.createIndexes([{ key: { sessionId: 1 }, unique: true }, { key: { batchId: 1, startsAt: 1 } }]);
  await indexesReady;
  return col;
}

const toDTO = (d: SessionDoc): ClassSessionDTO => ({
  sessionId: d.sessionId,
  batchId: d.batchId,
  courseCode: d.courseCode,
  unitCode: d.unitCode,
  title: d.title,
  trainerId: d.trainerId,
  trainerName: d.trainerName,
  startsAt: d.startsAt.toISOString(),
  endsAt: d.endsAt.toISOString(),
  timezone: d.timezone,
  link: d.link,
  instructions: d.instructions,
  cancelled: d.cancelled,
  updatedAt: d.updatedAt.toISOString(),
});

export async function listSessions(batchIds: string[]) {
  if (!batchIds.length) return [];
  return (await (await collection()).find({ batchId: { $in: batchIds } }).sort({ startsAt: 1 }).toArray()).map(toDTO);
}

export async function getSession(sessionId: string) {
  const doc = await (await collection()).findOne({ sessionId: String(sessionId) });
  return doc ? toDTO(doc) : null;
}

type Fields = Omit<ClassSessionDTO, "sessionId" | "batchId" | "courseCode" | "cancelled" | "updatedAt" | "startsAt" | "endsAt"> & { startsAt: Date; endsAt: Date };

export async function addSession(batch: { batchId: string; courseCode: string }, f: Fields, createdBy: string) {
  const doc: SessionDoc = { sessionId: randomUUID(), batchId: batch.batchId, courseCode: batch.courseCode, ...f, cancelled: false, updatedAt: new Date(), createdBy };
  await (await collection()).insertOne(doc);
  return toDTO(doc);
}

export async function updateSession(sessionId: string, f: Fields) {
  const doc = await (await collection()).findOneAndUpdate({ sessionId, cancelled: false }, { $set: { ...f, updatedAt: new Date() } }, { returnDocument: "after" });
  return doc ? toDTO(doc) : null;
}

export async function cancelSession(sessionId: string) {
  const doc = await (await collection()).findOneAndUpdate({ sessionId, cancelled: false }, { $set: { cancelled: true, updatedAt: new Date() } }, { returnDocument: "after" });
  return doc ? toDTO(doc) : null;
}
