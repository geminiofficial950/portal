import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { getUnitRecord, isUnitOpenFor, listUnitRecords, listUnitRecordsFor, setUnitOpening, setUnitStatus } from "@/lib/unit-records";
import { saveWork, getWork } from "@/lib/submissions";

const C = "CHC33021";
const admin = { name: "Super Admin", role: "admin" as const };
const trainer = { name: "Sarah · Trainer", role: "trainer" as const };

describe("unit records", () => {
  it("an untouched unit is Active but not open", async () => {
    expect(await getUnitRecord("S1", C, "U1")).toMatchObject({ status: "Active", opened: false, releaseAt: null });
    expect(await isUnitOpenFor("S1", C, "U1")).toBe(false);
  });

  it("admin opens it; a non-active status hides it again; admin reactivation restores it with work intact", async () => {
    await saveWork({ studentId: "S1", courseCode: C, unitCode: "U1", part: "m1" }, { studentName: "A", unitTitle: "U1" }, { status: "Submitted", content: {}, files: [] });
    await setUnitOpening(["S1"], C, "U1", { open: true }, "Super Admin");
    expect(await isUnitOpenFor("S1", C, "U1")).toBe(true);

    await setUnitStatus("S1", C, "U1", "Deferred", trainer, "Student asked to pause");
    expect(await isUnitOpenFor("S1", C, "U1")).toBe(false);
    expect(await getUnitRecord("S1", C, "U1")).toMatchObject({ status: "Deferred", opened: true, feedback: "Student asked to pause" });

    await setUnitStatus("S1", C, "U1", "Active", admin);
    expect(await isUnitOpenFor("S1", C, "U1")).toBe(true);
    expect((await getWork({ studentId: "S1", courseCode: C, unitCode: "U1", part: "m1" }))?.status).toBe("Submitted");
  });

  it("a scheduled release opens the unit at its time", async () => {
    await setUnitOpening(["S2"], C, "U2", { open: false, releaseAt: new Date("2027-03-01T00:00:00Z") }, "Super Admin");
    expect(await isUnitOpenFor("S2", C, "U2", Date.parse("2027-02-28T00:00:00Z"))).toBe(false);
    expect(await isUnitOpenFor("S2", C, "U2", Date.parse("2027-03-01T00:00:01Z"))).toBe(true);
  });

  it("reads older final results as a unit status", async () => {
    await (await getDb()).collection("unitResults").insertMany([
      { studentId: "S3", courseCode: C, unitCode: "P1", result: "Pass", feedback: "Well done", decidedBy: "T", decidedAt: new Date(), history: [] },
      { studentId: "S3", courseCode: C, unitCode: "F1", result: "Fail", feedback: "Redo", decidedBy: "T", decidedAt: new Date(), history: [] },
      { studentId: "S3", courseCode: C, unitCode: "W1", result: "Withdrawn", feedback: "", decidedBy: "T", decidedAt: new Date(), history: [] },
    ]);
    const recs = await listUnitRecords("S3", C);
    expect([recs.P1.status, recs.F1.status, recs.W1.status]).toEqual(["Competent", "Not Yet Competent", "Withdrawn"]);
    expect(recs.P1.feedback).toBe("Well done");
    // a newer status replaces the older result
    await setUnitStatus("S3", C, "F1", "Active", admin);
    expect((await getUnitRecord("S3", C, "F1")).status).toBe("Active");
  });

  it("lists one unit's records for many students (for bulk previews)", async () => {
    await setUnitOpening(["S4", "S5"], C, "U9", { open: true }, "Super Admin");
    await setUnitStatus("S5", C, "U9", "Withdrawn", admin);
    const recs = await listUnitRecordsFor(["S4", "S5", "S6"], C, "U9");
    expect([recs.S4.status, recs.S5.status, recs.S6.status]).toEqual(["Active", "Withdrawn", "Active"]);
    expect([recs.S4.opened, recs.S6.opened]).toEqual([true, false]);
  });
});
