"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { requireStudent } from "@/lib/auth";
import { logStudent } from "@/lib/student-logs";
import { TICKET_TOPICS, type TicketDTO } from "@/lib/ticket-meta";
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
