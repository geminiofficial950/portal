// Batches: first a course is made, then batches of it. Each batch has one trainer and many students,
// and a Classroom section (day, time and link of each class) that its students see read-only.
// A student is in at most one batch per course. Moving a student to another batch never touches their work:
// submissions, results and unlocks belong to the student and course, not to the batch.
// Shared by server code and client components (no server-only imports here).
import { cleanUrl } from "./unit-meta";

export const BATCH_NAME_MAX = 60;
export const CLASSES_MAX = 7;

export const CLASS_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type ClassDay = (typeof CLASS_DAYS)[number];

export type ClassSession = { id: string; day: ClassDay; time: string; link: string }; // time "HH:MM", Melbourne

export type TrainerAssignment = { trainerId: string; unitCodes: string[] };

export type BatchDTO = {
  batchId: string;
  name: string;
  code: string; // e.g. IS-2027-01
  courseCode: string | null; // null only for groups made before batches belonged to a course
  startDate: string | null; // planned dates, YYYY-MM-DD
  endDate: string | null;
  timezone: string; // named timezone for class times (daylight saving handled by name)
  units: string[]; // units assigned to this batch, in course order
  trainers: TrainerAssignment[]; // several trainers, each for specific units
  classes: ClassSession[];
  students: number;
};

export const TIMEZONES = [
  "Australia/Melbourne",
  "Australia/Sydney",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Hobart",
  "Australia/Perth",
  "Australia/Darwin",
] as const;
export const DEFAULT_TZ = "Australia/Melbourne";

export const BATCH_CODE_MAX = 30;

/** Batch code, planned dates and timezone from the admin form */
export function checkBatchDetails(input: { code?: unknown; startDate?: unknown; endDate?: unknown; timezone?: unknown }):
  | { ok: true; value: { code: string; startDate: string | null; endDate: string | null; timezone: string } }
  | { ok: false; error: string } {
  const code = String(input?.code ?? "").trim().toUpperCase().slice(0, BATCH_CODE_MAX);
  if (code && !/^[A-Z0-9][A-Z0-9-]*$/.test(code)) return { ok: false, error: "Batch code can use letters, numbers and dashes (e.g. IS-2027-01)." };
  const day = (v: unknown, label: string) => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) throw new Error(`${label} isn’t a valid date.`);
    return s;
  };
  try {
    const startDate = day(input?.startDate, "Planned start date");
    const endDate = day(input?.endDate, "Planned end date");
    if (startDate && endDate && endDate < startDate) return { ok: false, error: "The planned end date must be after the start date." };
    const timezone = TIMEZONES.includes(input?.timezone as (typeof TIMEZONES)[number]) ? String(input!.timezone) : DEFAULT_TZ;
    return { ok: true, value: { code, startDate, endDate, timezone } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Trainers of a batch, each with the units they may access. Only known trainers, only units assigned to the batch;
 * a trainer listed twice is merged; a trainer with no units is dropped.
 */
export function checkTrainerAssignments(input: unknown, batchUnits: string[], trainerIds: string[]): TrainerAssignment[] {
  const units = new Set(batchUnits);
  const known = new Set(trainerIds);
  const out = new Map<string, Set<string>>();
  for (const t of Array.isArray(input) ? input : []) {
    const id = String((t as TrainerAssignment)?.trainerId ?? "");
    if (!known.has(id)) continue;
    const set = out.get(id) ?? new Set<string>();
    for (const u of Array.isArray((t as TrainerAssignment)?.unitCodes) ? (t as TrainerAssignment).unitCodes : []) if (units.has(String(u))) set.add(String(u));
    out.set(id, set);
  }
  return [...out].filter(([, u]) => u.size).map(([trainerId, u]) => ({ trainerId, unitCodes: batchUnits.filter((c) => u.has(c)) }));
}

/** Units of the batch nobody is assigned to (shown as a warning) */
export const uncoveredUnits = (b: Pick<BatchDTO, "units" | "trainers">) => b.units.filter((u) => !b.trainers.some((t) => t.unitCodes.includes(u)));

export const cleanBatchName = (raw: unknown) => String(raw ?? "").trim().replace(/\s+/g, " ");

export function checkBatchName(raw: unknown): { name: string } | { error: string } {
  const name = cleanBatchName(raw);
  if (!name || name.length > BATCH_NAME_MAX) return { error: `Batch name must be 1–${BATCH_NAME_MAX} characters.` };
  return { name };
}

/** One class of a batch: a day of the week, a time (24-hour HH:MM) and a web link to join */
export function checkClassSession(input: { day?: unknown; time?: unknown; link?: unknown }): { ok: true; value: Omit<ClassSession, "id"> } | { ok: false; error: string } {
  const day = String(input?.day ?? "");
  if (!CLASS_DAYS.includes(day as ClassDay)) return { ok: false, error: "Choose the day of the class." };
  const time = String(input?.time ?? "").trim();
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || +m[1] > 23 || +m[2] > 59) return { ok: false, error: "Choose the time of the class." };
  const link = cleanUrl(input?.link);
  if (!link) return { ok: false, error: "Paste the class link (https://…)." };
  return { ok: true, value: { day: day as ClassDay, time, link } };
}

/** "14:30" → "2:30 pm" */
export function formatClassTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** Classes in week order (Monday first), then by time */
export const sortClasses = <T extends Pick<ClassSession, "day" | "time">>(classes: T[]) =>
  [...classes].sort((a, b) => CLASS_DAYS.indexOf(a.day) - CLASS_DAYS.indexOf(b.day) || a.time.localeCompare(b.time));

/**
 * A student's batch list after putting them in `target` (or taking them out, with null) for `courseCode`.
 * Only that course's batch changes; their batches in other courses stay as they are.
 */
export function placeInBatch(
  current: string[],
  courseOf: (batchId: string) => string | null | undefined,
  courseCode: string,
  target: string | null,
): string[] {
  const kept = current.filter((id) => courseOf(id) !== courseCode && id !== target);
  return target ? [...kept, target] : kept;
}

/** Can this student join a batch of this course? */
export function canJoinBatch(studentCourses: string[], batchCourse: string | null): string | null {
  if (!batchCourse) return "This batch has no course. Pick a course for it first.";
  if (!studentCourses.includes(batchCourse)) return `The student isn’t enrolled in ${batchCourse}.`;
  return null;
}

/**
 * Transfer preview: which trainer covers each unit of the destination batch, units there with no trainer, and units the
 * student has work or a status in that the destination batch doesn't take (kept — admin resolves them).
 */
export function transferPreview(
  target: Pick<BatchDTO, "name" | "units" | "trainers">,
  workedUnits: string[],
  trainerName: (id: string) => string,
  schedule: { studentOpen: string[]; destinationOpen: string[] } = { studentOpen: [], destinationOpen: [] },
) {
  const coverage = target.units.map((unit) => ({ unit, trainers: target.trainers.filter((t) => t.unitCodes.includes(unit)).map((t) => trainerName(t.trainerId)) }));
  return {
    to: target.name,
    coverage,
    uncovered: coverage.filter((c) => !c.trainers.length).map((c) => c.unit),
    notInDestination: [...new Set(workedUnits)].filter((u) => !target.units.includes(u)),
    // schedule conflicts with the destination plan: units already open there but not for this student, and units
    // open for this student that the destination hasn't opened yet (kept as the student's own exception)
    openThereNotForStudent: target.units.filter((u) => schedule.destinationOpen.includes(u) && !schedule.studentOpen.includes(u)),
    openForStudentNotThere: schedule.studentOpen.filter((u) => target.units.includes(u) && !schedule.destinationOpen.includes(u)),
  };
}
