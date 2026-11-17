import { requireStudent } from "@/lib/auth";
import { getStudent } from "@/lib/students";
import { listTickets } from "@/lib/tickets";
import TicketsClient from "./TicketsClient";

export default async function TicketsPage() {
  const session = await requireStudent();
  const [tickets, student] = await Promise.all([listTickets({ studentId: session.sub }), getStudent(session.sub)]);
  // the booking form fills in the student's name, ID and email from their login
  const me = { name: student?.name ?? session.name, studentId: session.sub, email: student?.email ?? "" };
  return <TicketsClient initialTickets={tickets} me={me} />;
}
