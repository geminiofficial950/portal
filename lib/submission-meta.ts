// Shared by server code and client components (no server-only imports here).
import type { AssessmentPart } from "./assessment-meta";

// Draft → Submitted → Accepted / Rejected. Rejected work can be edited and submitted again.
// The quiz skips "Submitted": it is marked the moment the student submits.
export const SUBMISSION_STATUSES = ["Draft", "Submitted", "Accepted", "Rejected"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export type FileRef = { id: string; name: string; size: number };

export type SubmissionContent = {
  quizAnswers?: number[]; // chosen option index per quiz question (same order as the questions)
  score?: { correct: number; total: number; percent: number };
  theory?: { questionId: string; html: string; files?: FileRef[] }[]; // files = documents uploaded for that question
  html?: string; // written work for role play / workplace task
  evidence?: { evidenceId: string; files: FileRef[] }[]; // workplace: files uploaded for each evidence item
  supervisor?: string; // workplace supervisor's name
};

export type PastAttempt = {
  attempt: number;
  status: "Accepted" | "Rejected";
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
  maxFiles: 5,
  accept: ".doc,.docx,.pdf,.jpg,.jpeg,.png",
  label: "Word, PDF, JPG or PNG · up to 10 MB each",
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
};
