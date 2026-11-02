// Student activity log as a CSV file (opens in Excel). Shared by the per-student and all-students downloads.
import { formatStamp } from "./format";

type Row = { at: string; studentId: string; studentName: string; courseCode: string | null; unitCode: string | null; action: string; detail: string };

// Quotes every cell; a leading = + - @ is prefixed with ' so Excel doesn't run it as a formula
const cell = (v: string) => `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

export function logsToCsv(rows: Row[]) {
  const header = ["Date and time (Sydney)", "Student ID", "Student name", "Course", "Unit", "Activity", "Details"];
  const lines = rows.map((r) =>
    [formatStamp(new Date(r.at)), r.studentId, r.studentName, r.courseCode ?? "", r.unitCode ?? "", r.action, r.detail].map(cell).join(","),
  );
  // BOM so Excel reads it as UTF-8
  return "﻿" + [header.map(cell).join(","), ...lines].join("\r\n") + "\r\n";
}
