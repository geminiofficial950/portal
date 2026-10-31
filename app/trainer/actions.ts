"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { requireTrainer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { TICKET_STATUSES, type TicketDTO, type TicketStatus } from "@/lib/ticket-meta";
import { addTicketMessage, updateTicket } from "@/lib/tickets";

type Result = { ok: true; ticket: TicketDTO } | { ok: false; error: string };

const NO_PERMISSION = "Super Admin has turned off ticket handling for trainers.";

const done = (ticket: TicketDTO | null): Result => {
  if (!ticket) return { ok: false, error: "This ticket isn’t assigned to you." };
  revalidatePath("/trainer");
  revalidatePath("/superadmin", "layout");
  revalidatePath("/dashboard/tickets");
  return { ok: true, ticket };
};

export async function replyAsTrainerAction(ticketId: string, text: string): Promise<Result> {
  const trainer = await requireTrainer();
  if (!(await getSettings()).trainerPermissions.handleTickets) return { ok: false, error: NO_PERMISSION };
  const body = text.trim();
  if (!body) return { ok: false, error: "Write a reply first." };
  const ticket = await addTicketMessage(
    ticketId,
    { from: "college", name: `${trainer.name} · Trainer`, text: body.slice(0, 4000) },
    { assigneeId: trainer.trainerId },
  );
  if (ticket) await logActivity(trainer.name, `replied on ${ticketId}`, "ticket");
  return done(ticket);
}

export async function setStatusAsTrainerAction(ticketId: string, status: TicketStatus): Promise<Result> {
  const trainer = await requireTrainer();
  if (!(await getSettings()).trainerPermissions.handleTickets) return { ok: false, error: NO_PERMISSION };
  if (!TICKET_STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  const ticket = await updateTicket(ticketId, { status }, { assigneeId: trainer.trainerId });
  if (ticket) await logActivity(trainer.name, `marked ${ticketId} as ${status.toLowerCase()}`, "ticket");
  return done(ticket);
}
