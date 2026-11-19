// Bulk student upload: the template's columns, reading a filled-in sheet, and checking each row.
// Shared by the upload route (server) and the Students page (browser); no database access here.
import { checkProfile, cleanState, fullName, splitName } from "./student-profile-meta";

export type ImportColumn = { key: ImportKey; label: string; required: boolean; hint: string };
export type ImportKey = "studentId" | "firstName" | "lastName" | "email" | "phone" | "state" | "notes" | "courses" | "startDate" | "endDate" | "password" | "batch" | "name";

// The template's columns, in order ("name" — an older single Full name column — is still read, but not in the template)
export const IMPORT_COLUMNS: ImportColumn[] = [
  { key: "studentId", label: "Student ID", required: false, hint: "blank = made for you" },
  { key: "firstName", label: "First name", required: true, hint: "e.g. Priya" },
  { key: "lastName", label: "Last name", required: true, hint: "e.g. Sharma" },
  { key: "email", label: "Email", required: true, hint: "used to log in" },
  { key: "phone", label: "Phone number", required: true, hint: "e.g. 0400 123 456" },
  { key: "state", label: "State", required: false, hint: "ACT, NSW, NT, QLD, SA, TAS, VIC or WA" },
  { key: "notes", label: "Notes", required: false, hint: "anything to remember about the student" },
  { key: "courses", label: "Course code", required: true, hint: "e.g. CHC33021 — several? separate with ;" },
  { key: "startDate", label: "Start date", required: true, hint: "DD/MM/YYYY or YYYY-MM-DD" },
  { key: "endDate", label: "End date", required: true, hint: "DD/MM/YYYY or YYYY-MM-DD" },
  { key: "password", label: "Password", required: false, hint: "blank = made for you (8+ characters)" },
  { key: "batch", label: "Batch", required: false, hint: "batch name or code, for the course" },
];

export const IMPORT_MAX_ROWS = 1000;
export const EXTRA_FIELD_MAX = 20; // extra columns kept per student
export const EXTRA_VALUE_MAX = 300;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
// also accept a few common header spellings
const ALIASES: Record<string, ImportKey> = {
  fullname: "name", name: "name", studentname: "name",
  firstname: "firstName", givenname: "firstName",
  lastname: "lastName", surname: "lastName", familyname: "lastName",
  phone: "phone", phonenumber: "phone", mobile: "phone", mobilenumber: "phone", contactnumber: "phone",
  state: "state",
  notes: "notes", note: "notes",
  email: "email", emailaddress: "email",
  coursecode: "courses", course: "courses", courses: "courses", coursecodes: "courses",
  startdate: "startDate", start: "startDate",
  enddate: "endDate", end: "endDate",
  studentid: "studentId", id: "studentId",
  password: "password",
  batch: "batch", batchname: "batch", batchcode: "batch",
};

/** Which column is which: template columns by key, and any other (extra) columns by their header */
export function mapHeaders(headers: string[]) {
  const known: Partial<Record<ImportKey, number>> = {};
  const extra: { index: number; label: string }[] = [];
  headers.forEach((raw, index) => {
    const label = String(raw ?? "").replace(/\s*\*$/, "").trim();
    if (!label) return;
    const key = ALIASES[norm(label)];
    if (key && known[key] === undefined) known[key] = index;
    else extra.push({ index, label: label.replace(/[.$]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || `Column ${index + 1}` }); // "." and "$" can't be field names
  });
  // an older sheet with one "Full name" column instead of First / Last name is fine
  const hasName = known.name !== undefined;
  const missing = IMPORT_COLUMNS.filter((c) => c.required && known[c.key] === undefined && !(hasName && (c.key === "firstName" || c.key === "lastName"))).map((c) => c.label);
  return { known, extra, missing };
}

/** A date cell: a real date, an Excel day number, DD/MM/YYYY (Australian) or YYYY-MM-DD → YYYY-MM-DD */
export function parseDay(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  let y: number, m: number, d: number;
  let hit = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (hit) [y, m, d] = [+hit[1], +hit[2], +hit[3]];
  else if ((hit = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s))) [d, m, y] = [+hit[1], +hit[2], +hit[3]];
  else return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : null;
}

const cellText = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").trim());

export type ImportRow = {
  row: number; // line in the sheet (header = 1)
  name: string; // first + last
  firstName: string;
  lastName: string;
  phone: string;
  state: string;
  notes: string;
  email: string;
  courses: string[];
  startDate: string;
  endDate: string;
  studentId: string;
  password: string;
  batch: string;
  extra: Record<string, string>;
};

