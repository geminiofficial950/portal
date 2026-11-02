// A student's standing in their course, set by Super Admin. Shared by server code and client components.
// Separate from the login status (Active / Pending / Suspended), which controls access to the portal.

export const COURSE_STATUSES = [
  "Active",
  "Completed",
  "Risk of withdrawal",
  "Withdrawn",
  "Cancelled",
  "Inactive",
  "Competent",
  "Not yet competent",
] as const;

export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const isCourseStatus = (v: unknown): v is CourseStatus => COURSE_STATUSES.includes(v as CourseStatus);

// Chip colours on a light background
export const courseStatusStyle: Record<CourseStatus, string> = {
  Active: "bg-emerald-100 text-emerald-800",
  Completed: "bg-sky-100 text-sky-800",
  "Risk of withdrawal": "bg-amber-100 text-amber-800",
  Withdrawn: "bg-rose-100 text-rose-800",
  Cancelled: "bg-rose-100 text-rose-800",
  Inactive: "bg-slate-200 text-slate-700",
  Competent: "bg-emerald-100 text-emerald-800",
  "Not yet competent": "bg-orange-100 text-orange-800",
};

export const PLACEMENT_HOURS_MAX = 2000;
