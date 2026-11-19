"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { adminActor, requireAdmin } from "@/lib/auth";
import { listAdmins } from "@/lib/admins";
import { listTrainers } from "@/lib/trainers";
import { TECH_SUPPORT_TOPIC, TICKET_PRIORITIES, TICKET_STATUSES, type TicketDTO, type TicketPriority, type TicketStatus } from "@/lib/ticket-meta";
import { addTicketMessage, getTicketTopic, updateTicket } from "@/lib/tickets";

type Result = { ok: true; ticket: TicketDTO } | { ok: false; error: string };

const done = (ticket: TicketDTO | null): Result => {
  if (!ticket) return { ok: false, error: "Ticket not found." };
  revalidatePath("/superadmin", "layout");
  revalidatePath("/dashboard/tickets");
  revalidatePath("/trainer", "layout");
  return { ok: true, ticket };
};

// trainerId: an active trainer's ID or an Admin account's ID; null = unassign
export async function assignTicketAction(ticketId: string, trainerId: string | null): Promise<Result> {
  await requireAdmin();
  // Tech support tickets stay with Admin: they are never assigned to anyone
  if ((await getTicketTopic(ticketId)) === TECH_SUPPORT_TOPIC) return { ok: false, error: "Tech support tickets aren’t assigned. Admin handles them." };
  const actor = await adminActor();
  let assignee = "Unassigned";
  if (trainerId) {
    const trainer = (await listTrainers()).find((t) => t.trainerId === trainerId && t.active);
    const admin = trainer ? null : (await listAdmins()).find((a) => a.adminId === trainerId && a.active);
    if (!trainer && !admin) return { ok: false, error: "Pick an active trainer or Admin." };
    assignee = trainer ? trainer.name : `${admin!.name} (Admin)`;
  }
  const ticket = await updateTicket(ticketId, { assignee, assigneeId: trainerId }, {}, { by: actor, text: trainerId ? `Assigned to ${assignee}` : "Unassigned" });
  // Assigning an open ticket starts work on it
  const result = ticket?.status === "Open" && trainerId ? await updateTicket(ticketId, { status: "In progress" }) : ticket;
  if (result) await logActivity(actor, `assigned ${ticketId} to ${assignee}`, "ticket");
  return done(result);
}

export async function setTicketStatusAction(ticketId: string, status: TicketStatus): Promise<Result> {
  await requireAdmin();
  if (!TICKET_STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  const actor = await adminActor();
  const ticket = await updateTicket(ticketId, { status }, {}, { by: actor, text: `Marked ${status}` });
  if (ticket) await logActivity(actor, `marked ${ticketId} as ${status.toLowerCase()}`, "ticket");
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
  const actor = await adminActor();
  const ticket = await addTicketMessage(ticketId, { from: "college", name: "Stella College Support", text: body.slice(0, 4000) }, {}, { by: actor, text: "Replied" });
  if (ticket) await logActivity(actor, `replied on ${ticketId}`, "ticket");
  return done(ticket);
}
