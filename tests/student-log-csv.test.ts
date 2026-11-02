import { describe, expect, it } from "vitest";
import { logsToCsv } from "@/lib/student-log-csv";

const row = {
  at: "2026-11-02T05:28:26.000Z",
  studentId: "232111",
  studentName: "Mohd Shahzil",
  courseCode: "CHC33021",
  unitCode: "CHCCCS031",
  action: "Submitted",
  detail: "Theory Task · answers.pdf",
};

describe("logsToCsv", () => {
  it("starts with a BOM and a header row, then one row per entry in Sydney time", () => {
    const csv = logsToCsv([row]);
    expect(csv.startsWith("﻿")).toBe(true);
    const [header, line] = csv.slice(1).trim().split("\r\n");
    expect(header).toBe('"Date and time (Sydney)","Student ID","Student name","Course","Unit","Activity","Details"');
    expect(line).toBe('"02-Nov-2026 16:28:26","232111","Mohd Shahzil","CHC33021","CHCCCS031","Submitted","Theory Task · answers.pdf"');
  });

  it("escapes quotes and blanks out missing course/unit", () => {
    const line = logsToCsv([{ ...row, courseCode: null, unitCode: null, action: "Raised ticket", detail: 'Asked "why"' }]).trim().split("\r\n")[1];
    expect(line).toContain('"","","Raised ticket","Asked ""why"""');
  });

  it("stops Excel from running text as a formula", () => {
    const line = logsToCsv([{ ...row, detail: "=HYPERLINK(1)" }]).trim().split("\r\n")[1];
    expect(line.endsWith(`"'=HYPERLINK(1)"`)).toBe(true);
  });
});
