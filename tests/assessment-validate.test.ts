import { describe, expect, it } from "vitest";
import { emptyAssessment, type UnitAssessment } from "@/lib/assessment-meta";
import { validateAssessment } from "@/lib/assessment-validate";

const base = (): UnitAssessment => ({
  ...emptyAssessment(),
  quiz: { passMark: 80, questions: [{ id: "q1", text: "Q?", options: ["a", "b"], answer: 1 }] },
  theory: { questions: [{ id: "t1", text: "Explain.", guidance: "", wordLimit: 200 }], files: [] },
  rolePlay: { scenario: "Upset client", instructions: "Calm them", criteria: [{ id: "c1", text: "Stays calm" }] },
  workplace: { task: "Two shifts", evidence: [{ id: "e1", text: "Log" }], supervisorSignOff: true, files: [] },
});

const error = (a: UnitAssessment) => {
  const res = validateAssessment(a);
  return res.ok ? null : res.error;
};

describe("validateAssessment", () => {
  it("accepts a complete assessment unchanged", () => {
    const res = validateAssessment(base());
    expect(res.ok).toBe(true);
    expect(res.ok && res.value.quiz.questions[0]).toEqual({ id: "q1", text: "Q?", options: ["a", "b"], answer: 1 });
  });

  it("accepts an empty assessment (nothing set up yet)", () => {
    expect(validateAssessment(emptyAssessment()).ok).toBe(true);
  });

  it("trims text and drops blank checklist rows", () => {
    const a = base();
    a.quiz.questions[0].text = "  Q?  ";
    a.rolePlay.criteria = [{ id: "c1", text: " Calm " }, { id: "c2", text: "   " }];
    const res = validateAssessment(a);
    expect(res.ok && res.value.quiz.questions[0].text).toBe("Q?");
    expect(res.ok && res.value.rolePlay.criteria).toEqual([{ id: "c1", text: "Calm" }]);
  });

  it("names the quiz question and option that's wrong", () => {
    const a = base();
    a.quiz.questions[0].options = ["a", " "];
    expect(error(a)).toBe("Quiz question 1: option 2 is empty.");
    a.quiz.questions[0].options = ["only one"];
    a.quiz.questions[0].answer = 0;
    expect(error(a)).toBe("Quiz question 1 needs at least 2 options.");
  });

  it("needs a valid correct answer", () => {
    const a = base();
    a.quiz.questions[0].answer = 5;
    expect(error(a)).toBe("Quiz question 1: pick the correct option.");
  });

  it("rejects empty questions", () => {
    const a = base();
    a.quiz.questions[0].text = "";
    expect(error(a)).toBe("Quiz question 1 is empty.");
    const b = base();
    b.theory.questions[0].text = " ";
    expect(error(b)).toBe("Theory question 1 is empty.");
  });

  it("keeps the pass mark between 1 and 100", () => {
    for (const bad of [0, 101, Number.NaN]) {
      const a = base();
      a.quiz.passMark = bad;
      expect(error(a)).toBe("Quiz pass mark must be between 1 and 100%.");
    }
  });

  it("turns a nonsense word limit into no limit", () => {
    const a = base();
    a.theory.questions[0].wordLimit = -5;
    const res = validateAssessment(a);
    expect(res.ok && res.value.theory.questions[0].wordLimit).toBeNull();
  });

  it("stores the due date as an ISO instant and rejects bad dates", () => {
    const a = base();
    a.dueAt = "2026-11-05T17:00:00+11:00";
    const res = validateAssessment(a);
    expect(res.ok && res.value.dueAt).toBe("2026-11-05T06:00:00.000Z");
    a.dueAt = "not a date";
    expect(error(a)).toBe("Due date isn’t a valid date and time.");
  });

  it("replaces unsafe ids with fresh ones", () => {
    const a = base();
    a.quiz.questions[0].id = "<script>";
    const res = validateAssessment(a);
    expect(res.ok && res.value.quiz.questions[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("ignores extra fields sent by a tampered client", () => {
    const a = { ...base(), hacked: true } as unknown as UnitAssessment;
    const res = validateAssessment(a);
    expect(res.ok && Object.keys(res.value).sort()).toEqual(["dueAt", "quiz", "rolePlay", "theory", "workplace"]);
  });
});

describe("task documents (Theory Task / Workplacement Task)", () => {
  it("keeps valid file references and drops junk", () => {
    const a = base();
    a.theory.files = [
      { id: "6ae591d80e5ad0fc166bedee", name: "Theory task.pdf", size: 1200 },
      { id: "not-an-id", name: "x.pdf", size: 1 },
    ];
    const res = validateAssessment(a);
    expect(res.ok && res.value.theory.files).toEqual([{ id: "6ae591d80e5ad0fc166bedee", name: "Theory task.pdf", size: 1200 }]);
  });
});