export type ImportContext = {
  courses: string[];
  batches: { batchId: string; name: string; code: string; courseCode: string | null }[];
  takenEmails: Set<string>; // lower-case
  takenIds: Set<string>; // upper-case
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Reads the sheet's rows into students, skipping empty lines */
export function readRows(cells: unknown[][], map: ReturnType<typeof mapHeaders>): ImportRow[] {
  const at = (r: unknown[], k: ImportKey) => (map.known[k] === undefined ? "" : r[map.known[k]!]);
  const out: ImportRow[] = [];
  cells.forEach((r, i) => {
    if (!r.some((v) => cellText(v))) return;
    const whole = splitName(cellText(at(r, "name")));
    const firstName = (cellText(at(r, "firstName")) || whole.firstName).replace(/\s+/g, " ");
    const lastName = (cellText(at(r, "lastName")) || whole.lastName).replace(/\s+/g, " ");
    out.push({
      row: i + 2,
      name: fullName({ firstName, lastName }),
      firstName,
      lastName,
      phone: cellText(at(r, "phone")),
      state: cellText(at(r, "state")),
      notes: cellText(at(r, "notes")),
      email: cellText(at(r, "email")).toLowerCase(),
      courses: [...new Set(cellText(at(r, "courses")).split(/[;,]/).map((c) => c.trim().toUpperCase()).filter(Boolean))],
      startDate: parseDay(at(r, "startDate")) ?? cellText(at(r, "startDate")),
      endDate: parseDay(at(r, "endDate")) ?? cellText(at(r, "endDate")),
      studentId: cellText(at(r, "studentId")).toUpperCase(),
      password: cellText(at(r, "password")),
      batch: cellText(at(r, "batch")),
      extra: Object.fromEntries(map.extra.slice(0, EXTRA_FIELD_MAX).map((x) => [x.label, cellText(r[x.index]).slice(0, EXTRA_VALUE_MAX)]).filter(([, v]) => v)),
    });
  });
  return out;
}

/** What's wrong with each row (empty list = ready); also catches the same email / ID twice in the file */
export function checkRows(rows: ImportRow[], ctx: ImportContext) {
  const known = new Set(ctx.courses);
  const seenEmail = new Map<string, number>();
  const seenId = new Map<string, number>();
  return rows.map((r) => {
    const errors: string[] = [];
    if (!r.firstName) errors.push("First name is empty");
    if (!r.lastName) errors.push("Last name is empty");
    // each field on its own, so every problem is listed (not just the first)
    if (!r.phone) errors.push("Phone number is empty");
    else if (!checkProfile({ firstName: "x", lastName: "x", phone: r.phone }).ok) errors.push(`phone “${r.phone}” isn’t a valid number`);
    if (cleanState(r.state) === null) errors.push(`state “${r.state}” isn’t an Australian state (ACT, NSW, NT, QLD, SA, TAS, VIC, WA)`);
    const profile = checkProfile(r);
    if (!EMAIL.test(r.email)) errors.push(r.email ? `“${r.email}” isn’t a valid email` : "Email is empty");
    else if (ctx.takenEmails.has(r.email)) errors.push(`${r.email} is already a student`);
    else if (seenEmail.has(r.email)) errors.push(`same email as row ${seenEmail.get(r.email)}`);
    if (r.email) seenEmail.set(r.email, seenEmail.get(r.email) ?? r.row);
    if (!r.courses.length) errors.push("Course code is empty");
    const unknown = r.courses.filter((c) => !known.has(c));
    if (unknown.length) errors.push(`course ${unknown.join(", ")} doesn’t exist`);
    const start = parseDay(r.startDate), end = parseDay(r.endDate);
    if (!start) errors.push(r.startDate ? `start date “${r.startDate}” isn’t a date` : "Start date is empty");
    if (!end) errors.push(r.endDate ? `end date “${r.endDate}” isn’t a date` : "End date is empty");
    if (start && end && end < start) errors.push("end date is before the start date");
    if (r.studentId) {
      if (r.studentId.length < 2 || r.studentId.length > 20 || !/^[A-Z0-9][A-Z0-9-]*$/.test(r.studentId)) errors.push(`Student ID “${r.studentId}” can only use letters, numbers and dashes (2–20)`);
      else if (ctx.takenIds.has(r.studentId)) errors.push(`Student ID ${r.studentId} is already taken`);
      else if (seenId.has(r.studentId)) errors.push(`same Student ID as row ${seenId.get(r.studentId)}`);
      seenId.set(r.studentId, seenId.get(r.studentId) ?? r.row);
    }
    if (r.password && r.password.length < 8) errors.push("password is shorter than 8 characters");
    let batchId: string | null = null;
    if (r.batch) {
      const b = ctx.batches.find((x) => x.name.toLowerCase() === r.batch.toLowerCase() || (x.code && x.code.toLowerCase() === r.batch.toLowerCase()));
      if (!b) errors.push(`batch “${r.batch}” doesn’t exist`);
      else if (!b.courseCode || !r.courses.includes(b.courseCode)) errors.push(`batch “${r.batch}” is for ${b.courseCode ?? "no course"}, not this student’s course`);
      else batchId = b.batchId;
    }
    return { ...r, ...(profile.ok ? profile.value : {}), startDate: start ?? r.startDate, endDate: end ?? r.endDate, batchId, errors };
  });
}

// ---------- CSV ----------
/** Splits CSV text into rows of cells (quotes, commas and new lines inside quotes handled) */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  const endRow = () => {
    row.push(cell);
    rows.push(row);
    row = [];
    cell = "";
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      endRow();
    } else cell += ch;
  }
  if (cell || row.length) endRow();
  return rows;
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const toCsv = (rows: string[][]) => "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
