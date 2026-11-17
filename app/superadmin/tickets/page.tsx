import { requireAdmin } from "@/lib/auth";
import { listAdmins } from "@/lib/admins";
import { listTrainers } from "@/lib/trainers";
import { listTickets } from "@/lib/tickets";
import TicketsClient from "./TicketsClient";

export default async function TicketsAdminPage() {
  await requireAdmin();
  const [tickets, trainers, admins] = await Promise.all([listTickets(), listTrainers(), listAdmins()]);
  // a request can go to an active trainer or an Admin account
  const assignees = [
    ...trainers.filter((t) => t.active).map(({ trainerId, name }) => ({ trainerId, name: `${name} · Trainer` })),
    ...admins.filter((a) => a.active).map(({ adminId, name }) => ({ trainerId: adminId, name: `${name} · Admin` })),
  ];
  return <TicketsClient initialTickets={tickets} assignees={assignees} />;
}
