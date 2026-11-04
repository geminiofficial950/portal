// Shared by server code and client components (no server-only imports here).
import type { AssessmentPart } from "./assessment-meta";

// Draft → Submitted → a decision: Accepted ("Satisfactory"), Rejected ("Not Yet Satisfactory") or
// MoreDocs ("Request More Documents"). After the last two the student can upload again and resubmit.
// Staff can change the decision later. The quiz skips "Submitted": it is marked the moment the student submits.
export const SUBMISSION_STATUSES = ["Draft", "Submitted", "Accepted", "Rejected", "MoreDocs"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

// What staff can set for Quiz, Theory Task and Workplacement Task, and what everyone sees
export const DECISIONS = ["Accepted", "Rejected", "MoreDocs"] as const;
export type Decision = (typeof DECISIONS)[number];

export const statusLabel: Record<SubmissionStatus | "Not started", string> = {
  "Not started": "Not started",
  Draft: "Draft",
  Submitted: "Submitted",
  Accepted: "Satisfactory",
  Rejected: "Not Yet Satisfactory",
  MoreDocs: "Request More Documents",
};

// The student has to upload again and resubmit
export const needsRework = (s: SubmissionStatus | undefined) => s === "Rejected" || s === "MoreDocs";

export type FileRef = { id: string; name: string; size: number };

export type SubmissionContent = {
  quizAnswers?: number[]; // chosen option index per quiz question (same order as the questions; -1 for a written one)
  quizWritten?: { questionId: string; text: string }[]; // answers typed for written quiz questions
  score?: { correct: number; total: number; percent: number };
  theory?: { questionId: string; html: string; files?: FileRef[] }[]; // files = documents uploaded for that question
  html?: string; // written work for role play / workplace task
  evidence?: { evidenceId: string; files: FileRef[] }[]; // workplace: files uploaded for each evidence item
  supervisor?: string; // workplace supervisor's name
  // The student ticked the declaration when submitting (Theory / Workplacement Task); the text they agreed to is kept with it
  declaration?: { agreedAt: string; intro?: string; points?: string[]; agree?: string };
  // Theory / Workplacement Task with attachments asked for: which uploaded file went into which one
  slots?: { slotId: string; label: string; fileIds: string[] }[];
};

export type PastAttempt = {
  attempt: number;
  status: Decision;
  feedback: string;
  decidedBy: string;
  decidedAt: string;
};

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
};

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
  "Not started": "bg-lilac text-ink/50",
  Draft: "bg-sky-100 text-sky-700",
  Submitted: "bg-amber-100 text-amber-700",
  Accepted: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-rose-100 text-rose-700",
  MoreDocs: "bg-orange-100 text-orange-800",
};
