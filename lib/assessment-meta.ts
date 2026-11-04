// Shared by server code and client components (no server-only imports here).
import type { FileRef } from "./submission-meta";
// Every unit of a course has one assessment: Quiz and Activities, Theory Task and Workplacement Task.
// (Units used to have a Role play part too; its data is kept but it is no longer shown or counted.)

// A quiz question is multiple choice (options + the correct one) or written (the student types an answer the trainer reads).
// Older questions have no `kind` and are multiple choice.
export type QuizQuestion = { id: string; text: string; kind?: "choice" | "written"; options: string[]; answer: number };
export const isWritten = (q: { kind?: QuizQuestion["kind"] }) => q.kind === "written";
export const QUIZ_WRITTEN_MAX = 4000; // longest written answer, in characters
export type TheoryQuestion = { id: string; text: string; guidance: string; wordLimit: number | null };
export type ListItem = { id: string; text: string };
// An attachment Super Admin asks for on a Theory / Workplacement Task (e.g. "Signed log timesheet").
// When a task has these, the student uploads into each one; with none, they upload freely.
export type UploadSlot = { id: string; label: string };

export type UnitAssessment = {
  dueAt: string | null; // ISO date-time set by Super Admin; null = no deadline
  quiz: { passMark: number; questions: QuizQuestion[] };
  // Theory Task and Workplacement Task: Super Admin uploads the task document(s); students download them,
  // do the work and upload their files. (`questions` / `task` / `evidence` are older typed formats, kept for old data.)
  theory: { questions: TheoryQuestion[]; files: FileRef[]; uploads: UploadSlot[] };
  rolePlay: { scenario: string; instructions: string; criteria: ListItem[] };
  workplace: { task: string; evidence: ListItem[]; supervisorSignOff: boolean; files: FileRef[]; uploads: UploadSlot[] };
};

// What a student is allowed to see: the quiz without its correct answers
export type StudentAssessment = Omit<UnitAssessment, "quiz"> & {
  quiz: { passMark: number; questions: Omit<QuizQuestion, "answer">[] };
};

export const forStudent = (a: UnitAssessment): StudentAssessment => ({
  ...a,
  quiz: { passMark: a.quiz.passMark, questions: a.quiz.questions.map(({ id, text, kind, options }) => ({ id, text, kind, options })) },
});

const ALL_PARTS = [
  { key: "quiz", label: "Quiz and Activities", hint: "Multiple-choice questions; the trainer checks the score and sets the status" },
  { key: "theory", label: "Theory Task", hint: "Upload the task; students upload their work" },
  { key: "rolePlay", label: "Role play", hint: "Retired — kept only for older data" },
  { key: "workplace", label: "Workplacement Task", hint: "Upload the task; students upload their work" },
] as const;
export type AssessmentPart = (typeof ALL_PARTS)[number]["key"];

// The parts students do and staff mark, in order
export const ASSESSMENT_PARTS = ALL_PARTS.filter((p) => p.key !== "rolePlay");

// Parts staff mark — all of them; the quiz score is only a guide, staff set its status
export const MARKED_PARTS = ASSESSMENT_PARTS;

export const LIMITS = { questions: 100, options: 6, items: 30, text: 2000, longText: 6000 } as const;

export const emptyAssessment = (): UnitAssessment => ({
  dueAt: null,
  quiz: { passMark: 80, questions: [] },
  theory: { questions: [], files: [], uploads: [] },
  rolePlay: { scenario: "", instructions: "", criteria: [] },
  workplace: { task: "", evidence: [], supervisorSignOff: false, files: [], uploads: [] },
});

export const isPastDue = (dueAt: string | null, now = Date.now()) => !!dueAt && now > new Date(dueAt).getTime();

// Which parts have content — drives the chips in the units list
export type AssessmentSummary = Record<AssessmentPart, boolean> & { quizCount: number; theoryCount: number; workplaceCount: number };

// Accepts the student view too (it only counts questions)
export const summarise = (a: StudentAssessment): AssessmentSummary => ({
  quiz: a.quiz.questions.length > 0,
  theory: a.theory.files.length > 0,
  rolePlay: false, // retired: never counts as set up
  workplace: a.workplace.files.length > 0,
  quizCount: a.quiz.questions.length,
  theoryCount: a.theory.files.length,
  workplaceCount: a.workplace.files.length,
});

// Most task documents Super Admin can attach to one part
export const TASK_FILES_MAX = 10;

// Most attachments Super Admin can ask for on one task, and the longest name for one
export const UPLOAD_SLOTS_MAX = 10;
export const UPLOAD_SLOT_LABEL_MAX = 120;
