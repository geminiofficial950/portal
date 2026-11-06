import { describe, expect, it } from "vitest";
import { partsOf } from "@/lib/assessment-meta";
import { findAssessmentFile, getAssessment, listUpcomingDue, saveAssessment } from "@/lib/assessments";
import { getDb } from "@/lib/db";
import { newModule } from "@/lib/module-meta";
import { mergeModules } from "@/lib/module-save";
import { getWork, moduleIdsWithWork, saveWork } from "@/lib/submissions";

const file = (c: string) => ({ id: c.repeat(24), name: `${c}.pdf`, size: 10 });
const C = "CHC33021";

describe("flexible modules in the database", () => {
  it("reads a unit saved the old way (quiz / theory / workplace) as modules, and old work stays attached", async () => {
    // an older assessment record, exactly as the previous version stored it
    await (await getDb()).collection("assessments").insertOne({
      courseCode: C,
      unitCode: "OLD001",
      dueAt: new Date("2027-02-28T00:00:00Z"),
      quiz: { passMark: 80, questions: [{ id: "q1", text: "Pick one", options: ["a", "b"], answer: 0 }] },
      theory: { questions: [], files: [file("a")], uploads: [] },
      rolePlay: { scenario: "", instructions: "", criteria: [] },
      workplace: { task: "", evidence: [], supervisorSignOff: false, files: [], uploads: [] },
      updatedAt: new Date(),
    });
    await saveWork(
      { studentId: "S1", courseCode: C, unitCode: "OLD001", part: "theory" },
      { studentName: "Alex", unitTitle: "Old unit" },
      { status: "Submitted", content: {}, files: [file("b")] },
    );

    const a = await getAssessment(C, "OLD001");
    expect(a.modules.map((m) => [m.id, m.title])).toEqual([
      ["quiz", "Quiz and Activities"],
      ["theory", "Theory Task"],
    ]);
    expect(partsOf(a).map((p) => p.key)).toEqual(["quiz", "theory"]);
    expect((await getWork({ studentId: "S1", courseCode: C, unitCode: "OLD001", part: "theory" }))?.files).toEqual([file("b")]);
    expect(await findAssessmentFile(file("a").id)).toEqual({ courseCode: C, unitCode: "OLD001", moduleId: "theory" });
  });

  it("saves units with different numbers of modules, in admin's order", async () => {
    await saveAssessment(C, "U1", { modules: [{ ...newModule("learning", "m1"), title: "Read" }] });
    await saveAssessment(C, "U2", {
      modules: [
        { ...newModule("task", "t1"), title: "Task", files: [file("c")] },
        { ...newModule("activities", "a1"), title: "Check", activities: [{ id: "x", type: "short", prompt: "Why?" }] },
        { ...newModule("learning", "l1"), title: "Extra reading" },
      ],
    });
    expect((await getAssessment(C, "U1")).modules).toHaveLength(1);
    expect((await getAssessment(C, "U2")).modules.map((m) => m.id)).toEqual(["t1", "a1", "l1"]);
    expect(await findAssessmentFile(file("c").id)).toEqual({ courseCode: C, unitCode: "U2", moduleId: "t1" });
  });

  it("removing a module with student work archives it; the work is still there", async () => {
    await saveWork(
      { studentId: "S2", courseCode: C, unitCode: "U2", part: "t1" },
      { studentName: "Sam", unitTitle: "U2" },
      { status: "Draft", content: {}, files: [] },
    );
    const before = await getAssessment(C, "U2");
    const withWork = await moduleIdsWithWork(C, "U2");
    expect([...withWork]).toEqual(["t1"]);

    // admin removes both "t1" (has work) and "l1" (no work)
    const merged = mergeModules(before.modules, before.modules.filter((m) => m.id === "a1"), withWork);
    await saveAssessment(C, "U2", { modules: merged.modules });
    const after = await getAssessment(C, "U2");
    expect(after.modules.map((m) => [m.id, m.archived])).toEqual([
      ["a1", false],
      ["t1", true],
    ]);
    expect(partsOf(after).map((p) => p.key)).toEqual(["a1"]); // archived: not shown, not marked
    expect(await getWork({ studentId: "S2", courseCode: C, unitCode: "U2", part: "t1" })).not.toBeNull();
  });

  it("lists module deadlines coming up", async () => {
    const now = new Date("2027-02-01T00:00:00Z");
    await saveAssessment(C, "U3", {
      modules: [
        { ...newModule("task", "soon"), title: "Soon", dueAt: "2027-02-05T00:00:00.000Z" },
        { ...newModule("task", "later"), title: "Later", dueAt: "2027-06-01T00:00:00.000Z" },
      ],
    });
    const due = await listUpcomingDue(14, now);
    expect(due.filter((d) => d.unitCode === "U3").map((d) => d.moduleTitle)).toEqual(["Soon"]);
  });
});
