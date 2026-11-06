import "server-only";
import { randomUUID } from "node:crypto";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";
import { signedUploads, SIGNED_UPLOADS_MAX, submittedReview, type CourseDocSection, type DocReview, type DocumentRequestDTO, type PlacementDocDTO, type SignedDocDTO } from "./document-meta";
import { deleteUploads } from "./files";
import type { FileRef } from "./submission-meta";

type PlacementDoc = Omit<PlacementDocDTO, "createdAt" | "section" | "instructions"> & { _id?: ObjectId; createdAt: Date; section?: CourseDocSection; instructions?: string };
// One record per student and form; `uploads` grows with each file (older records have a single `file`)
type SignedDoc = {
  _id?: ObjectId;
  docId: string;
  studentId: string;
  courseCode: string;
  file?: FileRef;
  uploadedAt?: Date;
  uploads?: { file: FileRef; uploadedAt: Date }[];
  review?: DocReview;
};
type RequestDoc = Omit<DocumentRequestDTO, "createdAt" | "uploadedAt" | "dueAt" | "review"> & { _id?: ObjectId; createdAt: Date; uploadedAt: Date | null; dueAt?: Date | null; review?: DocReview | null };

const iso = (d: Date) => d.toISOString();

let ready: Promise<unknown> | undefined;

async function cols() {
  const db = await getDb();
  const placement = db.collection<PlacementDoc>("placementDocs");
  const signed = db.collection<SignedDoc>("placementSigned");
  const requests = db.collection<RequestDoc>("documentRequests");
  ready ??= Promise.all([
    placement.createIndexes([{ key: { docId: 1 }, unique: true }, { key: { courseCode: 1 } }]),
    signed.createIndexes([{ key: { studentId: 1, docId: 1 }, unique: true }]),
    requests.createIndexes([{ key: { requestId: 1 }, unique: true }, { key: { studentId: 1 } }]),
  ]).catch((err) => {
    ready = undefined;
    throw err;
  });
  await ready;
  return { placement, signed, requests };
}

const placementDTO = ({ docId, courseCode, title, file, createdAt, section, instructions }: PlacementDoc): PlacementDocDTO => ({
  docId,
  courseCode,
  title,
  file,
  createdAt: iso(createdAt),
  section: section ?? "placement",
  instructions: instructions ?? "",
});
const signedDTO = (d: SignedDoc): SignedDocDTO => ({ docId: d.docId, studentId: d.studentId, uploads: signedUploads(d), review: d.review ?? submittedReview() });
const filesOf = (d: SignedDoc) => signedUploads(d).map((u) => u.file);
const requestDTO = (d: RequestDoc): DocumentRequestDTO => ({
  requestId: d.requestId,
  studentId: d.studentId,
  name: d.name,
  note: d.note,
  file: d.file,
  uploadedAt: d.uploadedAt ? iso(d.uploadedAt) : null,
  createdAt: iso(d.createdAt),
  dueAt: d.dueAt ? iso(d.dueAt) : null,
  review: d.file ? (d.review ?? submittedReview()) : null,
});

// ---------- Placement documents (per course) ----------

export async function listPlacementDocs(courseCodes: string[]) {
  if (!courseCodes.length) return [];
  const docs = await (await cols()).placement.find({ courseCode: { $in: courseCodes } }).sort({ createdAt: 1 }).toArray();
  return docs.map(placementDTO);
}

export async function getPlacementDoc(docId: string) {
  const doc = await (await cols()).placement.findOne({ docId });
  return doc ? placementDTO(doc) : null;
}

export async function addPlacementDoc(courseCode: string, title: string, file: FileRef, extra: { section: CourseDocSection; instructions: string } = { section: "placement", instructions: "" }) {
  const doc: PlacementDoc = { docId: randomUUID(), courseCode, title, file, createdAt: new Date(), ...extra };
  await (await cols()).placement.insertOne(doc);
  return placementDTO(doc);
}

// Removes the form and every signed copy of it (files too)
export async function removePlacementDoc(docId: string) {
  const { placement, signed } = await cols();
  const doc = await placement.findOne({ docId });
  if (!doc) return false;
  const copies = await signed.find({ docId }).toArray();
  await Promise.all([placement.deleteOne({ docId }), signed.deleteMany({ docId })]);
  await deleteUploads([doc.file.id, ...copies.flatMap((c) => filesOf(c).map((f) => f.id))]);
  return true;
}

