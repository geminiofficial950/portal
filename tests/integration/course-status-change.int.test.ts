import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => ({ label: "Super Admin", name: "Super Admin", isSuper: true }),
  adminActor: async () => "Super Admin",
  DELETE_SUPER_ADMIN_ONLY: "Only Super Admin can delete.",
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { getDb } = await import("@/lib/db");
const { setCourseStatusAction } = await import("@/app/superadmin/students/actions");
const { getStudent } = await import("@/lib/students");
const { listRecentLogs } = await import("@/lib/student-logs");
const { COURSE_STATUS_LOG, parseStatusChange } = await import("@/lib/course-status");

describe("changing a course status", () => {
  it("needs a reason, refuses a no-change, and records who, when and why", async () => {
    await (await getDb()).collection("students").insertOne({ studentId: "S1", name: "Priya Singh", email: "p@x", status: "Active", courses: ["C1", "C2"], course: "C1", createdAt: new Date() });

    expect(await setCourseStatusAction("S1", "C1", "Deferred", "   ")).toEqual({ ok: false, error: "Write the reason for the change." });
    expect(await setCourseStatusAction("S1", "C1", "Active", "no change")).toEqual({ ok: false, error: "C1 is already Active." });

    const res = await setCourseStatusAction("S1", "C1", "Deferred", "Student requested a temporary study break.");
    expect(res.ok).toBe(true);
    const s = await getStudent("S1");
    expect(s?.courses).toEqual([
      expect.objectContaining({ code: "C1", status: "Deferred" }),
      expect.objectContaining({ code: "C2", status: "Active" }), // the other enrolment is untouched
    ]);
    expect(s?.status).toBe("Active"); // account login unchanged

    const [log] = await listRecentLogs(COURSE_STATUS_LOG);
    expect(log).toMatchObject({ studentName: "Priya Singh", courseCode: "C1" });
    expect(parseStatusChange(log.detail)).toEqual({ change: "Active → Deferred", reason: "Student requested a temporary study break.", by: "Super Admin" });
  });
});
