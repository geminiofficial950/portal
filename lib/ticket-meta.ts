// Shared by server code and client components (no server-only imports here).

export const TICKET_STATUSES = ["Open", "In progress", "Resolved"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["High", "Medium", "Low"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_TOPICS = [
  { id: "assessment", label: "Assessment help", hint: "Extensions, uploads, marking" },
  { id: "classes", label: "Classes & timetable", hint: "Clash, room change, attendance" },
  { id: "portal", label: "Login & portal", hint: "Password, access, uploads" },
  { id: "course", label: "Course question", hint: "Modules, materials, trainer" },
  { id: "other", label: "Something else", hint: "Fees, ID card, general help" },
] as const;

export type TicketMessage = { from: "student" | "college"; name: string; text: string; time: string };

/** The details of a support booking (Student support → Book support), kept with the request so the student sees a simple card */
export type BookingSummary = { group: string; services: string[]; when: string; mode: string; contact: string };

export type TicketDTO = {
  ticketId: string;
  studentId: string;
  studentName: string;
  topic: string;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string; // trainer name or "Unassigned"
  assigneeId: string | null; // trainer ID
  created: string;
  messages: TicketMessage[];
  booking: BookingSummary | null; // set for support bookings
  events: TicketEvent[]; // progress: submitted, assigned, status changes, replies — oldest first
};

/** One step in a request's progress */
export type TicketEvent = { by: string; text: string; time: string };
