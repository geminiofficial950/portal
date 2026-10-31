import "server-only";
import { getDb } from "./db";
import { timeAgo } from "./format";

export type ActivityKind = "student" | "course" | "trainer" | "ticket" | "settings";

type ActivityDoc = { who: string; what: string; kind: ActivityKind; at: Date };

export type ActivityDTO = { who: string; what: string; kind: ActivityKind; when: string };

// Best-effort audit trail: never let a logging failure break the action itself.
export async function logActivity(who: string, what: string, kind: ActivityKind) {
  try {
    const db = await getDb();
    await db.collection<ActivityDoc>("activity").insertOne({ who, what, kind, at: new Date() });
  } catch (err) {
    console.error("logActivity failed:", err);
  }
}

export async function listActivity(limit = 6): Promise<ActivityDTO[]> {
  const db = await getDb();
  const docs = await db.collection<ActivityDoc>("activity").find().sort({ at: -1 }).limit(limit).toArray();
  const now = new Date();
  return docs.map(({ who, what, kind, at }) => ({ who, what, kind, when: timeAgo(at, now) }));
}
