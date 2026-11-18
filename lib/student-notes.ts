import "server-only";
import { randomUUID } from "node:crypto";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";
import { listBatches } from "./groups";
import { getStudent } from "./students";
import { listTrainers } from "./trainers";

// Staff notes on a student (never shown to the student).
// - An Admin's note is seen by every Admin and by the trainers the Admin picked.
// - A trainer's note is seen by that trainer and every Admin (not by other trainers).
export const NOTE_MAX = 2000;

type NoteDoc = {
  _id?: ObjectId;
  noteId: string;
  studentId: string;
  text: string;
  byRole: "admin" | "trainer";
  byId: string;
  byName: string;
  trainerIds: string[]; // Admin notes: the trainers who can see it
  trainerNames: string[];
  createdAt: Date;
};

export type StudentNoteDTO = {
  noteId: string;
  text: string;
  byRole: "admin" | "trainer";
  byName: string;
  forNames: string[]; // who else sees it, in words
  at: string;
};

export type NoteViewer = { role: "admin" | "trainer"; id: string };

let indexesReady: Promise<unknown> | undefined;
async function collection() {
  const col = (await getDb()).collection<NoteDoc>("studentNotes");
  indexesReady ??= col.createIndexes([{ key: { studentId: 1, createdAt: -1 } }, { key: { noteId: 1 }, unique: true }]);
  await indexesReady;
  return col;
}

const toDTO = (d: NoteDoc): StudentNoteDTO => ({
  noteId: d.noteId,
  text: d.text,
  byRole: d.byRole,
  byName: d.byName,
  forNames: d.byRole === "trainer" ? ["Admins"] : ["Admins", ...d.trainerNames],
  at: d.createdAt.toISOString(),
});

const visibleTo = (viewer: NoteViewer) =>
  viewer.role === "admin" ? {} : { $or: [{ byRole: "trainer" as const, byId: viewer.id }, { byRole: "admin" as const, trainerIds: viewer.id }] };

export async function listStudentNotes(studentId: string, viewer: NoteViewer) {
  const docs = await (await collection()).find({ studentId, ...visibleTo(viewer) }).sort({ createdAt: -1 }).toArray();
  return docs.map(toDTO);
}

export async function addStudentNote(input: Omit<NoteDoc, "_id" | "noteId" | "createdAt">) {
  const doc: NoteDoc = { ...input, noteId: randomUUID(), createdAt: new Date() };
  await (await collection()).insertOne(doc);
  return toDTO(doc);
}

// The trainers an Admin can share a note with: the active trainers of the student's batches
export async function trainersOfStudent(studentId: string) {
  const [student, batches, trainers] = await Promise.all([getStudent(studentId), listBatches(), listTrainers()]);
  const ids = new Set(batches.filter((b) => student?.batchIds.includes(b.batchId)).flatMap((b) => b.trainers.map((t) => t.trainerId)));
  return trainers.filter((t) => t.active && ids.has(t.trainerId)).map((t) => ({ trainerId: t.trainerId, name: t.name }));
}
