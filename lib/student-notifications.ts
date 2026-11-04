import "server-only";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";

// What a student sees under "Notification" on their dashboard: changes staff made to their units
// (unlocked, locked, hidden, shown again). Newest first; the oldest are dropped past KEEP per student.
export type StudentNotificationKind = "unlocked" | "locked" | "hidden" | "shown";
export type StudentNotificationDTO = { id: string; kind: StudentNotificationKind; text: string; at: string };

type NotificationDoc = { _id?: ObjectId; studentId: string; courseCode: string; kind: StudentNotificationKind; text: string; at: Date };

const KEEP = 100;
let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<NotificationDoc>("studentNotifications");
  indexesReady ??= col.createIndex({ studentId: 1, at: -1 });
  await indexesReady;
  return col;
}

const VERB: Record<StudentNotificationKind, string> = {
  unlocked: "unlocked — you can start it now",
  locked: "locked",
  hidden: "removed from your course for now",
  shown: "added back to your course",
};
const VERB_MANY: Record<StudentNotificationKind, string> = { ...VERB, unlocked: "unlocked — you can start them now" };

// One notification for one change, whether it touched one unit or many ("Unlock all")
export async function notifyUnitChange(
  studentId: string,
  courseCode: string,
  kind: StudentNotificationKind,
  units: { code: string; title: string }[],
) {
  if (!units.length) return;
  const text =
    units.length === 1
      ? `${units[0].code} – ${units[0].title} was ${VERB[kind]}.`
      : `${units.length} units were ${VERB_MANY[kind]}: ${units.map((u) => u.code).join(", ")}.`;
  try {
    const col = await collection();
    await col.insertOne({ studentId, courseCode, kind, text, at: new Date() });
    // keep only the newest KEEP for this student
    const old = await col.find({ studentId }, { projection: { _id: 1 } }).sort({ at: -1 }).skip(KEEP).toArray();
    if (old.length) await col.deleteMany({ _id: { $in: old.map((d) => d._id!) } });
  } catch (err) {
    // a missed notification must never undo the change itself
    console.error("student notification failed:", err);
  }
}

export async function listStudentNotifications(studentId: string) {
  const docs = await (await collection()).find({ studentId }).sort({ at: -1 }).limit(KEEP).toArray();
  return docs.map((d): StudentNotificationDTO => ({ id: d._id!.toString(), kind: d.kind, text: d.text, at: d.at.toISOString() }));
}
