import "server-only";
import ExcelJS from "exceljs";
import { listCourses } from "./courses";
import { listBatches } from "./groups";
import { IMPORT_COLUMNS, IMPORT_MAX_ROWS, checkRows, mapHeaders, parseCsv, readRows, toCsv, type ImportContext } from "./student-import-meta";
import { listStudents } from "./students";

// Bulk student upload, server side: the template file, reading an uploaded sheet, and what the rows are checked against.

/** Courses, batches and the emails / IDs already in use */
export async function importContext(): Promise<ImportContext> {
  const [courses, batches, students] = await Promise.all([listCourses(), listBatches(), listStudents()]);
  return {
    courses: courses.map((c) => c.code),
    batches: batches.map((b) => ({ batchId: b.batchId, name: b.name, code: b.code, courseCode: b.courseCode })),
    takenEmails: new Set(students.map((s) => s.email.toLowerCase())),
    takenIds: new Set(students.map((s) => s.studentId.toUpperCase())),
  };
}

const headerRow = () => IMPORT_COLUMNS.map((c) => (c.required ? `${c.label} *` : c.label));

/** The template to fill in: Excel (with a Help sheet listing course codes and batches) or CSV (headers only) */
export async function buildTemplate(format: "xlsx" | "csv") {
  if (format === "csv") return Buffer.from(toCsv([headerRow()]), "utf8");
  const [courses, batches] = await Promise.all([listCourses(), listBatches()]);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Students");
  ws.addRow(headerRow());
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5B3F99" } };
  ws.columns.forEach((col, i) => {
    col.width = [24, 30, 20, 14, 14, 16, 16, 24][i] ?? 18;
  });
  // dates and IDs stay as typed (no Excel auto-format surprises)
  for (const key of ["startDate", "endDate", "studentId", "password"]) ws.getColumn(IMPORT_COLUMNS.findIndex((c) => c.key === key) + 1).numFmt = "@";
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const help = wb.addWorksheet("Help");
  help.addRow(["Column", "Needed?", "What to write"]).font = { bold: true };
  for (const c of IMPORT_COLUMNS) help.addRow([c.label, c.required ? "Required" : "Optional", c.hint]);
  help.addRow([]);
  help.addRow(["You can add your own columns (e.g. Phone). When you upload, you'll be asked whether to keep them."]);
  help.addRow([]);
  help.addRow(["Course code", "Course name"]).font = { bold: true };
  for (const c of courses) help.addRow([c.code, c.name]);
  help.addRow([]);
  help.addRow(["Batch", "Code", "Course"]).font = { bold: true };
  for (const b of batches) help.addRow([b.name, b.code, b.courseCode ?? ""]);
  if (!batches.length) help.addRow(["(no batches yet)"]);
  help.columns.forEach((col, i) => {
    col.width = [28, 26, 50][i] ?? 18;
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// An Excel cell's value as plain data (dates stay dates; rich text, links and formulas become their text / result)
function cellValue(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return cellValue(v.result as ExcelJS.CellValue);
    if ("error" in v) return "";
  }
  return v;
}

/** Reads an uploaded .xlsx or .csv into checked rows, plus the columns that aren't in the template */
export async function readUpload(name: string, bytes: Buffer) {
  let table: unknown[][];
  if (/\.csv$/i.test(name)) table = parseCsv(bytes.toString("utf8"));
  else if (/\.xlsx$/i.test(name)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as unknown as ArrayBuffer);
    const ws = wb.worksheets.find((w) => w.name.toLowerCase() === "students") ?? wb.worksheets[0];
    if (!ws) return { error: "The file has no sheet." } as const;
    table = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const cells: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cells[col - 1] = cellValue(cell.value);
      });
      table[n - 1] = Array.from(cells, (c) => c ?? "");
    });
    table = Array.from(table, (r) => r ?? []);
  } else return { error: "Upload an Excel (.xlsx) or CSV (.csv) file." } as const;

  const [header = [], ...body] = table;
  const map = mapHeaders(header.map((h) => String(h ?? "")));
  if (map.missing.length) return { error: `These columns are missing: ${map.missing.join(", ")}. Download the template and use its headings.` } as const;
  const rows = readRows(body, map);
  if (!rows.length) return { error: "The file has no students in it." } as const;
  if (rows.length > IMPORT_MAX_ROWS) return { error: `Up to ${IMPORT_MAX_ROWS} students per file — split it into smaller files.` } as const;
  return { rows: checkRows(rows, await importContext()), extra: map.extra.map((x) => x.label) } as const;
}
