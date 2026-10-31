// Shared by server code and client components (no server-only imports here).

export const SWITCHES = [
  { key: "registrations", label: "Allow new enrolments", hint: "Students can sign up and request a course." },
  { key: "proctoring", label: "Photo on submit", hint: "Students take a photo with their camera when they submit an assessment. Only Super Admin sees it." },
  { key: "emailAlerts", label: "Email alerts for new tickets", hint: "Super Admin gets an email when a student raises a ticket." },
  { key: "maintenance", label: "Maintenance mode", hint: "Students and trainers can’t log in until it’s switched off." },
] as const;
export type SwitchKey = (typeof SWITCHES)[number]["key"];

export const PERMISSIONS = [
  { key: "manageStudents", label: "Manage students" },
  { key: "manageCourses", label: "Manage courses" },
  { key: "markAssessments", label: "Mark assessments" },
  { key: "handleTickets", label: "Handle tickets" },
] as const;
export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const COLLEGE_FIELDS = [
  { key: "name", label: "College name" },
  { key: "rto", label: "RTO number" },
  { key: "email", label: "Admin email" },
  { key: "phone", label: "Phone" },
] as const;
export type CollegeKey = (typeof COLLEGE_FIELDS)[number]["key"];

export type PortalSettings = {
  college: Record<CollegeKey, string>;
  switches: Record<SwitchKey, boolean>;
  // What trainers may do. Super Admin can always do everything; students have no admin rights.
  trainerPermissions: Record<PermissionKey, boolean>;
};

export const DEFAULT_SETTINGS: PortalSettings = {
  college: {
    name: "Stella College",
    rto: "41290",
    email: "admin@stellacollege.edu.au",
    phone: "1800 069 877",
  },
  switches: { registrations: true, proctoring: true, emailAlerts: true, maintenance: false },
  trainerPermissions: { manageStudents: false, manageCourses: false, markAssessments: true, handleTickets: true },
};
