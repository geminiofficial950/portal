// Placement documents and documents requested from a student. Shared by server code and client components.
import type { FileRef } from "./submission-meta";

// Review of a student's upload (LMS guide; labels per the recommended starting point): a new upload is "Submitted";
// staff mark it "Approved" or "Changes requested" (with a comment — the student then uploads again).
export const DOC_REVIEW_STATUSES = ["Submitted", "Approved", "Changes requested"] as const;
export type DocReviewStatus = (typeof DOC_REVIEW_STATUSES)[number];
export type DocReview = { status: DocReviewStatus; comment: string; by: string | null; at: string | null };
export const submittedReview = (): DocReview => ({ status: "Submitted", comment: "", by: null, at: null });
export const docReviewStyle: Record<DocReviewStatus, string> = {
  Submitted: "bg-amber-100 text-amber-900",
  Approved: "bg-emerald-100 text-emerald-800",
  "Changes requested": "bg-rose-100 text-rose-800",
};
export function checkDocReview(status: unknown, comment: unknown): { ok: true; status: DocReviewStatus; comment: string } | { ok: false; error: string } {
  if (status !== "Approved" && status !== "Changes requested") return { ok: false, error: "Choose Approved or Changes requested." };
  const c = String(comment ?? "").trim().slice(0, DOC_NOTE_MAX);
  if (status === "Changes requested" && !c) return { ok: false, error: "Say what needs to change — the student will see it." };
  return { ok: true, status, comment: c };
}

// A document for a course. "course": a course document students download. "placement": a placement-pack form
// students download, complete and upload back (matched upload slot).
export type CourseDocSection = "course" | "placement";
export type PlacementDocDTO = { docId: string; courseCode: string; title: string; file: FileRef; createdAt: string; section: CourseDocSection; instructions: string };

// A student's signed copies of a placement document. A student can upload more than one file (e.g. one per page);
// an upload is never replaced — each new one is added to the list.
export type SignedUpload = { file: FileRef; uploadedAt: string };
export type SignedDocDTO = { docId: string; studentId: string; uploads: SignedUpload[]; review: DocReview };

export const SIGNED_UPLOADS_MAX = 10;

// Older records hold one `file` + `uploadedAt`; newer ones a list. Both read as a list, oldest first.
export function signedUploads(doc: { file?: FileRef | null; uploadedAt?: string | Date | null; uploads?: { file: FileRef; uploadedAt: string | Date }[] | null }): SignedUpload[] {
  const iso = (d: string | Date) => (typeof d === "string" ? d : d.toISOString());
  const list = (doc.uploads ?? []).map((u) => ({ file: u.file, uploadedAt: iso(u.uploadedAt) }));
  const legacy = doc.file && doc.uploadedAt && !list.some((u) => u.file.id === doc.file!.id) ? [{ file: doc.file, uploadedAt: iso(doc.uploadedAt) }] : [];
  return [...legacy, ...list].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
}

// A document Super Admin asked one student for (e.g. "Police check")
export type DocumentRequestDTO = {
  requestId: string;
  studentId: string;
  name: string;
  note: string;
  file: FileRef | null;
  uploadedAt: string | null;
  createdAt: string;
  dueAt: string | null; // when the college needs it by
  review: DocReview | null; // null until something is uploaded
};

// The placement documents every course uses, in the order students see them.
// Super Admin picks one of these (or "Other" with its own name) when uploading.
export const PLACEMENT_DOC_TYPES = [
  "Workplace Agreement",
  "Log Timesheet",
  "Pre-Placement Checklist",
  "Understanding Workplacement Booklet",
] as const;

// Standard types first (in list order), then any others by when they were added
export const placementOrder = (title: string) => {
  const i = PLACEMENT_DOC_TYPES.indexOf(title as (typeof PLACEMENT_DOC_TYPES)[number]);
  return i < 0 ? PLACEMENT_DOC_TYPES.length : i;
};
export const sortPlacementDocs = <T extends { title: string; createdAt: string }>(docs: T[]) =>
  [...docs].sort((a, b) => placementOrder(a.title) - placementOrder(b.title) || a.createdAt.localeCompare(b.createdAt));

export const DOC_TITLE_MAX = 80;
export const DOC_NOTE_MAX = 300;
export const PLACEMENT_TEXT_MAX = 4000;

export const cleanLine = (raw: unknown, max: number) => String(raw ?? "").trim().replace(/\s+/g, " ").slice(0, max);
