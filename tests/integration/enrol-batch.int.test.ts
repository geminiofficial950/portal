import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => ({ label: "Super Admin", name: "Super Admin", isSuper: true }),
  requireSuperAdmin: async () => ({ label: "Super Admin", name: "Super Admin", isSuper: true }),
  adminActor: async () => "Super Admin",
  DELETE_SUPER_ADMIN_ONLY: "Only Super Admin can delete.",
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { getDb } = await import("@/lib/db");
const { createStudentAction } = await import("@/app/superadmin/students/actions");
const { getStudent } = await import("@/lib/students");

describe("choosing a batch while enrolling a new student", () => {
  it("puts the student in the chosen batch; refuses a batch of another course or two for one course", async () => {
    const db = await getDb();
    await db.collection("courses").insertMany([
      { code: "C1", name: "Course one", units: [{ code: "U1", title: "Unit" }], createdAt: new Date() },
      { code: "C2", name: "Course two", units: [{ code: "U2", title: "Unit" }], createdAt: new Date() },
    ]);
    await db.collection("studentGroups").insertMany([
      { groupId: "B1", name: "Jan C1", nameKey: "jan c1", courseCode: "C1", units: [], trainers: [], createdAt: new Date() },
      { groupId: "B2", name: "Feb C1", nameKey: "feb c1", courseCode: "C1", units: [], trainers: [], createdAt: new Date() },
      { groupId: "B3", name: "Jan C2", nameKey: "jan c2", courseCode: "C2", units: [], trainers: [], createdAt: new Date() },
    ]);
    const base = { firstName: "Riya", lastName: "Kaur", phone: "0400 000 000", email: "riya@x.au", password: "secret123", startDate: "2027-02-01", endDate: "2027-12-20" };

    expect(await createStudentAction({ ...base, courses: ["C1"], batchIds: ["B3"] })).toEqual({ ok: false, error: "Each batch must belong to one of the student’s courses." });
    expect(await createStudentAction({ ...base, courses: ["C1"], batchIds: ["B1", "B2"] })).toEqual({ ok: false, error: "Pick at most one batch per course." });
    expect(await createStudentAction({ ...base, courses: ["C1"], batchIds: ["NOPE"] })).toEqual({ ok: false, error: "A chosen batch no longer exists." });
    // start and end date are required, end not before start
    expect(await createStudentAction({ ...base, courses: ["C1"], startDate: "" })).toEqual({ ok: false, error: "Enter the student’s start date." });
    expect(await createStudentAction({ ...base, courses: ["C1"], endDate: "" })).toEqual({ ok: false, error: "Enter the student’s end date." });
    expect(await createStudentAction({ ...base, courses: ["C1"], endDate: "2027-01-01" })).toEqual({ ok: false, error: "The end date must be after the start date." });

    const res = await createStudentAction({ ...base, courses: ["C1", "C2"], studentId: "RIYA-01", batchIds: ["B1", "B3"] });
    expect(res).toMatchObject({ ok: true, student: { studentId: "RIYA-01", batchIds: ["B1", "B3"] } });
    expect((await getStudent("RIYA-01"))?.batchIds).toEqual(["B1", "B3"]);
    expect(await getStudent("RIYA-01")).toMatchObject({ startDate: "2027-02-01", endDate: "2027-12-20" });
    expect(await db.collection("studentLogs").countDocuments({ studentId: "RIYA-01", action: "Batch changed" })).toBe(2);

    // no batch chosen is still fine
    const plain = await createStudentAction({ ...base, email: "sam@x.au", courses: ["C1"] });
    expect(plain.ok && plain.student.batchIds).toEqual([]);
  });
});
