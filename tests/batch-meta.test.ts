import { describe, expect, it } from "vitest";
import { canJoinBatch, checkBatchDetails, checkBatchName, checkTrainerAssignments, transferPreview, uncoveredUnits, checkClassSession, formatClassTime, placeInBatch, sortClasses } from "@/lib/batch-meta";

describe("placeInBatch", () => {
  const courseOf = (id: string) => ({ b1: "CHC33021", b2: "CHC33021", b3: "HLT54121", legacy: null })[id];

  it("adds a student to a batch", () => {
    expect(placeInBatch([], courseOf, "CHC33021", "b1")).toEqual(["b1"]);
  });

  it("moving to another batch of the same course replaces the old one", () => {
    expect(placeInBatch(["b1"], courseOf, "CHC33021", "b2")).toEqual(["b2"]);
  });

  // "while reassigning group student old data should not be changed": other courses' batches stay
  it("never touches the student's batches in other courses", () => {
    expect(placeInBatch(["b1", "b3"], courseOf, "CHC33021", "b2")).toEqual(["b3", "b2"]);
    expect(placeInBatch(["b1", "b3", "legacy"], courseOf, "CHC33021", null)).toEqual(["b3", "legacy"]);
  });

  it("is a no-op when already there", () => {
    expect(placeInBatch(["b1"], courseOf, "CHC33021", "b1")).toEqual(["b1"]);
  });
});

describe("canJoinBatch", () => {
  it("needs the batch's course to be one of the student's", () => {
    expect(canJoinBatch(["CHC33021"], "CHC33021")).toBeNull();
    expect(canJoinBatch(["CHC33021"], "HLT54121")).toMatch(/isn’t enrolled in HLT54121/);
    expect(canJoinBatch(["CHC33021"], null)).toMatch(/no course/);
  });
});

describe("checkClassSession", () => {
  it("accepts a day, a 24-hour time and a web link", () => {
    expect(checkClassSession({ day: "Monday", time: "09:30", link: "meet.google.com/abc-defg-hij" })).toEqual({
      ok: true,
      value: { day: "Monday", time: "09:30", link: "https://meet.google.com/abc-defg-hij" },
    });
  });

  it("accepts Zoom and Teams links too", () => {
    expect(checkClassSession({ day: "Friday", time: "18:00", link: "https://us02web.zoom.us/j/123" }).ok).toBe(true);
  });

  it("rejects a bad day, time or link", () => {
    expect(checkClassSession({ day: "Funday", time: "09:30", link: "https://x.com" }).ok).toBe(false);
    expect(checkClassSession({ day: "Monday", time: "25:00", link: "https://x.com" }).ok).toBe(false);
    expect(checkClassSession({ day: "Monday", time: "9:30", link: "https://x.com" }).ok).toBe(false);
    expect(checkClassSession({ day: "Monday", time: "09:30", link: "javascript:alert(1)" }).ok).toBe(false);
    expect(checkClassSession({ day: "Monday", time: "09:30", link: "" }).ok).toBe(false);
  });
});

describe("formatClassTime / sortClasses", () => {
  it("shows 12-hour times", () => {
    expect(formatClassTime("00:05")).toBe("12:05 am");
    expect(formatClassTime("09:30")).toBe("9:30 am");
    expect(formatClassTime("12:00")).toBe("12:00 pm");
    expect(formatClassTime("18:45")).toBe("6:45 pm");
  });

  it("sorts Monday first, then by time", () => {
    const sorted = sortClasses([
      { day: "Wednesday" as const, time: "09:00" },
      { day: "Monday" as const, time: "18:00" },
      { day: "Monday" as const, time: "09:00" },
    ]);
    expect(sorted.map((c) => `${c.day} ${c.time}`)).toEqual(["Monday 09:00", "Monday 18:00", "Wednesday 09:00"]);
  });
});

describe("checkBatchName", () => {
  it("tidies spaces and checks the length", () => {
    expect(checkBatchName("  Batch   A  ")).toEqual({ name: "Batch A" });
    expect(checkBatchName("")).toHaveProperty("error");
    expect(checkBatchName("x".repeat(61))).toHaveProperty("error");
  });
});


