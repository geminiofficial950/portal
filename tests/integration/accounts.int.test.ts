import { describe, expect, it } from "vitest";
import { studentRecords, unitRecords } from "@/lib/affected-records";
import { getDb } from "@/lib/db";
import { createStudent, deleteStudent, setStudentCourseStatus, getStudent, updateStudentStatus, verifyStudentLogin } from "@/lib/students";
import { saveWork, getWork } from "@/lib/submissions";

const C = "CHC33021";

describe("8.2 student statuses", () => {
  it("a course status can be Deferred, and Disabled blocks login for every course", async () => {
    const s = await createStudent({ name: "Dee", email: "dee@test.local", courses: [C, "HLT54121"], password: "password123" });
    await setStudentCourseStatus(s.studentId, C, "Deferred");
    expect((await getStudent(s.studentId))?.courses.find((c) => c.code === C)?.status).toBe("Deferred");
    expect((await verifyStudentLogin(s.studentId, "password123")).ok).toBe(true);
    await updateStudentStatus(s.studentId, "Suspended"); // "Disabled"
    expect(await verifyStudentLogin(s.studentId, "password123")).toEqual({ ok: false, reason: "Suspended" });
  });
});

describe("8.3 deletion shows affected records and never cascades", () => {
  it("counts a student's records, and deleting the student keeps them", async () => {
    const s = await createStudent({ name: "Del", email: "del@test.local", courses: [C], password: "password123" });
    await saveWork({ studentId: s.studentId, courseCode: C, unitCode: "U1", part: "m1" }, { studentName: "Del", unitTitle: "U1" }, { status: "Submitted", content: {}, files: [] });
    await (await getDb()).collection("unitRecords").insertOne({ studentId: s.studentId, courseCode: C, unitCode: "U1", status: "Active" });
    const before = await studentRecords(s.studentId);
    expect(before.find((r) => r.label.startsWith("submissions"))?.count).toBe(1);
    expect(before.find((r) => r.label.startsWith("unit statuses"))?.count).toBe(1);
    expect(await deleteStudent(s.studentId)).toBe(true);
    expect(await getStudent(s.studentId)).toBeNull(); // login + profile gone
    expect(await getWork({ studentId: s.studentId, courseCode: C, unitCode: "U1", part: "m1" })).not.toBeNull(); // evidence kept
  });

  it("counts a unit's student records (a unit with any is refused removal)", async () => {
    const r = await unitRecords(C, "U1");
    expect(r.find((x) => x.label === "student submissions")?.count).toBeGreaterThan(0);
    expect((await unitRecords(C, "EMPTY1")).every((x) => x.count === 0)).toBe(true);
  });
});
