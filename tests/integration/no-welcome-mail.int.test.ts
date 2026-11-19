import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

// emails are written to a file instead of sent (no SMTP in tests)
const capture = join(mkdtempSync(join(tmpdir(), "mail-")), "mail.jsonl");
process.env.MAIL_CAPTURE_FILE = capture;
delete process.env.MAIL_ONLY_TO;
delete process.env.SMTP_HOST;

vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => ({ label: "Admin", name: "Admin", isSuper: true }),
  requireSuperAdmin: async () => ({ label: "Admin", name: "Admin", isSuper: true }),
  adminActor: async () => "Admin",
  DELETE_SUPER_ADMIN_ONLY: "x",
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { getDb } = await import("@/lib/db");
const { addStudentCourseAction, createStudentAction, importStudentsAction } = await import("@/app/superadmin/students/actions");

type Sent = { to: string; subject: string; text: string; html: string; replyTo?: string };
const sent = (): Sent[] => (existsSync(capture) ? readFileSync(capture, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const sentTo = () => sent().map((m) => m.to);

describe("a new student gets no welcome email", () => {
  it("Add student and Bulk upload email the staff, never the new student", async () => {
    const db = await getDb();
    await db.collection("courses").insertOne({ code: "C1", name: "Course one", units: [{ code: "U1", title: "Unit" }], createdAt: new Date() });
    await db.collection("admins").insertOne({ adminId: "A001", name: "Ada", email: "ada@college.au", active: true, passwordHash: "x", createdAt: new Date() });
    await db.collection("settings").insertOne({ _id: "portal" as never, switches: { mailCourseUpdates: true, mailStaffCourseUpdates: true } });

    const one = await createStudentAction({ firstName: "Sam", lastName: "Lee", phone: "0400 000 001", email: "sam@x.au", courses: ["C1"], password: "secret123", startDate: "2027-02-01", endDate: "2027-12-20" });
    expect(one.ok).toBe(true);
    const bulk = await importStudentsAction(
      [{ row: 2, name: "Tia Ng", firstName: "Tia", lastName: "Ng", phone: "0400 000 002", state: "", notes: "", email: "tia@x.au", courses: ["C1"], startDate: "2027-02-01", endDate: "2027-12-20", studentId: "", password: "", batch: "", extra: {} }],
      [],
    );
    expect(bulk.ok && bulk.created.length).toBe(1);

    for (let i = 0; i < 40 && sentTo().filter((t) => t === "ada@college.au").length < 2; i++) await new Promise((r) => setTimeout(r, 50));
    const to = sentTo();
    expect(to.filter((t) => t === "ada@college.au")).toHaveLength(2); // the Admin is told both times
    expect(to).not.toContain("sam@x.au");
    expect(to).not.toContain("tia@x.au");
  });

  it("a student given a new course gets the “You have 1 new update” email, with the college's reply address", async () => {
    const db = await getDb();
    await db.collection("courses").insertOne({ code: "C2", name: "Course two", units: [{ code: "U2", title: "Unit" }], createdAt: new Date() });
    await db.collection("settings").updateOne({ _id: "portal" as never }, { $set: { college: { name: "Stella College", rto: "1", email: "admin@college.au", phone: "1800 000 000" } } });
    const sam = (await db.collection("students").findOne({ email: "sam@x.au" }))!;
    expect(await addStudentCourseAction(sam.studentId, "C2", null)).toEqual({ ok: true });
    for (let i = 0; i < 40 && !sent().some((m) => m.to === "sam@x.au"); i++) await new Promise((r) => setTimeout(r, 50));
    const mail = sent().find((m) => m.to === "sam@x.au")!;
    expect(mail).toMatchObject({ subject: "You have 1 new update on Stella College", replyTo: "admin@college.au" });
    expect(mail.text).toContain("You have 1 new update on the platform.");
    expect(mail.html).toContain(">Log in</a>");
  });
});
