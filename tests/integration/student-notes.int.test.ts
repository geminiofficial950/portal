import { describe, expect, it, vi } from "vitest";

// who is signed in for each call
let staff: { role: "admin" | "trainer"; id: string; name: string } = { role: "admin", id: "A1", name: "Ada" };
vi.mock("@/lib/auth", () => ({ requireStaff: async () => staff }));

const { getDb } = await import("@/lib/db");
const { addStudentNoteAction } = await import("@/app/actions/student-notes");
const { listStudentNotes } = await import("@/lib/student-notes");

describe("staff notes on a student", () => {
  it("Admin notes reach only the picked trainers; trainer notes reach Admins, not other trainers", async () => {
    const db = await getDb();
    await db.collection("courses").insertOne({ code: "C1", name: "Course", units: [{ code: "U1", title: "Unit" }], createdAt: new Date() });
    await db.collection("trainers").insertMany([
      { trainerId: "T1", name: "Tia", email: "t1@x.au", active: true, passwordHash: "x", createdAt: new Date() },
      { trainerId: "T2", name: "Tom", email: "t2@x.au", active: true, passwordHash: "x", createdAt: new Date() },
      { trainerId: "T3", name: "Tess", email: "t3@x.au", active: true, passwordHash: "x", createdAt: new Date() },
    ]);
    await db.collection("studentGroups").insertOne({
      groupId: "B1",
      name: "Jan",
      nameKey: "jan",
      courseCode: "C1",
      units: ["U1"],
      trainers: [
        { trainerId: "T1", unitCodes: ["U1"] },
        { trainerId: "T2", unitCodes: ["U1"] },
      ],
      createdAt: new Date(),
    });
    await db.collection("students").insertOne({ studentId: "S1", name: "Sam", email: "s@x.au", courses: ["C1"], course: "C1", status: "Active", progress: 0, batchIds: ["B1"], passwordHash: "x", createdAt: new Date() });

    // Admin must pick a trainer of the student; T3 isn't one
    staff = { role: "admin", id: "A1", name: "Ada" };
    expect(await addStudentNoteAction("S1", "  ", ["T1"])).toEqual({ ok: false, error: "Write the note first." });
    expect(await addStudentNoteAction("S1", "Needs help", [])).toEqual({ ok: false, error: "Choose at least one trainer to see the note." });
    expect(await addStudentNoteAction("S1", "Needs help", ["T3"])).toEqual({ ok: false, error: "A chosen trainer isn’t one of this student’s trainers." });
    const a = await addStudentNoteAction("S1", "Needs help with U1", ["T1"]);
    expect(a).toMatchObject({ ok: true, note: { byRole: "admin", byName: "Ada", forNames: ["Admins", "Tia"] } });

    // Trainer T2 writes one; T3 (not in the batch) can't
    staff = { role: "trainer", id: "T2", name: "Tom" };
    expect(await addStudentNoteAction("S1", "Missed class")).toMatchObject({ ok: true, note: { byRole: "trainer", forNames: ["Admins"] } });
    staff = { role: "trainer", id: "T3", name: "Tess" };
    expect(await addStudentNoteAction("S1", "Hi")).toEqual({ ok: false, error: "This student isn’t in your batches." });

    const texts = async (viewer: { role: "admin" | "trainer"; id: string }) => (await listStudentNotes("S1", viewer)).map((n) => n.text).sort();
    expect(await texts({ role: "admin", id: "A9" })).toEqual(["Missed class", "Needs help with U1"]);
    expect(await texts({ role: "trainer", id: "T1" })).toEqual(["Needs help with U1"]);
    expect(await texts({ role: "trainer", id: "T2" })).toEqual(["Missed class"]);
    expect(await texts({ role: "trainer", id: "T3" })).toEqual([]);
  });
});
