import "server-only";
import { randomUUID } from "node:crypto";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";
import type { DocumentRequestDTO, PlacementDocDTO, SignedDocDTO } from "./document-meta";
import { deleteUploads } from "./files";
import type { FileRef } from "./submission-meta";

type PlacementDoc = Omit<PlacementDocDTO, "createdAt"> & { _id?: ObjectId; createdAt: Date };
type SignedDoc = Omit<SignedDocDTO, "uploadedAt"> & { _id?: ObjectId; courseCode: string; uploadedAt: Date };
type RequestDoc = Omit<DocumentRequestDTO, "createdAt" | "uploadedAt"> & { _id?: ObjectId; createdAt: Date; uploadedAt: Date | null };

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

const placementDTO = ({ docId, courseCode, title, file, createdAt }: PlacementDoc): PlacementDocDTO => ({
  docId,
  courseCode,
  title,
  file,
  createdAt: iso(createdAt),
});
const signedDTO = ({ docId, studentId, file, uploadedAt }: SignedDoc): SignedDocDTO => ({ docId, studentId, file, uploadedAt: iso(uploadedAt) });
const requestDTO = (d: RequestDoc): DocumentRequestDTO => ({
  requestId: d.requestId,
  studentId: d.studentId,
  name: d.name,
  note: d.note,
  file: d.file,
  uploadedAt: d.uploadedAt ? iso(d.uploadedAt) : null,
  createdAt: iso(d.createdAt),
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

export async function addPlacementDoc(courseCode: string, title: string, file: FileRef) {
  const doc: PlacementDoc = { docId: randomUUID(), courseCode, title, file, createdAt: new Date() };
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
  await deleteUploads([doc.file.id, ...copies.map((c) => c.file.id)]);
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

// Saves (or replaces) the student's signed copy; returns the file it replaced
export async function saveSignedDoc(studentId: string, doc: PlacementDocDTO, file: FileRef) {
  const { signed } = await cols();
  const prev = await signed.findOne({ studentId, docId: doc.docId });
  const uploadedAt = new Date();
  await signed.updateOne(
    { studentId, docId: doc.docId },
    { $set: { courseCode: doc.courseCode, file, uploadedAt } },
    { upsert: true },
  );
  if (prev && prev.file.id !== file.id) await deleteUploads([prev.file.id]);
  return signedDTO({ studentId, docId: doc.docId, courseCode: doc.courseCode, file, uploadedAt });
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

export async function createRequest(studentId: string, name: string, note: string) {
  const doc: RequestDoc = { requestId: randomUUID(), studentId, name, note, file: null, uploadedAt: null, createdAt: new Date() };
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
  await requests.updateOne({ requestId }, { $set: { file, uploadedAt } });
  if (prev.file && prev.file.id !== file.id) await deleteUploads([prev.file.id]);
  return requestDTO({ ...prev, file, uploadedAt });
}
