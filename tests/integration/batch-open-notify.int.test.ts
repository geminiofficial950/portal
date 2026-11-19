import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => ({ label: "Super Admin", name: "Super Admin", isSuper: true }),
  DELETE_SUPER_ADMIN_ONLY: "Only Super Admin can delete.",
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/student-mail", () => ({ mailUpdates: async () => {} }));

const { getDb } = await import("@/lib/db");
const { openUnitsAction } = await import("@/app/superadmin/batches/actions");
const { listStudentNotifications } = await import("@/lib/student-notifications");

describe("opening units for a batch", () => {
  it("gives each student one portal notification for the units opened now, and none for a schedule", async () => {
    const db = await getDb();
    await db.collection("courses").insertOne({
      code: "C1",
      name: "Course one",
      units: [
        { code: "U1", title: "First unit" },
        { code: "U2", title: "Second unit" },
        { code: "U3", title: "Third unit" },
      ],
      createdAt: new Date(),
    });
    await db.collection("studentGroups").insertOne({ groupId: "B1", name: "Jan C1", nameKey: "jan c1", courseCode: "C1", units: ["U1", "U2", "U3"], trainers: [], classes: [], createdAt: new Date() });
    await db.collection("students").insertMany(
      ["S1", "S2"].map((studentId) => ({ studentId, name: studentId, email: `${studentId}@x.au`, status: "Active", courses: ["C1"], course: "C1", batchIds: ["B1"], createdAt: new Date() })),
    );

    expect(await openUnitsAction("B1", ["U1"], {}, { mode: "now" }, false)).toMatchObject({ ok: true, changed: 2 });
    for (const id of ["S1", "S2"]) {
      expect((await listStudentNotifications(id)).map((n) => [n.kind, n.text])).toEqual([["unlocked", "U1 – First unit was unlocked — you can start it now."]]);
    }

    // two units at once → one notification listing both
    await openUnitsAction("B1", ["U2", "U3"], { studentIds: ["S1"] }, { mode: "now" }, false);
    expect((await listStudentNotifications("S1"))[0].text).toBe("2 units were unlocked — you can start them now: U2, U3.");
    expect(await listStudentNotifications("S2")).toHaveLength(1);

    // a scheduled release doesn't notify yet
    await openUnitsAction("B1", ["U2"], { studentIds: ["S2"] }, { mode: "schedule", releaseAt: new Date(Date.now() + 86_400_000).toISOString() }, false);
    expect(await listStudentNotifications("S2")).toHaveLength(1);
  });
});
