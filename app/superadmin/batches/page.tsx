import { requireAdmin } from "@/lib/auth";
import { listCourses } from "@/lib/courses";
import { listBatches } from "@/lib/groups";
import { listTrainers } from "@/lib/trainers";
import BatchesClient from "./BatchesClient";

export default async function BatchesPage() {
  const admin = await requireAdmin();
  const [batches, courses, trainers] = await Promise.all([listBatches(), listCourses(), listTrainers()]);
  return (
    <BatchesClient
      initial={batches}
      courses={courses.map((c) => ({ code: c.code, name: c.name }))}
      trainers={trainers.filter((t) => t.active).map((t) => ({ trainerId: t.trainerId, name: t.name }))}
      base={admin.isSuper ? "/superadmin/batches" : "/admin/batches"}
    />
  );
}
