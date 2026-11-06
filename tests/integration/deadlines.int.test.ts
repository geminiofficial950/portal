import { describe, expect, it } from "vitest";
import {
  createExtensionRequest,
  decideExtensionRequest,
  DuplicateRequestError,
  getModuleDue,
  listDeadlineLog,
  listExtensionRequests,
  listModuleDues,
  logDefaultDueChange,
  resetModuleDues,
  setModuleDues,
} from "@/lib/deadlines";
import { listStudentNotifications, notifyStudents } from "@/lib/student-notifications";

const C = "CHC33021";
const where = { courseCode: C, unitCode: "U1", moduleId: "m1" };
const req = (studentId: string) => ({ studentId, studentName: studentId, ...where, moduleTitle: "Theory", reason: "Sick", proposedDue: new Date("2027-03-10T00:00:00Z") });

describe("module deadlines and extension requests", () => {
  it("a selected-group change gives only those students their own date, and logs each change", async () => {
    const due = new Date("2027-03-15T00:00:00Z");
    await setModuleDues(["S1", "S2"], where, due, { name: "Sarah · Trainer", role: "trainer", reason: "Excursion" }, () => "2027-02-28T00:00:00.000Z");
    expect(await getModuleDue("S1", C, "U1", "m1")).toBe(due.toISOString());
    expect(await getModuleDue("S3", C, "U1", "m1")).toBeNull(); // not selected: keeps the module's default
    expect(await listModuleDues("S2", C)).toEqual({ "U1/m1": due.toISOString() });
    const log = await listDeadlineLog("S1", C);
    expect(log[0]).toMatchObject({ moduleId: "m1", oldDue: "2027-02-28T00:00:00.000Z", newDue: due.toISOString(), by: "Sarah · Trainer", role: "trainer", reason: "Excursion" });
  });

  it("allows only one pending request per student and module (no duplicates on retry)", async () => {
    await createExtensionRequest(req("S5"));
    await expect(createExtensionRequest(req("S5"))).rejects.toBeInstanceOf(DuplicateRequestError);
    expect(await listExtensionRequests({ studentId: "S5" })).toHaveLength(1);
  });

  it("a decision is recorded once; afterwards a new request is allowed", async () => {
    const [r] = await listExtensionRequests({ studentId: "S5" });
    const first = await decideExtensionRequest(r.requestId, { approve: false, newDue: null, reason: "No evidence", by: "Admin" });
    expect(first).toMatchObject({ status: "Declined", decisionReason: "No evidence" });
    const again = await decideExtensionRequest(r.requestId, { approve: true, newDue: new Date(), reason: "", by: "Admin" });
    expect(again).toBeNull(); // already decided — a second click changes nothing
    await expect(createExtensionRequest(req("S5"))).resolves.toMatchObject({ status: "Pending" });
  });

  it("a default-date change is logged; students' own dates stay unless reset, and a reset is logged per student", async () => {
    const w = { courseCode: C, unitCode: "U7", moduleId: "m7" };
    await setModuleDues(["S7"], w, new Date("2027-04-01T00:00:00Z"), { name: "Sarah", role: "trainer", reason: "Sick" }, () => null);
    await logDefaultDueChange(w, "2027-03-01T00:00:00.000Z", "2027-03-08T00:00:00.000Z", { name: "Super Admin", role: "admin", reason: "Public holiday" });
    expect(await getModuleDue("S7", C, "U7", "m7")).toBe("2027-04-01T00:00:00.000Z"); // exception kept
    const reset = await resetModuleDues(C, "U7", ["m7"], { name: "Super Admin", role: "admin", reason: "Whole class reset" }, () => "2027-03-08T00:00:00.000Z");
    expect(reset).toBe(1);
    expect(await getModuleDue("S7", C, "U7", "m7")).toBeNull(); // back on the default
    expect((await listDeadlineLog("S7", C))[0]).toMatchObject({ oldDue: "2027-04-01T00:00:00.000Z", newDue: "2027-03-08T00:00:00.000Z", by: "Super Admin", role: "admin" });
    expect((await listDeadlineLog("ALL", C))[0]).toMatchObject({ moduleId: "m7", oldDue: "2027-03-01T00:00:00.000Z", newDue: "2027-03-08T00:00:00.000Z", reason: expect.stringContaining("Public holiday") });
  });

  it("students are notified of a decision", async () => {
    await notifyStudents(["S8"], C, "Extension approved for “Theory” (U1) — new due date 10 Mar 2027.");
    expect((await listStudentNotifications("S8"))[0]).toMatchObject({ kind: "class", text: expect.stringContaining("Extension approved") });
  });
});