// How many students uploaded a signed copy, per document
export async function countSigned(docIds: string[]) {
  if (!docIds.length) return {};
  const rows = await (await cols()).signed
    .aggregate<{ _id: string; n: number }>([{ $match: { docId: { $in: docIds } } }, { $group: { _id: "$docId", n: { $sum: 1 } } }])
    .toArray();
  return Object.fromEntries(rows.map((r) => [r._id, r.n])) as Record<string, number>;
}

export async function listSignedDocs(studentId: string) {
  const docs = await (await cols()).signed.find({ studentId }).toArray();
  return docs.map(signedDTO);
}

export class TooManySignedError extends Error {}

// Adds a signed copy to the student's list for this form (nothing is replaced). Returns the whole list.
export async function addSignedDoc(studentId: string, doc: PlacementDocDTO, file: FileRef) {
  const { signed } = await cols();
  const prev = await signed.findOne({ studentId, docId: doc.docId });
  const have = prev ? signedUploads(prev) : [];
  if (have.length >= SIGNED_UPLOADS_MAX) throw new TooManySignedError();
  // An older single-file record is turned into the list on its first new upload
  const uploads = [...have.map((u) => ({ file: u.file, uploadedAt: new Date(u.uploadedAt) })), { file, uploadedAt: new Date() }];
  await signed.updateOne(
    { studentId, docId: doc.docId },
    // a new upload goes back to "Submitted" for review
    { $set: { courseCode: doc.courseCode, uploads, review: submittedReview() }, $unset: { file: "", uploadedAt: "" } },
    { upsert: true },
  );
  return signedDTO({ studentId, docId: doc.docId, courseCode: doc.courseCode, uploads });
}

// Staff review of a student's signed placement form
export async function reviewSignedDoc(studentId: string, docId: string, review: Omit<DocReview, "at">) {
  const res = await (await cols()).signed.findOneAndUpdate({ studentId, docId }, { $set: { review: { ...review, at: new Date().toISOString() } } }, { returnDocument: "after" });
  return res ? signedDTO(res) : null;
}

// The placement form a file belongs to, if it is one (for download permission)
export async function findPlacementFile(fileId: string) {
  const doc = await (await cols()).placement.findOne({ "file.id": fileId });
  return doc ? placementDTO(doc) : null;
}

// ---------- Documents requested from one student ----------

export async function listRequests(studentId: string) {
  const docs = await (await cols()).requests.find({ studentId }).sort({ createdAt: 1 }).toArray();
  return docs.map(requestDTO);
}

export async function getRequest(requestId: string) {
  const doc = await (await cols()).requests.findOne({ requestId });
  return doc ? requestDTO(doc) : null;
}

export async function createRequest(studentId: string, name: string, note: string, dueAt: Date | null = null) {
  const doc: RequestDoc = { requestId: randomUUID(), studentId, name, note, file: null, uploadedAt: null, createdAt: new Date(), dueAt, review: null };
  await (await cols()).requests.insertOne(doc);
  return requestDTO(doc);
}

export async function deleteRequest(requestId: string) {
  const { requests } = await cols();
  const doc = await requests.findOne({ requestId });
  if (!doc) return false;
  await requests.deleteOne({ requestId });
  if (doc.file) await deleteUploads([doc.file.id]);
  return true;
}

// The student's upload for a request (replaces an earlier one)
export async function fulfilRequest(requestId: string, file: FileRef) {
  const { requests } = await cols();
  const prev = await requests.findOne({ requestId });
  if (!prev) return null;
  const uploadedAt = new Date();
  await requests.updateOne({ requestId }, { $set: { file, uploadedAt, review: submittedReview() } });
  if (prev.file && prev.file.id !== file.id) await deleteUploads([prev.file.id]);
  return requestDTO({ ...prev, file, uploadedAt, review: submittedReview() });
}

// Staff review of a requested document
export async function reviewRequest(requestId: string, review: Omit<DocReview, "at">) {
  const res = await (await cols()).requests.findOneAndUpdate({ requestId, file: { $ne: null } }, { $set: { review: { ...review, at: new Date().toISOString() } } }, { returnDocument: "after" });
  return res ? requestDTO(res) : null;
}
