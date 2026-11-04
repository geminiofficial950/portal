// Pure quiz marking (unit-tested in tests/quiz.test.ts).
import { isWritten, QUIZ_WRITTEN_MAX, type QuizQuestion } from "./assessment-meta";

export type QuizScore = {
  correct: number;
  total: number;
  percent: number;
  passed: boolean;
  feedback: string;
};

/**
 * Checks a student's quiz answers: an option index for each multiple-choice question, typed text for each written one.
 * Only multiple-choice questions are scored (`score` is null when there are none); written answers go to the trainer.
 */
export function scoreQuiz(
  questions: QuizQuestion[],
  answers: unknown,
  passMark: number,
):
  | { ok: true; score: QuizScore | null; choices: number[]; written: { questionId: string; text: string }[] }
  | { ok: false; error: string } {
  if (!questions.length) return { ok: false, error: "This quiz has no questions yet." };
  const answered = (a: unknown, q: QuizQuestion) =>
    isWritten(q)
      ? typeof a === "string" && a.trim().length > 0
      : Number.isInteger(a) && (a as number) >= 0 && (a as number) < q.options.length;
  if (!Array.isArray(answers) || answers.length !== questions.length || answers.some((a, i) => !answered(a, questions[i]))) {
    return { ok: false, error: "Answer every question before submitting." };
  }
  if (questions.some((q, i) => isWritten(q) && (answers[i] as string).length > QUIZ_WRITTEN_MAX)) {
    return { ok: false, error: `Keep each written answer under ${QUIZ_WRITTEN_MAX} characters.` };
  }

  const choices = questions.map((q, i) => (isWritten(q) ? -1 : (answers[i] as number)));
  const written = questions.flatMap((q, i) => (isWritten(q) ? [{ questionId: q.id, text: (answers[i] as string).trim() }] : []));

  const scored = questions.filter((q) => !isWritten(q));
  if (!scored.length) return { ok: true, score: null, choices, written };
  const correct = questions.filter((q, i) => !isWritten(q) && q.answer === choices[i]).length;
  const total = scored.length;
  const percent = Math.round((correct / total) * 100);
  const passed = percent >= passMark;
  const feedback = passed
    ? `You scored ${correct}/${total} (${percent}%). Pass mark is ${passMark}%.`
    : `You scored ${correct}/${total} (${percent}%). You need ${passMark}% — review the unit and try again.`;
  return { ok: true, score: { correct, total, percent, passed, feedback }, choices, written };
}
