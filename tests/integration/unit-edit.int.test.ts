import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => ({ label: "Admin", name: "Admin", isSuper: false }),
  requireSuperAdmin: async () => ({ label: "Admin", name: "Admin", isSuper: true }),
  adminActor: async () => "Admin",
  DELETE_SUPER_ADMIN_ONLY: "This account can’t delete.",
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { getDb } = await import("@/lib/db");
const { editUnitAction } = await import("@/app/superadmin/courses/actions");

describe("editing a unit's code or name on a course", () => {
  it("fixes a typo: the code moves the unit's content with it; refused once students have records; duplicates refused", async () => {
    const db = await getDb();
    await db.collection("courses").insertOne({
      code: "CX",
      name: "Course X",
      units: [
        { code: "CHC0O1", title: "Unit no 1" },
        { code: "CHC002", title: "Unit no 2" },
      ],
      createdAt: new Date(),
    });
    await db.collection("assessments").insertOne({ courseCode: "CX", unitCode: "CHC0O1", modules: [] });
    await db.collection("unitContent").insertOne({ courseCode: "CX", unitCode: "CHC0O1", overview: "x", resources: [] });
    await db.collection("classSessions").insertOne({ sessionId: "s1", courseCode: "CX", unitCode: "CHC0O1", title: "Live" });
    await db.collection("studentGroups").insertOne({ groupId: "BX", courseCode: "CX", units: ["CHC0O1", "CHC002"], trainers: [{ trainerId: "T1", unitCodes: ["CHC0O1"] }] });

    // a typo in the code and the name: everything follows the new code
    expect(await editUnitAction("CX", "CHC0O1", { code: "chc001", title: "Unit no 1 — Intro" })).toEqual({ ok: true, unit: { code: "CHC001", title: "Unit no 1 — Intro" } });
    const course = await db.collection("courses").findOne({ code: "CX" });
    expect(course!.units).toEqual([
      { code: "CHC001", title: "Unit no 1 — Intro" },
      { code: "CHC002", title: "Unit no 2" },
    ]);
    expect(await db.collection("assessments").findOne({ courseCode: "CX", unitCode: "CHC001" })).toBeTruthy();
    expect(await db.collection("unitContent").findOne({ courseCode: "CX", unitCode: "CHC001" })).toBeTruthy();
    expect(await db.collection("classSessions").findOne({ sessionId: "s1" })).toMatchObject({ unitCode: "CHC001" });
    expect(await db.collection("studentGroups").findOne({ groupId: "BX" })).toMatchObject({ units: ["CHC001", "CHC002"], trainers: [{ trainerId: "T1", unitCodes: ["CHC001"] }] });

    // a code already in the course
    expect(await editUnitAction("CX", "CHC002", { code: "CHC001", title: "Unit no 2" })).toEqual({ ok: false, error: "CHC001 is already in this course." });

    // once a student has a record, the code stays — the name can still be fixed
    await db.collection("submissions").insertOne({ submissionId: "x", studentId: "S1", courseCode: "CX", unitCode: "CHC002", part: "m1" });
    expect(await editUnitAction("CX", "CHC002", { code: "CHC009", title: "Unit no 2" })).toEqual({
      ok: false,
      error: "Students already have records in CHC002, so its code can’t change. You can still fix the name.",
    });
    expect(await editUnitAction("CX", "CHC002", { code: "CHC002", title: "Unit two" })).toEqual({ ok: true, unit: { code: "CHC002", title: "Unit two" } });
    expect((await db.collection("courses").findOne({ code: "CX" }))!.units[1]).toEqual({ code: "CHC002", title: "Unit two" });

    // an empty name is refused
    expect(await editUnitAction("CX", "CHC002", { code: "CHC002", title: "  " })).toEqual({ ok: false, error: "Enter the unit name." });
  });
});
