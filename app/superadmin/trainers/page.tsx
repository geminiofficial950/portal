import { requireAdmin } from "@/lib/auth";
import { listTrainers } from "@/lib/trainers";
import TrainersClient from "./TrainersClient";

export default async function TrainersPage() {
  const admin = await requireAdmin();
  return <TrainersClient initialTrainers={await listTrainers()} canDelete={admin.isSuper} />;
}
