import { requireStudent } from "@/lib/auth";
import { listTickets } from "@/lib/tickets";
import TicketsClient from "./TicketsClient";

export default async function TicketsPage() {
  const session = await requireStudent();
  return <TicketsClient initialTickets={await listTickets({ studentId: session.sub })} />;
}
