import Link from "next/link";
import { ArrowRightIcon, UsersIcon } from "../../dashboard/_components/icons";
import { requireTrainer } from "@/lib/auth";
import { formatClassTime } from "@/lib/batch-meta";
import { listCourses } from "@/lib/courses";
import { listBatches } from "@/lib/groups";

// The batches assigned to this trainer
export default async function TrainerBatchesPage() {
  const trainer = await requireTrainer();
  const [batches, courses] = await Promise.all([listBatches({ trainerId: trainer.trainerId }), listCourses()]);
  const courseName = (code: string | null) => courses.find((c) => c.code === code)?.name ?? "";

  return (
    <div className="animate-fade-up space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-ink sm:text-[1.65rem]">My batches</h1>
        <p className="mt-1 text-sm text-ink">Your batches, their students and class times. Open a batch to change its classes, move students, or reassign it.</p>
      </div>

      {batches.length ? (
        <div className="overflow-hidden rounded-[1.75rem] border border-ink/10 bg-white shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-ink text-[11px] uppercase tracking-wide text-white">
                <tr>
                  <th className="px-5 py-3 font-medium">Batch</th>
                  <th className="px-5 py-3 font-medium">Course</th>
                  <th className="px-5 py-3 font-medium">Students</th>
                  <th className="px-5 py-3 font-medium">Classes</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {batches.map((b) => (
                  <tr key={b.batchId} className="transition hover:bg-lilac/30">
                    <td className="px-5 py-3.5 font-medium text-ink">{b.name}</td>
                    <td className="px-5 py-3.5 text-ink">
                      <span className="block text-xs font-semibold text-plum">{b.courseCode}</span>
                      {courseName(b.courseCode)}
                    </td>
                    <td className="px-5 py-3.5 text-ink">{b.students}</td>
                    <td className="px-5 py-3.5 text-xs text-ink">
                      {b.classes.length ? b.classes.map((c) => <span key={c.id} className="block">{`${c.day} ${formatClassTime(c.time)}`}</span>) : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/trainer/batches/${b.batchId}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-plum px-4 py-2 text-xs font-medium text-white transition hover:bg-plum-light"
                      >
                        Open
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid place-items-center rounded-[1.5rem] bg-lilac/70 px-5 py-12 text-center">
          <UsersIcon className="h-8 w-8 text-plum" />
          <p className="mt-3 text-sm text-ink">No batches are assigned to you yet. The college assigns them.</p>
        </div>
      )}
    </div>
  );
}
