import "server-only";
import { randomUUID } from "node:crypto";
import type { ObjectId } from "mongodb";
import type { AssessmentPart } from "./assessment-meta";
import { getDb } from "./db";
import type { FileRef, PastAttempt, SubmissionContent, SubmissionDTO, SubmissionStatus } from "./submission-meta";

type SubmissionDoc = {
  _id?: ObjectId;
  submissionId: string;
  studentId: string;
  studentName: string;
  courseCode: string;
  unitCode: string;
  unitTitle: string;
  part: AssessmentPart;
  status: SubmissionStatus;
  attempt: number;
  content: SubmissionContent;
  files: FileRef[];
  photo?: FileRef | null;
  criteriaMet: string[];
  feedback: string;
  decidedBy: string | null;
  decidedAt: Date | null;
  submittedAt: Date | null;
  updatedAt: Date;
  history: (Omit<PastAttempt, "decidedAt"> & { decidedAt: Date })[];
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

const toDTO = (d: SubmissionDoc): SubmissionDTO => ({
  submissionId: d.submissionId,
  studentId: d.studentId,
  studentName: d.studentName,
  courseCode: d.courseCode,
  unitCode: d.unitCode,
  unitTitle: d.unitTitle,
  part: d.part,
  status: d.status,
  attempt: d.attempt,
  content: d.content,
  files: d.files,
  photo: d.photo ?? null,
  criteriaMet: d.criteriaMet,
  feedback: d.feedback,
  decidedBy: d.decidedBy,
  decidedAt: iso(d.decidedAt),
  submittedAt: iso(d.submittedAt),
  updatedAt: d.updatedAt.toISOString(),
  history: d.history.map((h) => ({ ...h, decidedAt: h.decidedAt.toISOString() })),
});

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<SubmissionDoc>("submissions");
  indexesReady ??= col.createIndexes([
    { key: { submissionId: 1 }, unique: true },
    { key: { studentId: 1, courseCode: 1, unitCode: 1, part: 1 }, unique: true },
    { key: { status: 1, submittedAt: 1 } },
  ]);
  await indexesReady;
  return col;
}

export type WorkKey = { studentId: string; courseCode: string; unitCode: string; part: AssessmentPart };

export async function listStudentSubmissions(studentId: string, courseCode: string) {
  const docs = await (await collection()).find({ studentId, courseCode }).toArray();
  return docs.map(toDTO);
}

export async function getSubmission(submissionId: string) {
  const doc = await (await collection()).findOne({ submissionId });
  return doc ? toDTO(doc) : null;
}

export async function getWork(key: WorkKey) {
  const doc = await (await collection()).findOne(key);
  return doc ? toDTO(doc) : null;
}

export class LockedError extends Error {}

/**
 * Save a student's work as Draft or Submitted (staff set Accepted / Rejected / MoreDocs later).
 * Only allowed when nothing exists yet, or the current copy is a Draft or was Rejected.
 * Re-working a rejected copy moves its decision into history and starts a new attempt.
 */
export async function saveWork(
  key: WorkKey,
  meta: { studentName: string; unitTitle: string },
  work: {
    status: SubmissionStatus;
    content: SubmissionContent;
    files: FileRef[];
    photo?: FileRef | null;
    feedback?: string;
    decidedBy?: string;
  },
) {
  const col = await collection();
  const now = new Date();
  const existing = await col.findOne(key);
  const reworking = existing?.status === "Rejected" || existing?.status === "MoreDocs";
  if (existing && existing.status !== "Draft" && !reworking) {
    throw new LockedError(existing.status === "Accepted" ? "This part is already marked Satisfactory." : "This part is waiting for the trainer.");
  }

  const history = existing?.history ?? [];
  if (reworking && existing.decidedAt) {
    history.push({
      attempt: existing.attempt,
      status: existing.status as "Rejected" | "MoreDocs",
      feedback: existing.feedback,
      decidedBy: existing.decidedBy ?? "",
      decidedAt: existing.decidedAt,
    });
  }
  const decided = work.status === "Accepted" || work.status === "Rejected" || work.status === "MoreDocs";

  const doc: SubmissionDoc = {
    submissionId: existing?.submissionId ?? randomUUID(),
    ...key,
    studentName: meta.studentName,
    unitTitle: meta.unitTitle,
    status: work.status,
    attempt: reworking ? existing.attempt + 1 : (existing?.attempt ?? 1),
    content: work.content,
    files: work.files,
    photo: work.photo ?? null,
    criteriaMet: [],
    feedback: decided ? (work.feedback ?? "") : "",
    decidedBy: decided ? (work.decidedBy ?? null) : null,
    decidedAt: decided ? now : null,
    submittedAt: work.status === "Draft" ? null : now,
    updatedAt: now,
    history,
  };

  // Guard against a trainer deciding at the same moment
  const res = await col.replaceOne(
    existing ? { ...key, status: existing.status, updatedAt: existing.updatedAt } : key,
    doc,
    { upsert: !existing },
  );
  if (existing && res.matchedCount === 0) throw new LockedError("This part just changed — refresh and try again.");
  const previousFiles = [
    ...(existing?.files ?? []),
    ...(existing?.content.theory?.flatMap((t) => t.files ?? []) ?? []),
    ...(existing?.content.evidence?.flatMap((e) => e.files) ?? []),
  ];
  return { saved: toDTO(doc), previousFiles, previousPhoto: existing?.photo ?? null };
}

// Trainer course/unit view: handed-in quiz / theory / workplace work (no drafts)
export async function listCourseWork(courseCode: string, unitCode?: string) {
  const docs = await (await collection())
    .find({ courseCode, ...(unitCode && { unitCode }), status: { $ne: "Draft" }, part: { $in: ["quiz", "theory", "workplace"] } })
    .sort({ submittedAt: 1 })
    .toArray();
  return docs.map(toDTO);
}

// Waiting-to-mark count per course
export async function countToMarkByCourse() {
  const rows = await (await collection())
    .aggregate<{ _id: string; n: number }>([
      { $match: { status: "Submitted", part: { $in: ["quiz", "theory", "workplace"] } } },
      { $group: { _id: "$courseCode", n: { $sum: 1 } } },
    ])
    .toArray();
  return Object.fromEntries(rows.map((r) => [r._id, r.n])) as Record<string, number>;
}

export async function countForMarking() {
  return (await collection()).countDocuments({ status: "Submitted", part: { $in: ["quiz", "theory", "workplace"] } });
}

// Super Admin corrects when a piece of work was submitted (only work that has been submitted)
export async function setSubmittedAt(submissionId: string, submittedAt: Date) {
  const doc = await (await collection()).findOneAndUpdate(
    { submissionId, submittedAt: { $ne: null } },
    { $set: { submittedAt, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return doc ? toDTO(doc) : null;
}

// Sets (or changes) the status of handed-in work — any part, including the quiz
export async function decide(
  submissionId: string,
  decision: { status: "Accepted" | "Rejected" | "MoreDocs"; feedback: string; criteriaMet: string[]; decidedBy: string },
) {
  const doc = await (await collection()).findOneAndUpdate(
    { submissionId, status: { $ne: "Draft" } },
    { $set: { ...decision, decidedAt: new Date(), updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return doc ? toDTO(doc) : null;
}

// Every file id referenced by a submission (so a file is only served to people allowed to see it)
export async function findSubmissionWithFile(fileId: string) {
  const doc = await (await collection()).findOne({ $or: [{ "files.id": fileId }, { "content.theory.files.id": fileId }, { "content.evidence.files.id": fileId }, { "photo.id": fileId }] });
  return doc ? toDTO(doc) : null;
}
