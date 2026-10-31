import { requireAdmin } from "@/lib/auth";
import { listTrainers } from "@/lib/trainers";
import { listTickets } from "@/lib/tickets";
import TicketsClient from "./TicketsClient";

export default async function TicketsAdminPage() {
  await requireAdmin();
  const [tickets, trainers] = await Promise.all([listTickets(), listTrainers()]);
  const assignees = trainers.filter((t) => t.active).map(({ trainerId, name }) => ({ trainerId, name }));
  return <TicketsClient initialTickets={tickets} assignees={assignees} />;
}
