import { notFound } from "next/navigation";
import { requireTrainer } from "@/lib/auth";
import BatchDetail from "../../../superadmin/batches/BatchDetail";
import { loadBatchDetail } from "../../../superadmin/batches/load";

// A trainer opens only their own batches
export default async function TrainerBatchPage(props: PageProps<"/trainer/batches/[id]">) {
  const trainer = await requireTrainer();
  const data = await loadBatchDetail(decodeURIComponent((await props.params).id));
  if (!data || !data.batch.trainers.some((t) => t.trainerId === trainer.trainerId)) notFound();
  return <BatchDetail data={data} role="trainer" viewerTrainerId={trainer.trainerId} canDelete={false} initialTab={typeof (await props.searchParams).tab === "string" ? String((await props.searchParams).tab) : undefined} backHref="/trainer/batches" />;
}
