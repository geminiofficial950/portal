// Creating a course and adding its units (Super Admin and Admins). Shared by server code and client components.

export const COURSE_LIMITS = { name: 160, category: 80, duration: 60, description: 3000 } as const;

export type NewCourse = { code: string; name: string; category: string; duration: string; description: string };

const line = (v: unknown, max: number) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

// Codes are not tied to one national pattern: each course has its own units with their own codes
// (e.g. CHC33021, BSB50420, HLTAID011, ICT-101, UNIT 4.2 → "UNIT-4.2"). Letters, numbers, dashes and dots;
// it must start with a letter or number. Upper-cased so "chcccs031" and "CHCCCS031" are the same unit.
export const CODE_MAX = 30;
export function checkCode(raw: unknown, what: "Course" | "Unit"): { code: string } | { error: string } {
  const code = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "-");
  if (!code) return { error: `Enter the ${what.toLowerCase()} code.` };
  if (code.length > CODE_MAX) return { error: `${what} code can be at most ${CODE_MAX} characters.` };
  if (!/^[A-Z0-9][A-Z0-9.-]*$/.test(code)) return { error: `${what} code can only use letters, numbers, dashes and dots.` };
  return { code };
}

export function checkNewCourse(input: Partial<NewCourse>): { ok: true; value: NewCourse } | { ok: false; error: string } {
  const code = checkCode(input?.code, "Course");
  if ("error" in code) return { ok: false, error: code.error };
  const name = line(input?.name, COURSE_LIMITS.name);
  if (!name) return { ok: false, error: "Enter the course name." };
  return {
    ok: true,
    value: {
      code: code.code,
      name,
      category: line(input?.category, COURSE_LIMITS.category) || "Certificate",
      duration: line(input?.duration, COURSE_LIMITS.duration) || "To be confirmed",
      description: String(input?.description ?? "").trim().slice(0, COURSE_LIMITS.description),
    },
  };
}

export const UNIT_TITLE_MAX = 200;
export const COURSE_UNITS_MAX = 60;

/**
 * The units chosen while creating a course (LMS guide: "Create a course with … selected units"). Blank rows are
 * skipped; every unit needs a code (any format) and a name; a code can't appear twice in the same course.
 */
export function checkUnitList(raw: unknown): { ok: true; units: { code: string; title: string }[] } | { ok: false; error: string } {
  const rows = (Array.isArray(raw) ? raw : []).filter((u) => String(u?.code ?? "").trim() || String(u?.title ?? "").trim());
  if (rows.length > COURSE_UNITS_MAX) return { ok: false, error: `A course can have up to ${COURSE_UNITS_MAX} units here — add more later.` };
  const units: { code: string; title: string }[] = [];
  for (const [i, u] of rows.entries()) {
    const code = checkCode(u?.code, "Unit");
    if ("error" in code) return { ok: false, error: `Unit ${i + 1}: ${code.error}` };
    const title = line(u?.title, UNIT_TITLE_MAX);
    if (!title) return { ok: false, error: `Unit ${i + 1} (${code.code}): enter the unit name.` };
    if (units.some((x) => x.code === code.code)) return { ok: false, error: `${code.code} is listed twice.` };
    units.push({ code: code.code, title });
  }
  return { ok: true, units };
}
