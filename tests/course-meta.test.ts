import { describe, expect, it } from "vitest";
import { checkCode, checkNewCourse, checkUnitList } from "@/lib/course-meta";

describe("checkNewCourse", () => {
  it("accepts a course and fills defaults — no Release field", () => {
    expect(checkNewCourse({ code: " chc33021 ", name: "Certificate III in Individual Support" })).toEqual({
      ok: true,
      value: { code: "CHC33021", name: "Certificate III in Individual Support", category: "Certificate", duration: "To be confirmed", description: "" },
    });
  });

  it("keeps the details typed in, tidied", () => {
    const r = checkNewCourse({ code: "BSB50420", name: " Diploma  of Leadership ", category: "Diploma", duration: "12 months", description: " Lead teams. " });
    expect(r).toEqual({ ok: true, value: { code: "BSB50420", name: "Diploma of Leadership", category: "Diploma", duration: "12 months", description: "Lead teams." } });
  });

  it("rejects a missing code or name", () => {
    expect(checkNewCourse({ code: "", name: "x" }).ok).toBe(false);
    expect(checkNewCourse({ code: "CHC33021", name: "  " })).toEqual({ ok: false, error: "Enter the course name." });
  });
});

describe("checkCode — every course has its own unit codes, in any format", () => {
  it("accepts different code styles", () => {
    for (const c of ["CHCCCS031", "HLTAID011", "BSBWHS211", "ICT-101", "U1", "MOD.2", "33021"]) expect(checkCode(c, "Unit")).toEqual({ code: c });
  });
  it("upper-cases and turns spaces into dashes", () => {
    expect(checkCode(" unit 4.2 ", "Unit")).toEqual({ code: "UNIT-4.2" });
    expect(checkCode("ict-101", "Unit")).toEqual({ code: "ICT-101" });
  });
  it("rejects empty, too long or odd characters", () => {
    expect(checkCode("", "Unit")).toEqual({ error: "Enter the unit code." });
    expect(checkCode("A".repeat(31), "Unit")).toHaveProperty("error");
    expect(checkCode("CHC/031", "Unit")).toHaveProperty("error");
    expect(checkCode("-ABC", "Unit")).toHaveProperty("error");
  });
});


describe("checkUnitList — units chosen while creating a course", () => {
  it("keeps the units in order, codes upper-cased, blank rows skipped", () => {
    expect(checkUnitList([{ code: "chcccs031", title: " Provide  support " }, { code: "", title: "" }, { code: "ICT-101", title: "Networks" }])).toEqual({
      ok: true,
      units: [
        { code: "CHCCCS031", title: "Provide support" },
        { code: "ICT-101", title: "Networks" },
      ],
    });
    expect(checkUnitList(undefined)).toEqual({ ok: true, units: [] }); // units can also be added later
  });
  it("needs a name and a valid code for each, and no duplicates", () => {
    expect(checkUnitList([{ code: "U1", title: "" }])).toEqual({ ok: false, error: "Unit 1 (U1): enter the unit name." });
    expect(checkUnitList([{ code: "U/1", title: "x" }]).ok).toBe(false);
    expect(checkUnitList([{ code: "u1", title: "a" }, { code: "U1", title: "b" }])).toEqual({ ok: false, error: "U1 is listed twice." });
  });
});
