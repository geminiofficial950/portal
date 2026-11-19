"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { requireStudent } from "@/lib/auth";
import { logStudent } from "@/lib/student-logs";
import { BOOKING_TOPIC_PREFIX, checkBooking, timeLabel, type BookingInput } from "@/lib/support-booking-meta";
import { ownedUploads } from "@/lib/files";
import { TECH_SUPPORT_TOPIC, TICKET_ATTACHMENTS_MAX, TICKET_TOPICS, type TicketDTO } from "@/lib/ticket-meta";
import { addTicketMessage, createTicket } from "@/lib/tickets";

type Result = { ok: true; ticket: TicketDTO } | { ok: false; error: string };

export async function createTicketAction(input: { topicId: string; subject: string; details: string }): Promise<Result> {
  const session = await requireStudent();
  const topic = TICKET_TOPICS.find((t) => t.id === input.topicId)?.label ?? "Something else";
  const subject = input.subject.trim();
  const details = input.details.trim() || subject;
  if (!subject) return { ok: false, error: "Add a short title." };
  if (subject.length > 140) return { ok: false, error: "Keep the title under 140 characters." };

  const ticket = await createTicket({
    studentId: session.sub,
    studentName: session.name,
    topic,
    subject,
    text: details.slice(0, 4000),
  });
  await logActivity(session.name, `raised ticket ${ticket.ticketId}`, "ticket");
  await logStudent({ studentId: session.sub, studentName: session.name, action: "Raised ticket", detail: `${ticket.ticketId} · ${subject}` });
  revalidatePath("/dashboard/tickets");
  revalidatePath("/superadmin", "layout");
  return { ok: true, ticket };
}

// A tech support ticket from the sidebar's "Tech support" button. Goes to Admin (Support → Tech support).
// `fileIds`: up to TICKET_ATTACHMENTS_MAX screenshots the student uploaded first (/api/files).
export async function raiseTechSupportAction(input: { subject: string; details: string; fileIds?: string[] }): Promise<Result> {
  const session = await requireStudent();
  const subject = String(input.subject ?? "").trim();
  const details = String(input.details ?? "").trim();
  if (!subject) return { ok: false, error: "Add a short title." };
  if (subject.length > 140) return { ok: false, error: "Keep the title under 140 characters." };
  if (!details) return { ok: false, error: "Tell us what’s going wrong." };

  // screenshots: only images this student uploaded themselves
  const ids = [...new Set((Array.isArray(input.fileIds) ? input.fileIds : []).map(String))];
  if (ids.length > TICKET_ATTACHMENTS_MAX) return { ok: false, error: `Add at most ${TICKET_ATTACHMENTS_MAX} screenshots.` };
  const owned = await ownedUploads(ids, session.sub);
  const attachments = owned.filter((f) => /\.(png|jpe?g)$/i.test(f.name));
  if (attachments.length !== ids.length) return { ok: false, error: "A screenshot couldn’t be added. Upload it again (PNG or JPG)." };

  const ticket = await createTicket({
    studentId: session.sub,
    studentName: session.name,
    topic: TECH_SUPPORT_TOPIC,
    subject,
    text: details.slice(0, 4000),
    attachments,
  });
  await logActivity(session.name, `raised tech support ticket ${ticket.ticketId}`, "ticket");
  await logStudent({ studentId: session.sub, studentName: session.name, action: "Raised ticket", detail: `${ticket.ticketId} · Tech support · ${subject}` });
  revalidatePath("/dashboard/tickets");
  revalidatePath("/superadmin", "layout");
  return { ok: true, ticket };
}

export async function replyAsStudentAction(ticketId: string, text: string): Promise<Result> {
  const session = await requireStudent();
  const body = text.trim();
  if (!body) return { ok: false, error: "Write a message first." };
  const ticket = await addTicketMessage(
    ticketId,
    { from: "student", name: session.name, text: body.slice(0, 4000) },
    { studentId: session.sub },
  );
  if (!ticket) return { ok: false, error: "Ticket not found." };
  revalidatePath("/dashboard/tickets");
  revalidatePath("/superadmin", "layout");
  revalidatePath("/trainer", "layout");
  return { ok: true, ticket };
}

// ---------- Support bookings (the cards at the top of Student support) ----------

const melbourneToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** A support booking becomes a request in Admin → Support (priority and assignee are set there) */
export async function bookSupportAction(input: BookingInput): Promise<Result> {
  const session = await requireStudent();
  const b = checkBooking(input, melbourneToday());
  if (!b.ok) return b;
  const day = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${b.date}T00:00:00Z`));
  const when = b.when.kind === "slot" ? `Preferred time: ${day}, ${timeLabel(b.when.time)} (Melbourne time)` : `Call-back window: ${day}, ${b.when.window} (Melbourne time)`;
  const subject = `Book support: ${b.options.map((o) => o.label).join(", ")}`.slice(0, 140);
  const text = [
    `Support booking — ${b.group.title}`,
    `Student: ${session.name} (${session.sub})`,
    ...b.options.map((o) => `• ${o.label}: ${o.detail}`),
    when,
    `Meeting mode: ${b.mode}`,
    `Contact (${b.contact.by}): ${b.contact.value}`,
    b.note ? `Description: ${b.note}` : "",
    "Consent: the student agreed to share these details with the support officer.",
  ]
    .filter(Boolean)
    .join("\n");
  const booking = {
    group: b.group.title,
    services: b.options.map((o) => o.label),
    when: b.when.kind === "slot" ? `${day}, ${timeLabel(b.when.time)}` : `${day}, call back ${b.when.window.toLowerCase()}`,
    mode: b.mode,
    contact: b.contact.value,
  };
  const ticket = await createTicket({ studentId: session.sub, studentName: session.name, topic: `${BOOKING_TOPIC_PREFIX} · ${b.group.title}`, subject, text, booking });
  await logActivity(session.name, `booked support (${b.group.title}) — ${ticket.ticketId}`, "ticket");
  await logStudent({ studentId: session.sub, studentName: session.name, action: "Booked support", detail: `${ticket.ticketId} · ${b.group.title}` });
  revalidatePath("/dashboard/tickets");
  revalidatePath("/superadmin", "layout");
  return { ok: true, ticket };
}
