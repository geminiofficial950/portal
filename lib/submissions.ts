import "server-only";
import { randomUUID } from "node:crypto";
import type { ObjectId } from "mongodb";
import type { AssessmentPart } from "./assessment-meta";
import { getDb } from "./db";
import type { Decision, FeedbackResponse, FileRef, MarkingDraft, PastAttempt, SubmissionContent, SubmissionDTO, SubmissionStatus } from "./submission-meta";

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
  // the attempt's submit photo stays in the database only (Super Admin), never in page data
  history: (Omit<PastAttempt, "decidedAt" | "submittedAt"> & { decidedAt: Date; submittedAt?: Date | null; photo?: FileRef | null })[];
  markedFiles?: FileRef[];
  draft?: (Omit<MarkingDraft, "savedAt"> & { savedAt: Date }) | null;
  response?: (Omit<FeedbackResponse, "at" | "replies"> & { at: Date; replies: { by: string; text: string; at: Date }[] }) | null;
};

const responseDTO = (r: SubmissionDoc["response"]): FeedbackResponse | null =>
  r ? { ...r, at: r.at.toISOString(), replies: r.replies.map((x) => ({ ...x, at: x.at.toISOString() })) } : null;

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
  history: d.history.map((h) => ({ ...h, photo: undefined, decidedAt: h.decidedAt.toISOString(), submittedAt: h.submittedAt ? iso(h.submittedAt) : null })),
  markedFiles: d.markedFiles ?? [],
  draft: d.draft ? { ...d.draft, savedAt: d.draft.savedAt.toISOString() } : null,
  response: responseDTO(d.response),
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
    // the earlier attempt keeps its feedback, marked copy and the student's response (previous attempts are preserved)
    history.push({
      attempt: existing.attempt,
      status: existing.status as "Rejected" | "MoreDocs",
      feedback: existing.feedback,
      decidedBy: existing.decidedBy ?? "",
      decidedAt: existing.decidedAt,
      markedFiles: existing.markedFiles ?? [],
      response: existing.response ? responseDTO(existing.response) : null,
      files: existing.files,
      content: existing.content,
      submittedAt: existing.submittedAt,
      photo: existing.photo ?? null,
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
    markedFiles: reworking ? [] : (existing?.markedFiles ?? []),
    draft: null,
    response: null,
  };

  // Guard against a trainer deciding at the same moment
  const res = await col.replaceOne(
    existing ? { ...key, status: existing.status, updatedAt: existing.updatedAt } : key,
    doc,
    { upsert: !existing },
  );
  if (existing && res.matchedCount === 0) throw new LockedError("This part just changed — refresh and try again.");
  // Files the caller may clean up: only the draft's own ones. Anything a past (handed-in) attempt refers to is evidence and stays.
  const inHistory = new Set(
    history.flatMap((h) => [
      ...(h.files ?? []),
      ...(h.content?.theory?.flatMap((t) => t.files ?? []) ?? []),
      ...(h.content?.evidence?.flatMap((e) => e.files) ?? []),
      ...(h.photo ? [h.photo] : []),
    ]).map((f) => f.id),
  );
  const previousFiles = [
    ...(existing?.files ?? []),
    ...(existing?.content.theory?.flatMap((t) => t.files ?? []) ?? []),
    ...(existing?.content.evidence?.flatMap((e) => e.files) ?? []),
  ].filter((f) => !inHistory.has(f.id));
  const previousPhoto = existing?.photo && !inHistory.has(existing.photo.id) ? existing.photo : null;
  return { saved: toDTO(doc), previousFiles, previousPhoto };
}

// Trainer course/unit view: handed-in work in every module (no drafts; never the retired role play)
export async function listCourseWork(courseCode: string, unitCode?: string) {
  const docs = await (await collection())
    .find({ courseCode, ...(unitCode && { unitCode }), status: { $ne: "Draft" }, part: { $ne: "rolePlay" } })
    .sort({ submittedAt: 1 })
    .toArray();
  return docs.map(toDTO);
}

// Trainer marking inbox: all handed-in module work in every course (no drafts)
export async function listAllHandedIn() {
  const docs = await (await collection())
    .find({ status: { $ne: "Draft" }, part: { $ne: "rolePlay" } })
    .sort({ submittedAt: 1 })
    .toArray();
  return docs.map(toDTO);
}

// Trainer dashboard: every piece of work waiting to be marked, oldest first
export async function listAllForMarking() {
  const docs = await (await collection())
    .find({ status: "Submitted", part: { $ne: "rolePlay" } })
    .sort({ submittedAt: 1 })
    .toArray();
  return docs.map(toDTO);
}

// Trainer dashboard: work sent back to the student (Not Yet Satisfactory / Request More Documents) and not handed in again
export async function listAwaitingRework(limit = 6) {
  const docs = await (await collection())
    .find({ status: { $in: ["Rejected", "MoreDocs"] }, part: { $ne: "rolePlay" } })
    .sort({ decidedAt: 1 })
    .limit(limit)
    .toArray();
  return docs.map(toDTO);
}

export async function countDecidedSince(decidedBy: string, since: Date) {
  return (await collection()).countDocuments({ decidedBy, decidedAt: { $gte: since }, part: { $ne: "rolePlay" } });
}

