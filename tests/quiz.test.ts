import { describe, expect, it } from "vitest";
import type { QuizQuestion } from "@/lib/assessment-meta";
import { scoreQuiz } from "@/lib/quiz";

const questions: QuizQuestion[] = [
  { id: "q1", text: "2 + 2", options: ["3", "4", "5"], answer: 1 },
  { id: "q2", text: "Capital of Australia", options: ["Sydney", "Canberra"], answer: 1 },
  { id: "q3", text: "Colour of the sky", options: ["Blue", "Green", "Red", "Black"], answer: 0 },
  { id: "q4", text: "Days in a week", options: ["5", "7"], answer: 1 },
];

describe("scoreQuiz", () => {
  it("passes when every answer is right", () => {
    const res = scoreQuiz(questions, [1, 1, 0, 1], 80);
    expect(res).toEqual({
      ok: true,
      score: { correct: 4, total: 4, percent: 100, passed: true, feedback: "You scored 4/4 (100%). Pass mark is 80%." },
      choices: [1, 1, 0, 1],
      written: [],
    });
  });

  it("passes exactly on the pass mark", () => {
    const res = scoreQuiz(questions, [1, 1, 0, 0], 75);
    expect(res.ok && res.score).toMatchObject({ correct: 3, percent: 75, passed: true });
  });

  it("fails just under the pass mark and says what's needed", () => {
    const res = scoreQuiz(questions, [1, 1, 0, 0], 80);
    expect(res.ok && res.score?.passed).toBe(false);
    expect(res.ok && res.score?.feedback).toBe("You scored 3/4 (75%). You need 80% — review the unit and try again.");
  });

  it("rounds the percentage", () => {
    const three = questions.slice(0, 3);
    const res = scoreQuiz(three, [1, 0, 0], 50);
    expect(res.ok && res.score?.percent).toBe(67);
  });

  it("rejects missing answers", () => {
    expect(scoreQuiz(questions, [1, 1, 0], 80)).toEqual({ ok: false, error: "Answer every question before submitting." });
  });

  it("rejects an answer index that isn't one of the options", () => {
    expect(scoreQuiz(questions, [1, 1, 0, 2], 80).ok).toBe(false);
    expect(scoreQuiz(questions, [1, 1, 0, -1], 80).ok).toBe(false);
    expect(scoreQuiz(questions, [1, 1, 0, 1.5], 80).ok).toBe(false);
  });

  it("rejects input that isn't a list of numbers", () => {
    expect(scoreQuiz(questions, "1,1,0,1", 80).ok).toBe(false);
    expect(scoreQuiz(questions, [1, 1, 0, "1"], 80).ok).toBe(false);
    expect(scoreQuiz(questions, null, 80).ok).toBe(false);
  });

  it("refuses a quiz with no questions", () => {
    expect(scoreQuiz([], [], 80)).toEqual({ ok: false, error: "This quiz has no questions yet." });
  });
});

describe("scoreQuiz with written questions", () => {
  const mixed: QuizQuestion[] = [
    questions[0],
    { id: "w1", text: "Explain person-centred care.", kind: "written", options: [], answer: -1 },
    questions[1],
  ];

  it("scores only the multiple-choice questions and keeps the written answers", () => {
    const res = scoreQuiz(mixed, [1, "  It puts the person first.  ", 0], 50);
    expect(res).toMatchObject({
      ok: true,
      score: { correct: 1, total: 2, percent: 50, passed: true },
      choices: [1, -1, 0],
      written: [{ questionId: "w1", text: "It puts the person first." }],
    });
  });

  it("needs text in every written answer", () => {
    expect(scoreQuiz(mixed, [1, "   ", 0], 50).ok).toBe(false);
    expect(scoreQuiz(mixed, [1, 2, 0], 50).ok).toBe(false);
  });

  it("has no score when every question is written", () => {
    const res = scoreQuiz([mixed[1]], ["My answer"], 80);
    expect(res).toEqual({ ok: true, score: null, choices: [-1], written: [{ questionId: "w1", text: "My answer" }] });
  });

  it("limits how long a written answer can be", () => {
    expect(scoreQuiz([mixed[1]], ["x".repeat(4001)], 80)).toEqual({ ok: false, error: "Keep each written answer under 4000 characters." });
  });
});
