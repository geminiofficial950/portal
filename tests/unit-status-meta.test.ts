import { describe, expect, it } from "vitest";
import { canSetUnitStatus, checkUnitStatusChange, planBulkOpen, trainerCanAccess, UNIT_STATUSES, unitAccess, type UnitRecord } from "@/lib/unit-status-meta";

const NOW = Date.parse("2027-02-18T00:00:00Z");
const rec = (r: Partial<UnitRecord>): UnitRecord => ({ status: "Active", opened: false, releaseAt: null, ...r });

describe("unit statuses", () => {
  it("are exactly the guide's list (no On hold)", () => {
    expect(UNIT_STATUSES).toEqual(["Active", "Inactive", "Withdrawn", "Cancelled", "Deferred", "Competent", "Not Yet Competent"]);
  });
});

describe("unitAccess — the highest content access rule", () => {
  it("an assigned unit is Active but stays closed until admin opens it", () => {
    expect(unitAccess(null, NOW)).toMatchObject({ open: false, reason: "Not open yet" });
    expect(unitAccess(rec({ opened: true }), NOW).open).toBe(true);
  });

  it("every non-active status hides the unit, even if it was opened", () => {
    for (const status of UNIT_STATUSES.filter((s) => s !== "Active")) {
      const a = unitAccess(rec({ status, opened: true, releaseAt: "2020-01-01T00:00:00Z" }), NOW);
      expect(a.open, status).toBe(false);
      expect(a.reason).toBe(`Unit status: ${status}`);
      expect(a.next).toBeTruthy(); // a lock always explains what happens next
    }
  });

  it("a scheduled release opens by itself when its time comes", () => {
    expect(unitAccess(rec({ releaseAt: "2027-03-01T00:00:00Z" }), NOW)).toMatchObject({ open: false });
    expect(unitAccess(rec({ releaseAt: "2027-03-01T00:00:00Z" }), NOW).reason).toMatch(/^Opens .*1 Mar 2027/);
    expect(unitAccess(rec({ releaseAt: "2027-02-01T00:00:00Z" }), NOW).open).toBe(true);
  });
});

describe("canSetUnitStatus", () => {
  it("a trainer can record a non-active status", () => {
    expect(canSetUnitStatus("trainer", "Active", "Competent")).toBeNull();
    expect(canSetUnitStatus("trainer", "Active", "Withdrawn")).toBeNull();
  });
  it("a trainer can't bring a non-active unit back to Active; admin can", () => {
    expect(canSetUnitStatus("trainer", "Competent", "Active")).toBe("Only admin can reactivate a unit.");
    expect(canSetUnitStatus("admin", "Competent", "Active")).toBeNull();
  });
  it("rejects unknown statuses (no On hold)", () => {
    expect(canSetUnitStatus("admin", "Active", "On hold" as never)).toBe("Unknown unit status.");
  });
});

describe("planBulkOpen — preview before a bulk change", () => {
  const students = [
    { studentId: "S1", record: null },
    { studentId: "S2", record: rec({ status: "Deferred" }) },
    { studentId: "S3", record: rec({ opened: true }) },
  ];
  it("keeps explicit exceptions by default", () => {
    expect(planBulkOpen(students)).toEqual({ affected: ["S1", "S3"], skipped: [{ studentId: "S2", reason: "Unit is Deferred for this student" }] });
  });
  it("includes them only when admin chooses to reset exceptions", () => {
    expect(planBulkOpen(students, true).affected).toEqual(["S1", "S2", "S3"]);
  });
});

describe("trainerCanAccess — current batch AND assigned unit", () => {
  const batches = [
    { batchId: "B1", units: ["U1", "U2"], trainers: [{ trainerId: "T1", unitCodes: ["U1"] }, { trainerId: "T2", unitCodes: ["U2"] }] },
    { batchId: "B2", units: ["U1"], trainers: [{ trainerId: "T3", unitCodes: ["U1"] }] },
  ];
  it("two trainers in one batch each see only their own unit", () => {
    expect(trainerCanAccess("T1", ["B1"], "U1", batches)).toBe(true);
    expect(trainerCanAccess("T1", ["B1"], "U2", batches)).toBe(false);
    expect(trainerCanAccess("T2", ["B1"], "U2", batches)).toBe(true);
  });
  it("after a transfer the old trainer loses access and the new one gains it", () => {
    expect(trainerCanAccess("T1", ["B2"], "U1", batches)).toBe(false);
    expect(trainerCanAccess("T3", ["B2"], "U1", batches)).toBe(true);
  });
});


describe("checkUnitStatusChange", () => {
  const parts = [
    { key: "m1", label: "Quiz" },
    { key: "m2", label: "Theory" },
  ];
  it("Competent needs every marked module Satisfactory", () => {
    expect(checkUnitStatusChange("Competent", "", parts, { m1: "Accepted", m2: "Submitted" })).toBe("Not every module is Satisfactory yet: Theory.");
    expect(checkUnitStatusChange("Competent", "", parts, { m1: "Accepted", m2: "Accepted" })).toBeNull();
    expect(checkUnitStatusChange("Competent", "", [], {})).toMatch(/no marked modules/);
  });
  it("Not Yet Competent needs feedback; other statuses don't", () => {
    expect(checkUnitStatusChange("Not Yet Competent", " ", parts, {})).toMatch(/feedback/);
    expect(checkUnitStatusChange("Deferred", "", parts, {})).toBeNull();
  });
});
