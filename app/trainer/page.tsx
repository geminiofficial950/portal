import { requireTrainer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { listTickets } from "@/lib/tickets";
import TrainerTicketsClient from "./TrainerTicketsClient";

export default async function TrainerHome() {
  const trainer = await requireTrainer();
  const [tickets, settings] = await Promise.all([listTickets({ assigneeId: trainer.trainerId }), getSettings()]);
  return (
    <TrainerTicketsClient
      name={trainer.name}
      initialTickets={tickets}
      canHandle={settings.trainerPermissions.handleTickets}
    />
  );
}
