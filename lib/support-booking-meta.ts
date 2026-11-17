// Student support bookings: six groups of tickable options (from the "Student Support Booking Page" content).
// The student ticks what they need on a group's card, then Book support asks for a preferred time. The booking goes
// to Admin → Support as a request, where it gets a priority and is assigned to someone.
// Shared by server code and client components (no server-only imports here).

export type SupportOption = { id: string; label: string; detail: string };
export type SupportGroup = {
  id: string;
  title: string;
  subtitle: string;
  icon: "learning" | "access" | "placement" | "wellbeing" | "admin" | "career" | "feedback";
  tone: string; // the icon circle's colours
  pill: string; // the coloured pill under the title
  where: string; // the line next to the pin icon
  lines: [string, string];
  options: SupportOption[];
  formLink?: boolean; // no booking: the card shows "Open a form link" (not clickable for now)
};

export const SUPPORT_GROUPS: SupportGroup[] = [
  {
    id: "learning",
    title: "Learning support",
    subtitle: "Course content, study skills and assessments",
    icon: "learning",
    tone: "bg-[#e9e2fb] text-[#5b3f99]",
    pill: "bg-emerald-600 text-white",
    where: "Online or on campus",
    lines: ["With your trainer or a learning support officer", "Reply within 1 business day"],
    options: [
      { id: "academic", label: "Academic support", detail: "Help with course content, study skills, and understanding tasks" },
      { id: "llnd", label: "LLND support", detail: "Language, literacy, numeracy and digital skills help" },
      { id: "assessment", label: "Assessment support", detail: "Resubmission, reassessment, extension, or feedback explained" },
      { id: "technical", label: "Technical help", detail: "LMS access, devices, internet and digital skills" },
    ],
  },
  {
    id: "access",
    title: "Access and equity",
    subtitle: "Reasonable adjustments and access",
    icon: "access",
    tone: "bg-sky-100 text-sky-800",
    pill: "bg-sky-700 text-white",
    where: "Online, phone or on campus",
    lines: ["With a student support officer", "Private and confidential"],
    options: [
      { id: "adjustments", label: "Reasonable adjustments", detail: "Disability, learning or health needs, and how to request an adjustment" },
    ],
  },
  {
    id: "placement",
    title: "Placement and progress",
    subtitle: "Work placement and progress check-ins",
    icon: "placement",
    tone: "bg-amber-100 text-amber-800",
    pill: "bg-amber-600 text-white",
    where: "Online or on campus",
    lines: ["With the placement coordinator or your trainer", "Reply within 1 business day"],
    options: [
      { id: "placement", label: "Placement support", detail: "Placement coordinator, host issues, hours and logbook help" },
      { id: "progress", label: "Progress check-in", detail: "Review of progress with a trainer or support officer" },
    ],
  },
  {
    id: "wellbeing",
    title: "Student wellbeing",
    subtitle: "Wellbeing and welfare support",
    icon: "wellbeing",
    tone: "bg-rose-100 text-rose-800",
    pill: "bg-rose-600 text-white",
    where: "Online, phone or on campus",
    lines: ["With a student support officer", "Private and confidential"],
    options: [
      { id: "wellbeing", label: "Wellbeing and welfare", detail: "Personal or financial stress, referral to counselling or community services" },
    ],
  },
  {
    id: "admin",
    title: "Admin and finance",
    subtitle: "Enrolment, credit transfer and fees",
    icon: "admin",
    tone: "bg-emerald-100 text-emerald-800",
    pill: "bg-emerald-700 text-white",
    where: "Online or phone",
    lines: ["With Student Services", "Reply within 1 business day"],
    options: [
      { id: "enrolment", label: "Enrolment and admin", detail: "Course changes, deferral, withdrawal, USI, certificates and records" },
      { id: "rpl", label: "Credit transfer and RPL", detail: "Applications, evidence guidance, request status" },
      { id: "fees", label: "Fees and refunds", detail: "Payment plans, refund queries, funding eligibility" },
    ],
  },
  {
    id: "career",
    title: "Career and pathways",
    subtitle: "Jobs, resumes and further study",
    icon: "career",
    tone: "bg-indigo-100 text-indigo-800",
    pill: "bg-indigo-600 text-white",
    where: "Online or on campus",
    lines: ["With a careers and pathways adviser", "Reply within 2 business days"],
    options: [
      { id: "career", label: "Career and employment", detail: "Job readiness, resume support, further study pathways" },
    ],
  },
  {
    id: "feedback",
    title: "Feedback and concerns",
    subtitle: "Complaints and appeals",
    icon: "feedback",
    tone: "bg-slate-200 text-slate-800",
    pill: "bg-slate-700 text-white",
    where: "Online or on campus",
    lines: ["A confidential discussion", "Before or alongside a formal lodgement"],
    options: [{ id: "complaints", label: "Complaints and appeals", detail: "A confidential discussion before or alongside a formal lodgement" }],
    formLink: true,
  },
];