describe("checkBatchDetails", () => {
  it("accepts a code, planned dates and a named timezone", () => {
    expect(checkBatchDetails({ code: " is-2027-01 ", startDate: "2027-01-11", endDate: "2028-01-10", timezone: "Australia/Sydney" })).toEqual({
      ok: true,
      value: { code: "IS-2027-01", startDate: "2027-01-11", endDate: "2028-01-10", timezone: "Australia/Sydney" },
    });
  });
  it("defaults the timezone to Melbourne and allows blank dates", () => {
    expect(checkBatchDetails({ timezone: "Mars/Base" })).toEqual({ ok: true, value: { code: "", startDate: null, endDate: null, timezone: "Australia/Melbourne" } });
  });
  it("rejects bad codes, bad dates and an end before the start", () => {
    expect(checkBatchDetails({ code: "IS 2027" }).ok).toBe(false);
    expect(checkBatchDetails({ startDate: "2027-13-40" }).ok).toBe(false);
    expect(checkBatchDetails({ startDate: "2027-02-01", endDate: "2027-01-01" })).toEqual({ ok: false, error: "The planned end date must be after the start date." });
  });
});

describe("checkTrainerAssignments — several trainers, each for specific units", () => {
  const units = ["U1", "U2", "U3"];
  it("keeps known trainers with units of the batch, in course order", () => {
    expect(checkTrainerAssignments([{ trainerId: "T1", unitCodes: ["U3", "U1"] }, { trainerId: "T2", unitCodes: ["U2"] }], units, ["T1", "T2"])).toEqual([
      { trainerId: "T1", unitCodes: ["U1", "U3"] },
      { trainerId: "T2", unitCodes: ["U2"] },
    ]);
  });
  it("drops unknown trainers, foreign units and trainers left with no unit; merges duplicates", () => {
    expect(
      checkTrainerAssignments(
        [{ trainerId: "T9", unitCodes: ["U1"] }, { trainerId: "T1", unitCodes: ["X9"] }, { trainerId: "T2", unitCodes: ["U1"] }, { trainerId: "T2", unitCodes: ["U2"] }],
        units,
        ["T1", "T2"],
      ),
    ).toEqual([{ trainerId: "T2", unitCodes: ["U1", "U2"] }]);
  });
  it("lists units no trainer covers", () => {
    expect(uncoveredUnits({ units, trainers: [{ trainerId: "T1", unitCodes: ["U1"] }] })).toEqual(["U2", "U3"]);
  });
});

describe("transferPreview — shown before a transfer", () => {
  const target = { name: "Catch-up", units: ["U1", "U2", "U3"], trainers: [{ trainerId: "T1", unitCodes: ["U1", "U2"] }] };
  it("lists trainer coverage per unit and units with no trainer", () => {
    const p = transferPreview(target, [], (id) => (id === "T1" ? "Sarah" : id));
    expect(p.to).toBe("Catch-up");
    expect(p.coverage).toEqual([
      { unit: "U1", trainers: ["Sarah"] },
      { unit: "U2", trainers: ["Sarah"] },
      { unit: "U3", trainers: [] },
    ]);
    expect(p.uncovered).toEqual(["U3"]);
  });
  it("flags units the student has work in that the destination doesn't take", () => {
    expect(transferPreview(target, ["U1", "U9", "U9"], (x) => x).notInDestination).toEqual(["U9"]);
  });
});

describe("transferPreview — schedule conflicts with the destination plan", () => {
  const target = { name: "Catch-up", units: ["U1", "U2", "U3"], trainers: [] };
  it("lists units open there but not for the student, and open for the student but not there", () => {
    const p = transferPreview(target, [], (x) => x, { studentOpen: ["U1", "U3"], destinationOpen: ["U1", "U2"] });
    expect(p.openThereNotForStudent).toEqual(["U2"]);
    expect(p.openForStudentNotThere).toEqual(["U3"]);
  });
  it("has no conflicts when both match", () => {
    const p = transferPreview(target, [], (x) => x, { studentOpen: ["U1"], destinationOpen: ["U1"] });
    expect([p.openThereNotForStudent, p.openForStudentNotThere]).toEqual([[], []]);
  });
});
