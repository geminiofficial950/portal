// Pure quiz marking (unit-tested in tests/quiz.test.ts).
import type { QuizQuestion } from "./assessment-meta";

export type QuizScore = {
  correct: number;
  total: number;
  percent: number;
  passed: boolean;
  feedback: string;
};

export function scoreQuiz(
  questions: QuizQuestion[],
  answers: unknown,
  passMark: number,
): { ok: true; score: QuizScore } | { ok: false; error: string } {
  if (!questions.length) return { ok: false, error: "This quiz has no questions yet." };
  if (
    !Array.isArray(answers) ||
    answers.length !== questions.length ||
    answers.some((a, i) => !Number.isInteger(a) || a < 0 || a >= questions[i].options.length)
  ) {
    return { ok: false, error: "Answer every question before submitting." };
  }

  const correct = questions.filter((q, i) => q.answer === answers[i]).length;
  const total = questions.length;
  const percent = Math.round((correct / total) * 100);
  const passed = percent >= passMark;
  const feedback = passed
    ? `You scored ${correct}/${total} (${percent}%). Pass mark is ${passMark}%.`
    : `You scored ${correct}/${total} (${percent}%). You need ${passMark}% — review the unit and try again.`;
  return { ok: true, score: { correct, total, percent, passed, feedback } };
}