export const SUPPORT_MODES = ["Video call", "Phone call", "In person"] as const;
export type SupportMode = (typeof SUPPORT_MODES)[number];

/** Call-back windows (Melbourne time), when the student would rather be called back than pick a time */
export const CALLBACK_WINDOWS = ["Morning (9 am – 12 pm)", "Afternoon (12 pm – 3 pm)", "Late afternoon (3 pm – 5 pm)"] as const;

/** Half-hour start times a student can ask for, 9:00 am – 4:30 pm (Melbourne) */
export const SUPPORT_TIMES = Array.from({ length: 16 }, (_, i) => {
  const h = 9 + Math.floor(i / 2);
  return `${String(h).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
});

export const SUPPORT_NOTE_MAX = 500;
export const BOOKING_TOPIC_PREFIX = "Support booking";

// The booking form has exactly the LMS guide's fields: name and student ID (from the login), services ticked,
// preferred date and time OR call-back window, meeting mode, short description, consent, contact number or email.
export type BookingInput = {
  groupId: string;
  optionIds: string[];
  date: string;
  slot: string; // a time ("10:30") or a call-back window (CALLBACK_WINDOWS)
  mode: string;
  note: string;
  consent: boolean;
  contact: string; // a phone number or an email
};

/** "14:30" → "2:30 pm" */
export const timeLabel = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const isPhone = (v: string) => /^\+?[\d\s()-]{8,20}$/.test(v.trim()) && v.replace(/\D/g, "").length >= 8;

export type CheckedBooking = {
  group: SupportGroup;
  options: SupportOption[];
  date: string;
  when: { kind: "slot"; time: string } | { kind: "callback"; window: string };
  mode: SupportMode;
  note: string;
  contact: { by: "email" | "phone"; value: string };
};

/** Checks a booking. `today` is YYYY-MM-DD in Melbourne. */
export function checkBooking(input: Partial<BookingInput>, today: string): ({ ok: true } & CheckedBooking) | { ok: false; error: string } {
  const group = SUPPORT_GROUPS.find((g) => g.id === input?.groupId);
  if (!group || group.formLink) return { ok: false, error: "Choose what you need help with." };
  const ids = Array.isArray(input?.optionIds) ? input.optionIds.map(String) : [];
  const options = group.options.filter((o) => ids.includes(o.id));
  if (!options.length) return { ok: false, error: "Tick at least one service." };
  const date = String(input?.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return { ok: false, error: "Choose a preferred date." };
  if (date < today) return { ok: false, error: "Choose today or a later date." };
  const slot = String(input?.slot ?? "");
  const win = CALLBACK_WINDOWS.find((w) => w === slot);
  if (!win && !SUPPORT_TIMES.includes(slot)) return { ok: false, error: "Choose a preferred time or a call-back window." };
  const when: CheckedBooking["when"] = win ? { kind: "callback", window: win } : { kind: "slot", time: slot };
  const mode = SUPPORT_MODES.find((m) => m === input?.mode);
  if (!mode) return { ok: false, error: "Choose a meeting mode." };
  const note = String(input?.note ?? "").trim().slice(0, SUPPORT_NOTE_MAX);
  if (input?.consent !== true) return { ok: false, error: "Tick the box to agree to share these details with the support officer." };
  const value = String(input?.contact ?? "").trim();
  const by = isEmail(value) ? "email" : isPhone(value) ? "phone" : null;
  if (!by) return { ok: false, error: "Enter a contact number or email." };
  return { ok: true, group, options, date, when, mode, note, contact: { by, value } };
}
