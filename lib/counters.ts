import "server-only";
import { getDb } from "./db";

// Atomic sequence per name (studentId, trainerId, ticketId…). First call returns 1.
export async function nextSeq(name: string) {
  const db = await getDb();
  const counter = await db
    .collection<{ _id: string; seq: number }>("counters")
    .findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  return counter?.seq ?? 1;
}
