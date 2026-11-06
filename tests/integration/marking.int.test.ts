import { describe, expect, it } from "vitest";
import { forStudentSub } from "@/lib/submission-meta";
import {
  decide,
  getWork,
  listReviewRequests,
  replyToReview,
  respondToFeedback,
  ResponseError,
  saveMarkingDraft,
  saveWork,
  setMarkedFiles,
  setPendingMarking,
} from "@/lib/submissions";

const C = "CHC33021";
const key = (part: string) => ({ studentId: "S1", courseCode: C, unitCode: "U1", part });
const meta = { studentName: "Alex", unitTitle: "Unit 1" };
const f = (c: string) => ({ id: c.repeat(24), name: `${c}.pdf`, size: 10 });

describe("manual marking, feedback and responses", () => {
  it("an MCQ submission goes to Pending marking with no score or result", async () => {
    const { saved } = await saveWork(key("quiz"), meta, { status: "Submitted", content: { responses: { a1: 0 } }, files: [] });
    expect(saved.status).toBe("Submitted");
    expect(saved.content.score).toBeUndefined();
    expect(saved.feedback).toBe("");
  });

  it("saved marking stays private until published", async () => {
    const sub = (await getWork(key("quiz")))!;
    const drafted = (await saveMarkingDraft(sub.submissionId, { status: "Accepted", feedback: "Good", savedBy: "Sarah" }))!;
    expect(drafted.status).toBe("Submitted"); // still pending for the student
    expect(drafted.draft).toMatchObject({ status: "Accepted", feedback: "Good" });
    expect(forStudentSub(drafted).draft).toBeNull(); // never sent to the student
    const published = (await decide(sub.submissionId, { status: "Accepted", feedback: "Good", criteriaMet: [], decidedBy: "Sarah" }))!;
    expect(published).toMatchObject({ status: "Accepted", feedback: "Good", draft: null });
  });

  it("the student accepts with a signature once; it doesn't change the result", async () => {
    const sub = (await getWork(key("quiz")))!;
    const accepted = await respondToFeedback(sub.submissionId, "S1", { state: "accepted", comment: "", signature: f("s") });
    expect(accepted.status).toBe("Accepted");
    expect(accepted.response).toMatchObject({ state: "accepted", signature: f("s") });
    await expect(respondToFeedback(sub.submissionId, "S1", { state: "review", comment: "again", signature: null })).rejects.toBeInstanceOf(ResponseError);
  });

  it("a review request reaches the trainer, who replies; both are kept", async () => {
    const { saved } = await saveWork(key("theory"), meta, { status: "Submitted", content: {}, files: [f("a")] });
    await decide(saved.submissionId, { status: "Rejected", feedback: "Add an example to Q4", criteriaMet: [], decidedBy: "Sarah" });
    await respondToFeedback(saved.submissionId, "S1", { state: "review", comment: "Which example?", signature: null });
    expect((await listReviewRequests()).map((s) => s.submissionId)).toContain(saved.submissionId);
    const replied = (await replyToReview(saved.submissionId, { by: "Sarah", text: "One from your workplace" }))!;
    expect(replied.feedback).toBe("Add an example to Q4");
    expect(replied.response?.replies.map((r) => r.text)).toEqual(["One from your workplace"]);
  });

  it("resubmitting returns the module to Pending marking and keeps the earlier attempt, feedback and response", async () => {
    const sub = (await getWork(key("theory")))!;
    await setMarkedFiles(sub.submissionId, [f("m")]);
    const { saved } = await saveWork(key("theory"), meta, { status: "Submitted", content: {}, files: [f("b")] });
    expect(saved.status).toBe("Submitted");
    expect(saved.attempt).toBe(2);
    expect(saved.history[0]).toMatchObject({ attempt: 1, status: "Rejected", feedback: "Add an example to Q4", markedFiles: [f("m")] });
    expect(saved.history[0].response?.comment).toBe("Which example?");
    expect(saved.response).toBeNull();
    // the other module's result is untouched
    expect((await getWork(key("quiz")))?.status).toBe("Accepted");
  });

  it("marked work can go back to Pending marking", async () => {
    const sub = (await getWork(key("quiz")))!;
    expect((await setPendingMarking(sub.submissionId))?.status).toBe("Submitted");
  });
});
