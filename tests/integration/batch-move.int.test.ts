import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => ({ label: "Super Admin", name: "Super Admin", isSuper: true }),
  DELETE_SUPER_ADMIN_ONLY: "Only Super Admin can delete.",
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { getDb } = await import("@/lib/db");
const { moveStudentAction } = await import("@/app/superadmin/batches/actions");
const { getStudent } = await import("@/lib/students");

describe("batch membership with older data", () => {
  it("a student in a batch of a course they aren't enrolled in can be taken out; putting them in gives a clear message", async () => {
    const db = await getDb();
    await db.collection("studentGroups").insertOne({ groupId: "g1", name: "Batch A", nameKey: "batch a", courseCode: "C2", timezone: "Australia/Melbourne", units: [], trainers: [], classes: [], createdAt: new Date() });
    await db.collection("students").insertOne({ studentId: "123", name: "Teststudent", email: "t@x", status: "Active", courses: ["C1"], course: "C1", groupId: "g1", createdAt: new Date() });

    const out = await moveStudentAction("123", "C2", null);
    expect(out).toMatchObject({ ok: true, batchIds: [] });
    expect((await getStudent("123"))?.batchIds).toEqual([]);

    const into = await moveStudentAction("123", "C2", "g1");
    expect(into).toEqual({ ok: false, error: "Teststudent isn’t enrolled in C2. Add the course on their profile first, then put them in the batch." });
  });
});
