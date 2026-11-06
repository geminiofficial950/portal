import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { createExtensionRequest, decideExtensionRequest, getModuleDue, listExtensionRequests, setModuleDues } from "@/lib/deadlines";
import { statusLabel } from "@/lib/submission-meta";
import { setStudentBatches } from "@/lib/students";
import { decide, findSubmissionWithFile, getWork, saveWork } from "@/lib/submissions";
import { getUnitRecord, setUnitStatus } from "@/lib/unit-records";

// Guide "End to end acceptance checklist" scenarios that need the database
const C = "CHC33021";
const key = (part: string, studentId = "S1") => ({ studentId, courseCode: C, unitCode: "U1", part });
const meta = { studentName: "Alex", unitTitle: "Unit 1" };
const f = (c: string) => ({ id: c.repeat(24), name: `${c}.pdf`, size: 10 });

describe("acceptance: additional information", () => {
  it("the student's response attaches to the same module and returns it to Pending marking; other modules unchanged", async () => {
    const quiz = (await saveWork(key("m1"), meta, { status: "Submitted", content: {}, files: [] })).saved;
    await decide(quiz.submissionId, { status: "Accepted", feedback: "Good", criteriaMet: [], decidedBy: "Sarah" });
    const task = (await saveWork(key("m2"), meta, { status: "Submitted", content: {}, files: [f("a")] })).saved;
    const asked = (await decide(task.submissionId, { status: "MoreDocs", feedback: "Add your supervisor's sign-off", criteriaMet: [], decidedBy: "Sarah" }))!;
    expect(statusLabel[asked.status]).toBe("Additional information requested");

    const { saved, previousFiles } = await saveWork(key("m2"), meta, { status: "Submitted", content: {}, files: [f("b")] });
    expect(previousFiles).toEqual([]); // the first attempt's file is evidence — never handed back for deletion
    expect(saved.submissionId).toBe(task.submissionId); // same module record, not a new one
    expect(statusLabel[saved.status]).toBe("Pending marking");
    expect(saved.files).toEqual([f("b")]);
    expect(saved.history[0]).toMatchObject({ status: "MoreDocs", feedback: "Add your supervisor's sign-off", files: [f("a")] });
    expect(saved.history[0]).not.toHaveProperty("photo", expect.anything()); // submit photo never in page data
    expect((await findSubmissionWithFile(f("a").id))?.submissionId).toBe(task.submissionId); // still downloadable by staff
    expect((await getWork(key("m1")))?.status).toBe("Accepted");
  });
});

describe("acceptance: transfer to a new batch", () => {
  it("submissions, results, feedback, deadlines and extensions stay with the student", async () => {
    const s = "S2";
    await (await getDb()).collection("students").insertOne({ studentId: s, name: "Sam", batchIds: ["B1"], courses: [{ code: C, status: "Active" }] });
    const work = (await saveWork(key("m3", s), meta, { status: "Submitted", content: {}, files: [f("c")] })).saved;
    await decide(work.submissionId, { status: "Accepted", feedback: "Well done", criteriaMet: [], decidedBy: "Old trainer" });
    await setUnitStatus(s, C, "U1", "Competent", { name: "Admin", role: "admin" });
    await setModuleDues([s], { courseCode: C, unitCode: "U1", moduleId: "m4" }, new Date("2027-05-01T00:00:00Z"), { name: "Old trainer", role: "trainer", reason: "Sick" }, () => null);
    const req = await createExtensionRequest({ studentId: s, studentName: "Sam", courseCode: C, unitCode: "U1", moduleId: "m5", moduleTitle: "T", reason: "Work", proposedDue: new Date("2027-06-01T00:00:00Z") });
    await decideExtensionRequest(req.requestId, { approve: true, newDue: new Date("2027-06-01T00:00:00Z"), reason: "", by: "Old trainer" });

    expect(await setStudentBatches(s, ["B2"])).toBe(true);

    expect(await getWork(key("m3", s))).toMatchObject({ status: "Accepted", feedback: "Well done", files: [f("c")] });
    expect((await getUnitRecord(s, C, "U1")).status).toBe("Competent");
    expect(await getModuleDue(s, C, "U1", "m4")).toBe("2027-05-01T00:00:00.000Z");
    expect((await listExtensionRequests({ studentId: s }))[0]).toMatchObject({ status: "Approved" });
  });
});
