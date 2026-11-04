import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import type { MeetingDTO } from "./meetings-meta";

// Scheduled Google Meet meetings (lib/meetings-meta.ts)
// eventId: the Google Calendar event that owns the Meet link (null when the link was pasted)
type MeetingDoc = Omit<MeetingDTO, "id" | "startsAt" | "updatedAt" | "auto"> & {
  _id: string;
  eventId: string | null;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
  updatedAt: Date;
};
type MeetingFields = Omit<MeetingDoc, "_id" | "createdAt" | "updatedAt" | "endsAt">;

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<MeetingDoc>("meetings");
  indexesReady ??= col.createIndexes([{ key: { endsAt: 1, startsAt: 1 } }, { key: { courseCode: 1, startsAt: 1 } }]);
  await indexesReady;
  return col;
}

const toDTO = (d: MeetingDoc): MeetingDTO => ({
  id: d._id,
  courseCode: d.courseCode,
  studentId: d.studentId,
  studentName: d.studentName,
  title: d.title,
  notes: d.notes,
  startsAt: d.startsAt.toISOString(),
  minutes: d.minutes,
  url: d.url,
  auto: !!d.eventId,
  createdBy: d.createdBy,
  updatedAt: d.updatedAt.toISOString(),
});

const endOf = (f: Pick<MeetingFields, "startsAt" | "minutes">) => new Date(f.startsAt.getTime() + f.minutes * 60_000);

// Meetings that haven't ended yet, soonest first — all of them (staff) or those a student is invited to
export async function listUpcomingMeetings(now: Date, forStudent?: { studentId: string; courseCodes: string[] }) {
  const filter = forStudent
    ? { endsAt: { $gt: now }, courseCode: { $in: forStudent.courseCodes }, studentId: { $in: [null, forStudent.studentId] } }
    : { endsAt: { $gt: now } };
  return (await (await collection()).find(filter).sort({ startsAt: 1 }).limit(200).toArray()).map(toDTO);
}

export async function getMeeting(id: string) {
  const doc = await (await collection()).findOne({ _id: String(id) });
  return doc ? toDTO(doc) : null;
}

// The Google Calendar event behind a meeting, if it has one
export async function meetingEventId(id: string) {
  return (await (await collection()).findOne({ _id: String(id) }, { projection: { eventId: 1 } }))?.eventId ?? null;
}

export async function addMeeting(fields: MeetingFields) {
  const now = new Date();
  const doc: MeetingDoc = { _id: randomUUID(), ...fields, endsAt: endOf(fields), createdAt: now, updatedAt: now };
  await (await collection()).insertOne(doc);
  return toDTO(doc);
}

export async function updateMeeting(id: string, fields: MeetingFields) {
  const doc = await (await collection()).findOneAndUpdate(
    { _id: String(id) },
    { $set: { ...fields, endsAt: endOf(fields), updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return doc ? toDTO(doc) : null;
}

export async function removeMeeting(id: string) {
  const doc = await (await collection()).findOneAndDelete({ _id: String(id) });
  return doc ? toDTO(doc) : null;
}
