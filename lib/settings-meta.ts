// Shared by server code and client components (no server-only imports here).

export const SWITCHES = [
  { key: "registrations", label: "Allow new enrolments", hint: "Students can sign up and request a course." },
  { key: "proctoring", label: "Photo on submit", hint: "Students take a photo with their camera when they submit an assessment. Students and trainers don’t see it." },
  { key: "emailAlerts", label: "Email alerts for new tickets", hint: "The college admin email gets a message when a student raises a ticket." },
  { key: "mailCourseUpdates", label: "Email students: new course or unit", hint: "A student gets a short “You have 1 new update” email with a Login button when they’re enrolled in a course or a unit is opened for them." },
  { key: "mailFeedback", label: "Email students: feedback", hint: "A student gets the same short email when a trainer publishes feedback on their work." },
  { key: "mailStaffCourseUpdates", label: "Email admins & trainers: new course or unit", hint: "Admin accounts and the student’s batch trainers get the same short email (counted, e.g. “2 new updates”) when a student is enrolled or a unit is opened." },
  { key: "mailStaffFeedback", label: "Email admins & trainers: feedback", hint: "Admin accounts and the unit’s batch trainers get the same short email when feedback is published (not the trainer who published it)." },
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
  switches: { registrations: true, proctoring: true, emailAlerts: true, mailCourseUpdates: true, mailFeedback: true, mailStaffCourseUpdates: true, mailStaffFeedback: true, maintenance: false },
  trainerPermissions: { manageStudents: false, manageCourses: false, markAssessments: true, handleTickets: true },
};
