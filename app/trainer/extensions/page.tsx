import { requireTrainer } from "@/lib/auth";
import { listExtensionRequests } from "@/lib/deadlines";
import { trainerScope } from "@/lib/trainer-access";
import ExtensionInbox from "./ExtensionInbox";

// Extension requests from students currently in the trainer's batches, for their assigned units
export default async function TrainerExtensionsPage() {
  const trainer = await requireTrainer();
  const [requests, scope] = await Promise.all([listExtensionRequests(), trainerScope(trainer.trainerId)]);
  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-[1.65rem]">Extension requests</h1>
        <p className="mt-1 text-sm text-ink">Approve with a new deadline, or decline with a reason. Only that student and module change.</p>
      </div>
      <ExtensionInbox initial={requests.filter((r) => scope.can(r.studentId, r.unitCode))} />
    </div>
  );
}
