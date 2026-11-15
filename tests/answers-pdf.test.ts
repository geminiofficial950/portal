import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildAnswersPdf } from "@/lib/answers-pdf";
import { newModule, type Module } from "@/lib/module-meta";
import type { SubmissionDTO } from "@/lib/submission-meta";

const college = { name: "Stella College", rto: "45280", email: "info@example.com", phone: "03 0000 0000" };

const quiz: Module = {
  ...newModule("activities", "quiz-1"),
  title: "Quiz",
  activities: [
    { id: "q1", type: "mcq", prompt: "Which one is a right of the client?", options: ["Privacy", "None"], answer: 0 },
    { id: "q2", type: "short", prompt: "Explain duty of care.\nGive one example." },
    { id: "q3", type: "matching", prompt: "Match the terms", pairs: [{ left: "NDIS", right: "Disability" }, { left: "WHS", right: "Safety" }] },
    { id: "q4", type: "short", prompt: "Not answered question" },
  ],
};

const sub = (responses: Record<string, unknown>): SubmissionDTO =>
  ({
    submissionId: "S1",
    studentId: "SC2600",
    studentName: "Teststudent",
    courseCode: "CHC33021",
    unitCode: "CHCCCS040",
    unitTitle: "Support independence and wellbeing",
    part: "quiz-1",
    status: "Submitted",
    attempt: 1,
    submittedAt: "2026-11-14T09:28:28.305Z",
    content: { responses },
    files: [],
    history: [],
  }) as unknown as SubmissionDTO;

describe("buildAnswersPdf", () => {
  it("makes a PDF of every question with the student's answer", async () => {
    const bytes = await buildAnswersPdf(sub({ q1: 1, q2: "Keep them safe.\nFor example, report a hazard.", q3: ["Disability", "Wrong"] }), quiz, {
      studentName: "Teststudent",
      courseName: "Certificate III in Individual Support",
      college,
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("Quiz answers - Teststudent - CHCCCS040");
  });

  it("carries a long answer on to more pages", async () => {
    const long = Array.from({ length: 400 }, (_, i) => `Line ${i} of a very long written answer.`).join("\n");
    const bytes = await buildAnswersPdf(sub({ q2: long }), quiz, { studentName: "Teststudent", courseName: "Course", college });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(5);
  });
});
