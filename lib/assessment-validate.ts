// Pure validation for the Super Admin assessment editor (unit-tested in tests/assessment-validate.test.ts).
import { LIMITS, TASK_FILES_MAX, type ListItem, type UnitAssessment } from "./assessment-meta";
import type { FileRef } from "./submission-meta";

type Validated = { ok: true; value: UnitAssessment } | { ok: false; error: string };

class Invalid extends Error {}

const str = (v: unknown, max: number = LIMITS.text) => String(v ?? "").trim().slice(0, max);
const id = (v: unknown) => (typeof v === "string" && /^[\w-]{1,64}$/.test(v) ? v : globalThis.crypto.randomUUID());
const list = (items: unknown): ListItem[] =>
  (Array.isArray(items) ? items : [])
    .slice(0, LIMITS.items)
    .map((it: ListItem) => ({ id: id(it?.id), text: str(it?.text) }))
    .filter((it) => it.text); // blank checklist rows are just dropped

const fileRefs = (items: unknown): FileRef[] =>
  (Array.isArray(items) ? items : [])
    .slice(0, TASK_FILES_MAX)
    .map((f: FileRef) => ({ id: String(f?.id ?? ""), name: str(f?.name, 200), size: Math.max(0, Number(f?.size) || 0) }))
    .filter((f) => /^[a-f\d]{24}$/i.test(f.id));

// Rebuild from the client payload so only known, valid fields get stored
function clean(input: UnitAssessment): UnitAssessment {
  const quizIn = Array.isArray(input?.quiz?.questions) ? input.quiz.questions : [];
  const theoryIn = Array.isArray(input?.theory?.questions) ? input.theory.questions : [];
  if (quizIn.length > LIMITS.questions || theoryIn.length > LIMITS.questions) {
    throw new Invalid(`Keep it to ${LIMITS.questions} questions per part.`);
  }

  const passMark = Math.round(Number(input?.quiz?.passMark));
  if (!(passMark >= 1 && passMark <= 100)) throw new Invalid("Quiz pass mark must be between 1 and 100%.");

  const quiz = quizIn.map((q, i) => {
    const n = `Quiz question ${i + 1}`;
    const text = str(q?.text);
    if (!text) throw new Invalid(`${n} is empty.`);
    const options = (Array.isArray(q?.options) ? q.options : []).slice(0, LIMITS.options).map((o) => str(o, 500));
    if (options.length < 2) throw new Invalid(`${n} needs at least 2 options.`);
    const blank = options.findIndex((o) => !o);
    if (blank >= 0) throw new Invalid(`${n}: option ${blank + 1} is empty.`);
    const answer = Number(q?.answer);
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) throw new Invalid(`${n}: pick the correct option.`);
    return { id: id(q?.id), text, options, answer };
  });

  const theory = theoryIn.map((q, i) => {
    const text = str(q?.text);
    if (!text) throw new Invalid(`Theory question ${i + 1} is empty.`);
    const limit = Math.round(Number(q?.wordLimit));
    return { id: id(q?.id), text, guidance: str(q?.guidance), wordLimit: limit > 0 && limit <= 10000 ? limit : null };
  });

  let dueAt: string | null = null;
  if (input?.dueAt) {
    const d = new Date(input.dueAt);
    if (Number.isNaN(d.getTime())) throw new Invalid("Due date isn’t a valid date and time.");
    dueAt = d.toISOString();
  }

  return {
    dueAt,
    quiz: { passMark, questions: quiz },
    theory: { questions: theory, files: fileRefs(input?.theory?.files) },
    rolePlay: {
      scenario: str(input?.rolePlay?.scenario, LIMITS.longText),
      instructions: str(input?.rolePlay?.instructions, LIMITS.longText),
      criteria: list(input?.rolePlay?.criteria),
    },
    workplace: {
      task: str(input?.workplace?.task, LIMITS.longText),
      evidence: list(input?.workplace?.evidence),
      supervisorSignOff: input?.workplace?.supervisorSignOff === true,
      files: fileRefs(input?.workplace?.files),
    },
  };
}

export function validateAssessment(input: UnitAssessment): Validated {
  try {
    return { ok: true, value: clean(input) };
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, error: err.message };
    throw err;
  }
}
