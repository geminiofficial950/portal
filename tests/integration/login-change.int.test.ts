import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => ({ label: "Super Admin", name: "Super Admin", isSuper: true }),
  requireSuperAdmin: async () => ({ label: "Super Admin", name: "Super Admin", isSuper: true }),
  adminActor: async () => "Super Admin",
  DELETE_SUPER_ADMIN_ONLY: "Only Super Admin can delete.",
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { getDb } = await import("@/lib/db");
const { changeStudentLoginAction } = await import("@/app/superadmin/students/actions");
const { changeTrainerLoginAction } = await import("@/app/superadmin/trainers/actions");
const { verifyStudentLogin } = await import("@/lib/students");

describe("Super Admin changes a login email / ID", () => {
  it("a new student ID carries all their records; the old ID has nothing left; login works with the new details", async () => {
    const db = await getDb();
    const { hash } = await import("bcryptjs");
    await db.collection("students").insertMany([
      { studentId: "S100", name: "Priya", email: "priya@x.au", status: "Active", courses: ["C1"], course: "C1", batchIds: [], passwordHash: await hash("secret123", 4), createdAt: new Date() },
      { studentId: "S200", name: "Other", email: "other@x.au", status: "Active", courses: ["C1"], course: "C1", batchIds: [], passwordHash: "x", createdAt: new Date() },
    ]);
    await db.collection("trainers").insertOne({ trainerId: "T001", name: "Sarah", email: "sarah@x.au", active: true, passwordHash: "x", createdAt: new Date() });
    await db.collection("submissions").insertOne({ submissionId: "sub1", studentId: "S100", part: "m1" });
    await db.collection("unitRecords").insertOne({ studentId: "S100", courseCode: "C1", unitCode: "U1", status: "Active" });
    await db.collection("documentRequests").insertOne({ requestId: "r1", studentId: "S100", name: "Police check" });
    await db.collection("studentLogs").insertOne({ studentId: "S100", action: "Logged in", at: new Date() });
    await db.collection("studentNotifications").insertOne({ studentId: "S100", text: "hi", at: new Date() });
    await db.collection("uploads.files").insertOne({ filename: "a.pdf", metadata: { ownerId: "S100", contentType: "application/pdf" } });

    // refused: someone else's ID / email, a trainer's ID, an Admin-style ID, a bad email
    expect(await changeStudentLoginAction("S100", { email: "priya@x.au", studentId: "S200" })).toEqual({ ok: false, error: "That ID is already used by someone else." });
    expect(await changeStudentLoginAction("S100", { email: "other@x.au", studentId: "S100" })).toEqual({ ok: false, error: "That email is already used by someone else." });
    expect(await changeStudentLoginAction("S100", { email: "sarah@x.au", studentId: "S100" })).toEqual({ ok: false, error: "That email is already used by someone else." });
    expect((await changeStudentLoginAction("S100", { email: "priya@x.au", studentId: "A001" })).ok).toBe(false);
    expect(await changeStudentLoginAction("S100", { email: "not-an-email", studentId: "S100" })).toEqual({ ok: false, error: "Enter a valid email address." });

    const res = await changeStudentLoginAction("S100", { email: "Priya.New@X.au", studentId: "stu-001" });
    expect(res).toMatchObject({ ok: true, student: { studentId: "STU-001", email: "priya.new@x.au" } });
    expect(res.ok && res.moved).toBe(6);
    for (const col of ["submissions", "unitRecords", "documentRequests", "studentNotifications"]) {
      expect(await db.collection(col).countDocuments({ studentId: "S100" })).toBe(0);
      expect(await db.collection(col).countDocuments({ studentId: "STU-001" })).toBe(1);
    }
    expect(await db.collection("uploads.files").countDocuments({ "metadata.ownerId": "STU-001" })).toBe(1);
    expect(await db.collection("studentLogs").findOne({ studentId: "STU-001", action: "Login details changed" })).toMatchObject({ detail: expect.stringContaining("ID S100 → STU-001") });
    expect((await verifyStudentLogin("STU-001", "secret123")).ok).toBe(true);
    expect((await verifyStudentLogin("priya.new@x.au", "secret123")).ok).toBe(true); // password unchanged
    expect((await verifyStudentLogin("S100", "secret123")).ok).toBe(false);
  });

  it("a new trainer ID moves their batch assignments and class sessions", async () => {
    const db = await getDb();
    await db.collection("studentGroups").insertOne({ groupId: "B1", name: "Jan", courseCode: "C1", units: ["U1", "U2"], trainers: [{ trainerId: "T001", unitCodes: ["U1"] }, { trainerId: "T002", unitCodes: ["U2"] }] });
    await db.collection("classSessions").insertOne({ sessionId: "s1", batchId: "B1", trainerId: "T001" });

    expect((await changeTrainerLoginAction("T001", { email: "sarah@x.au", trainerId: "STU-001" })).ok).toBe(false); // a student's ID
    const res = await changeTrainerLoginAction("T001", { email: "sarah.w@x.au", trainerId: "TR-SARAH" });
    expect(res).toMatchObject({ ok: true, trainer: { trainerId: "TR-SARAH", email: "sarah.w@x.au" } });
    const batch = await db.collection("studentGroups").findOne({ groupId: "B1" });
    expect(batch?.trainers).toEqual([{ trainerId: "TR-SARAH", unitCodes: ["U1"] }, { trainerId: "T002", unitCodes: ["U2"] }]);
    expect(await db.collection("classSessions").findOne({ sessionId: "s1" })).toMatchObject({ trainerId: "TR-SARAH" });
  });
});
