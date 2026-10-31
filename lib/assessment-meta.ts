// Shared by server code and client components (no server-only imports here).
// Every unit of a course has one assessment made of four parts.

export type QuizQuestion = { id: string; text: string; options: string[]; answer: number };
export type TheoryQuestion = { id: string; text: string; guidance: string; wordLimit: number | null };
export type ListItem = { id: string; text: string };

export type UnitAssessment = {
  dueAt: string | null; // ISO date-time set by Super Admin; null = no deadline
  quiz: { passMark: number; questions: QuizQuestion[] };
  theory: { questions: TheoryQuestion[] };
  rolePlay: { scenario: string; instructions: string; criteria: ListItem[] };
  workplace: { task: string; evidence: ListItem[]; supervisorSignOff: boolean };
};

// What a student is allowed to see: the quiz without its correct answers
export type StudentAssessment = Omit<UnitAssessment, "quiz"> & {
  quiz: { passMark: number; questions: Omit<QuizQuestion, "answer">[] };
};

export const forStudent = (a: UnitAssessment): StudentAssessment => ({
  ...a,
  quiz: { passMark: a.quiz.passMark, questions: a.quiz.questions.map(({ id, text, options }) => ({ id, text, options })) },
});

export const ASSESSMENT_PARTS = [
  { key: "quiz", label: "Online quiz", hint: "Multiple-choice questions, marked automatically" },
  { key: "theory", label: "Theory", hint: "Written answers, marked by the trainer" },
  { key: "rolePlay", label: "Role play", hint: "Scenario + what the trainer observes" },
  { key: "workplace", label: "Workplace task", hint: "Task done at placement + evidence" },
] as const;
export type AssessmentPart = (typeof ASSESSMENT_PARTS)[number]["key"];

// Parts a trainer marks — the quiz is marked automatically
export const MARKED_PARTS = ASSESSMENT_PARTS.filter((p) => p.key !== "quiz");

export const LIMITS = { questions: 100, options: 6, items: 30, text: 2000, longText: 6000 } as const;

export const emptyAssessment = (): UnitAssessment => ({
  dueAt: null,
  quiz: { passMark: 80, questions: [] },
  theory: { questions: [] },
  rolePlay: { scenario: "", instructions: "", criteria: [] },
  workplace: { task: "", evidence: [], supervisorSignOff: true },
});

export const isPastDue = (dueAt: string | null, now = Date.now()) => !!dueAt && now > new Date(dueAt).getTime();

// Which parts have content — drives the chips in the units list
export type AssessmentSummary = Record<AssessmentPart, boolean> & { quizCount: number; theoryCount: number };

// Accepts the student view too (it only counts questions)
export const summarise = (a: StudentAssessment): AssessmentSummary => ({
  quiz: a.quiz.questions.length > 0,
  theory: a.theory.questions.length > 0,
  rolePlay: a.rolePlay.scenario.trim().length > 0,
  workplace: a.workplace.task.trim().length > 0,
  quizCount: a.quiz.questions.length,
  theoryCount: a.theory.questions.length,
});
