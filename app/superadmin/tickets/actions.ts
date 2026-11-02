"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { adminActor, requireAdmin } from "@/lib/auth";
import { listTrainers } from "@/lib/trainers";
import { TICKET_PRIORITIES, TICKET_STATUSES, type TicketDTO, type TicketPriority, type TicketStatus } from "@/lib/ticket-meta";
import { addTicketMessage, updateTicket } from "@/lib/tickets";

type Result = { ok: true; ticket: TicketDTO } | { ok: false; error: string };

const done = (ticket: TicketDTO | null): Result => {
  if (!ticket) return { ok: false, error: "Ticket not found." };
  revalidatePath("/superadmin", "layout");
  revalidatePath("/dashboard/tickets");
  revalidatePath("/trainer");
  return { ok: true, ticket };
};

// trainerId null = unassign
export async function assignTicketAction(ticketId: string, trainerId: string | null): Promise<Result> {
  await requireAdmin();
  let assignee = "Unassigned";
  if (trainerId) {
    const trainer = (await listTrainers()).find((t) => t.trainerId === trainerId && t.active);
    if (!trainer) return { ok: false, error: "Pick an active trainer." };
    assignee = trainer.name;
  }
  const ticket = await updateTicket(ticketId, { assignee, assigneeId: trainerId });
  // Assigning an open ticket starts work on it
  const result = ticket?.status === "Open" && trainerId ? await updateTicket(ticketId, { status: "In progress" }) : ticket;
  if (result) await logActivity(await adminActor(), `assigned ${ticketId} to ${assignee}`, "ticket");
  return done(result);
}

export async function setTicketStatusAction(ticketId: string, status: TicketStatus): Promise<Result> {
  await requireAdmin();
  if (!TICKET_STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  const ticket = await updateTicket(ticketId, { status });
  if (ticket) await logActivity(await adminActor(), `marked ${ticketId} as ${status.toLowerCase()}`, "ticket");
  return done(ticket);
}

export async function setTicketPriorityAction(ticketId: string, priority: TicketPriority): Promise<Result> {
  await requireAdmin();
  if (!TICKET_PRIORITIES.includes(priority)) return { ok: false, error: "Unknown priority." };
  return done(await updateTicket(ticketId, { priority }));
}

export async function replyTicketAction(ticketId: string, text: string): Promise<Result> {
  await requireAdmin();
  const body = text.trim();
  if (!body) return { ok: false, error: "Write a reply first." };
  const ticket = await addTicketMessage(ticketId, { from: "college", name: "Stella College Support", text: body.slice(0, 4000) });
  if (ticket) await logActivity(await adminActor(), `replied on ${ticketId}`, "ticket");
  return done(ticket);
}