// Waiting-to-mark count per course
export async function countToMarkByCourse() {
  const rows = await (await collection())
    .aggregate<{ _id: string; n: number }>([
      { $match: { status: "Submitted", part: { $ne: "rolePlay" } } },
      { $group: { _id: "$courseCode", n: { $sum: 1 } } },
    ])
    .toArray();
  return Object.fromEntries(rows.map((r) => [r._id, r.n])) as Record<string, number>;
}

export async function countForMarking() {
  return (await collection()).countDocuments({ status: "Submitted", part: { $ne: "rolePlay" } });
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

// Publishes a module status + feedback (any module). The unpublished draft is cleared, and the student is asked
// again to accept or review it (a new feedback version needs a new response).
export async function decide(
  submissionId: string,
  decision: { status: "Accepted" | "Rejected" | "MoreDocs"; feedback: string; criteriaMet: string[]; decidedBy: string },
) {
  const doc = await (await collection()).findOneAndUpdate(
    { submissionId, status: { $ne: "Draft" } },
    { $set: { ...decision, decidedAt: new Date(), updatedAt: new Date(), draft: null, response: null } },
    { returnDocument: "after" },
  );
  return doc ? toDTO(doc) : null;
}

// Saves marking without releasing it to the student ("Save marking"; "Publish feedback" releases it)
export async function saveMarkingDraft(submissionId: string, draft: { status: Decision; feedback: string; savedBy: string }) {
  const doc = await (await collection()).findOneAndUpdate(
    { submissionId, status: { $ne: "Draft" } },
    { $set: { draft: { ...draft, savedAt: new Date() }, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return doc ? toDTO(doc) : null;
}

// Puts marked work back to "Pending marking"
export async function setPendingMarking(submissionId: string) {
  const doc = await (await collection()).findOneAndUpdate(
    { submissionId, status: { $in: ["Accepted", "Rejected", "MoreDocs"] } },
    { $set: { status: "Submitted", feedback: "", decidedBy: null, decidedAt: null, response: null, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return doc ? toDTO(doc) : null;
}

// The trainer's marked copy of the student's work
export async function setMarkedFiles(submissionId: string, files: FileRef[]) {
  const doc = await (await collection()).findOneAndUpdate(
    { submissionId, status: { $ne: "Draft" } },
    { $set: { markedFiles: files, updatedAt: new Date() } },
    { returnDocument: "before" },
  );
  return doc ? { before: doc.markedFiles ?? [], after: toDTO({ ...doc, markedFiles: files }) } : null;
}

export class ResponseError extends Error {}

// The student accepts the published feedback (with a signature) or asks for a review (with a comment).
// Allowed once per published feedback; it never changes the module result.
export async function respondToFeedback(submissionId: string, studentId: string, r: { state: "accepted" | "review"; comment: string; signature: FileRef | null }) {
  const doc = await (await collection()).findOneAndUpdate(
    { submissionId, studentId, status: { $in: ["Accepted", "Rejected", "MoreDocs"] }, response: null },
    { $set: { response: { ...r, at: new Date(), replies: [] } } },
    { returnDocument: "after" },
  );
  if (!doc) throw new ResponseError("You have already responded to this feedback.");
  return toDTO(doc);
}

// The trainer (or admin) replies to a review request; the original feedback and the reply are both kept
export async function replyToReview(submissionId: string, reply: { by: string; text: string }) {
  const doc = await (await collection()).findOneAndUpdate(
    { submissionId, "response.state": "review" },
    { $push: { "response.replies": { ...reply, at: new Date() } } },
    { returnDocument: "after" },
  );
  return doc ? toDTO(doc) : null;
}

// Every file id referenced by a submission (so a file is only served to people allowed to see it)
export async function findSubmissionWithFile(fileId: string) {
  const doc = await (await collection()).findOne({ $or: [{ "files.id": fileId }, { "content.theory.files.id": fileId }, { "content.evidence.files.id": fileId }, { "photo.id": fileId }, { "content.declaration.signature.file.id": fileId }, { "markedFiles.id": fileId }, { "response.signature.id": fileId }, { "history.files.id": fileId }, { "history.content.theory.files.id": fileId }, { "history.content.evidence.files.id": fileId }, { "history.photo.id": fileId }, { "history.markedFiles.id": fileId }, { "history.content.declaration.signature.file.id": fileId }, { "history.response.signature.id": fileId }] });
  return doc ? toDTO(doc) : null;
}

// Module ids of a unit that any student has work in (drafts included) — such a module is archived, never deleted
export async function moduleIdsWithWork(courseCode: string, unitCode: string) {
  return new Set((await (await collection()).distinct("part", { courseCode, unitCode })).map(String));
}

// Feedback reviews: work where the student asked for a review of the published feedback
export async function listReviewRequests() {
  const docs = await (await collection()).find({ "response.state": "review" }).sort({ "response.at": 1 }).toArray();
  return docs.map(toDTO);
}

// Feedback the student accepted and signed, newest first (so the trainer knows it was read and accepted)
export async function listAcceptedFeedback(limit = 200) {
  const docs = await (await collection()).find({ "response.state": "accepted" }).sort({ "response.at": -1 }).limit(limit).toArray();
  return docs.map(toDTO);
}
