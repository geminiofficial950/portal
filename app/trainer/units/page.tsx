import Link from "next/link";
import { requireTrainer } from "@/lib/auth";
import { listCourses } from "@/lib/courses";
import { listAllHandedIn } from "@/lib/submissions";
import { trainerScope } from "@/lib/trainer-access";

// The units assigned to this trainer, per batch, with how much is waiting to be marked
export default async function AssignedUnitsPage() {
  const trainer = await requireTrainer();
  const [scope, courses, work] = await Promise.all([trainerScope(trainer.trainerId), listCourses(), listAllHandedIn()]);
  const title = (course: string | null, unit: string) => courses.find((c) => c.code === course)?.units.find((u) => u.code === unit)?.title ?? unit;
  const rows = scope.batches.flatMap((b) =>
    (b.trainers.find((t) => t.trainerId === trainer.trainerId)?.unitCodes ?? []).map((unit) => {
      const students = scope.students.filter((s) => s.batchIds.includes(b.batchId));
      const waiting = work.filter((w) => w.unitCode === unit && w.status === "Submitted" && students.some((s) => s.studentId === w.studentId)).length;
      return { batch: b, unit, students: students.length, waiting };
    }),
  );
  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-[1.65rem]">Assigned units</h1>
        <p className="mt-1 text-sm text-ink">You can access only these units, for the students currently in these batches.</p>
      </div>
      <div className="overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-ink text-xs uppercase tracking-wide text-white">
              <tr>
                <th className="px-5 py-3 font-medium">Unit</th>
                <th className="px-5 py-3 font-medium">Batch</th>
                <th className="px-5 py-3 font-medium">Students</th>
                <th className="px-5 py-3 font-medium">Pending marking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {rows.map((r) => (
                <tr key={`${r.batch.batchId}/${r.unit}`}>
                  <td className="px-5 py-3">
                    <Link href={`/trainer/marking/course/${encodeURIComponent(r.batch.courseCode ?? "")}/${encodeURIComponent(r.unit)}`} className="font-semibold text-plum underline">
                      {r.unit}
                    </Link>{" "}
                    <span className="text-ink">{title(r.batch.courseCode, r.unit)}</span>
                  </td>
                  <td className="px-5 py-3 text-ink">
                    {r.batch.name} {r.batch.code && <span className="font-mono text-xs">({r.batch.code})</span>}
                  </td>
                  <td className="px-5 py-3 text-ink">{r.students}</td>
                  <td className="px-5 py-3">
                    {r.waiting ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">{r.waiting} to mark</span> : <span className="text-ink">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <p className="px-5 py-10 text-center text-sm text-ink">No units are assigned to you yet. The college assigns them per batch.</p>}
      </div>
    </div>
  );
}
