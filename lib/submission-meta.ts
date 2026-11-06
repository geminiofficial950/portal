// Shared by server code and client components (no server-only imports here).
import type { AssessmentPart } from "./assessment-meta";
import type { Responses } from "./module-meta";

// Module statuses, exactly as the LMS guide names them (stored values on the left):
//   (none) / Draft → "Active"   Submitted → "Pending marking"   Accepted → "Satisfactory"
//   Rejected → "Not satisfactory"   MoreDocs → "Additional information requested"
// A draft is only a save indicator ("Draft saved"), not a status. Nothing is marked automatically:
// submitting always gives "Pending marking", and only staff set a result. After the last two the student resubmits.
export const SUBMISSION_STATUSES = ["Draft", "Submitted", "Accepted", "Rejected", "MoreDocs"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

// What staff can set for Quiz, Theory Task and Workplacement Task, and what everyone sees
export const DECISIONS = ["Accepted", "Rejected", "MoreDocs"] as const;
export type Decision = (typeof DECISIONS)[number];

export const statusLabel: Record<SubmissionStatus | "Not started", string> = {
  "Not started": "Active",
  Draft: "Active",
  Submitted: "Pending marking",
  Accepted: "Satisfactory",
  Rejected: "Not satisfactory",
  MoreDocs: "Additional information requested",
};

// The five module statuses in order, for pickers and legends
export const MODULE_STATUSES = ["Active", "Pending marking", "Satisfactory", "Not satisfactory", "Additional information requested"] as const;

// The student has to upload again and resubmit
export const needsRework = (s: SubmissionStatus | undefined) => s === "Rejected" || s === "MoreDocs";

export type FileRef = { id: string; name: string; size: number };

export type SubmissionContent = {
  responses?: Responses; // answers to the module's online activities, by activity id (never scored)
  quizAnswers?: number[]; // chosen option index per quiz question (same order as the questions; -1 for a written one)
  quizWritten?: { questionId: string; text: string }[]; // answers typed for written quiz questions
  score?: { correct: number; total: number; percent: number }; // older quiz submissions only — no longer shown
  theory?: { questionId: string; html: string; files?: FileRef[] }[]; // files = documents uploaded for that question
  html?: string; // written work for role play / workplace task
  evidence?: { evidenceId: string; files: FileRef[] }[]; // workplace: files uploaded for each evidence item
  supervisor?: string; // workplace supervisor's name
  // The student ticked the declaration when submitting (Theory / Workplacement Task); the text they agreed to is kept with it
  // `signature`: drawn with the mouse or uploaded as a picture (newer submissions)
  declaration?: { agreedAt: string; intro?: string; points?: string[]; agree?: string; signature?: { file: FileRef; method: "drawn" | "uploaded" } };
  // Theory / Workplacement Task with attachments asked for: which uploaded file went into which one
  slots?: { slotId: string; label: string; fileIds: string[] }[];
};

// The student's answer to published feedback: accept it with a signature, or ask for a review with a comment.
// It never changes the module result. The trainer can reply to a review request.
export type FeedbackResponse = {
  state: "accepted" | "review";
  comment: string;
  signature: FileRef | null;
  at: string;
  replies: { by: string; text: string; at: string }[];
};

export type PastAttempt = {
  attempt: number;
  status: Decision;
  feedback: string;
  decidedBy: string;
  decidedAt: string;
  markedFiles?: FileRef[];
  response?: FeedbackResponse | null;
  // what the student handed in for that attempt (kept on resubmission — evidence is never dropped)
  files?: FileRef[];
  content?: SubmissionContent;
  submittedAt?: string | null;
};

// Marking saved but not yet published to the student (staff only)
export type MarkingDraft = { status: Decision; feedback: string; savedBy: string; savedAt: string };

export type SubmissionDTO = {
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
  photo: FileRef | null; // photo taken when the student submitted (Super Admin only)
  criteriaMet: string[]; // role-play criterion ids the trainer ticked
  feedback: string;
  decidedBy: string | null;
  decidedAt: string | null;
  submittedAt: string | null;
  updatedAt: string;
  history: PastAttempt[];
  markedFiles: FileRef[]; // marked copy the trainer attached (published with the feedback)
  draft: MarkingDraft | null; // staff only — removed before work is sent to the student
  response: FeedbackResponse | null; // the student's response to the current published feedback
};

/** What a student may see of their own work: never the unpublished marking draft */
export const forStudentSub = (s: SubmissionDTO): SubmissionDTO => ({ ...s, draft: null });

export const FILE_RULES = {
  maxBytes: 10 * 1024 * 1024,
  maxFiles: 10,
  maxPerSlot: 5, // files for one attachment Super Admin asked for
  accept: ".doc,.docx,.ppt,.pptx,.pdf,.jpg,.jpeg,.png",
  label: "Word, PowerPoint, PDF, JPG or PNG · up to 10 MB each",
} as const;

export const formatBytes = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

// Words in a chunk of editor HTML
export const countWords = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

export const statusStyle: Record<SubmissionStatus | "Not started", string> = {
  "Not started": "bg-lilac text-ink",
  Draft: "bg-lilac text-ink",
  Submitted: "bg-amber-100 text-amber-700",
  Accepted: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-rose-100 text-rose-700",
  MoreDocs: "bg-orange-100 text-orange-800",
};
