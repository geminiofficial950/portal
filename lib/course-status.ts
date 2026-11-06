// A student's standing in their course, set by Super Admin / Admins. Shared by server code and client components.
// Separate from the account (login) status: Active, Pending, or Deactivated (stored "Suspended"),
// which controls access to the portal.

// What staff can pick (LMS guide): Active, Withdrawn, Cancelled, Completed, Deferred — and "Disabled", which is the
// account switch (it blocks login across every course; stored as account status "Suspended").
export const STATUS_CHOICES = ["Active", "Withdrawn", "Cancelled", "Completed", "Deferred"] as const;

// Every status a record can hold: the four above plus older ones, kept so existing records still show correctly
export const COURSE_STATUSES = [
  ...STATUS_CHOICES,
  "Risk of withdrawal",
  "Inactive",
  "Competent",
  "Not yet competent",
] as const;
// (Deferred is new; older records never hold it, so no migration is needed.)

export type CourseStatus = (typeof COURSE_STATUSES)[number];

// Student-log action for a course status change; its detail reads "<from> → <to> · <reason> · by <staff>"
export const COURSE_STATUS_LOG = "Course status changed";
export const COURSE_STATUS_REASON_MAX = 500;
export const parseStatusChange = (detail: string) => {
  const parts = detail.split(" · ");
  const by = parts.length > 2 && parts.at(-1)!.startsWith("by ") ? parts.pop()!.slice(3) : "";
  const [change = "", ...reason] = parts;
  return { change, reason: reason.join(" · "), by };
};

// Only the four choices can be set
export const isCourseStatus = (v: unknown): v is CourseStatus => STATUS_CHOICES.includes(v as (typeof STATUS_CHOICES)[number]);

// Options for a status dropdown: the four choices, plus the current value if it's an older one (so it isn't lost by accident)
export const statusOptions = (current: CourseStatus): CourseStatus[] =>
  (STATUS_CHOICES as readonly CourseStatus[]).includes(current) ? [...STATUS_CHOICES] : [...STATUS_CHOICES, current];

// Chip colours on a light background
export const courseStatusStyle: Record<CourseStatus, string> = {
  Active: "bg-emerald-100 text-emerald-800",
  Completed: "bg-sky-100 text-sky-800",
  Deferred: "bg-amber-100 text-amber-900",
  "Risk of withdrawal": "bg-amber-100 text-amber-800",
  Withdrawn: "bg-rose-100 text-rose-800",
  Cancelled: "bg-rose-100 text-rose-800",
  Inactive: "bg-slate-200 text-slate-700",
  Competent: "bg-emerald-100 text-emerald-800",
  "Not yet competent": "bg-orange-100 text-orange-800",
};

// The account status as staff and students read it
export const accountLabel = (s: "Active" | "Pending" | "Suspended") => (s === "Suspended" ? "Disabled" : s);

export const PLACEMENT_HOURS_MAX = 2000;
