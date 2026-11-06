import Link from "next/link";
import { ArrowRightIcon, UsersIcon } from "../../dashboard/_components/icons";
import { requireTrainer } from "@/lib/auth";
import { initials } from "@/lib/format";
import { listBatches } from "@/lib/groups";
import { listStudentsWithResults } from "@/lib/progress";
import { listStudents } from "@/lib/students";
import { trainerScope } from "@/lib/trainer-access";

// The students currently in the trainer's batches (LMS guide: a trainer sees only their assigned batches), in a table.
export default async function TrainerStudentsPage() {
  const trainer = await requireTrainer();
  const [results, students, batches, scope] = await Promise.all([listStudentsWithResults(), listStudents(), listBatches(), trainerScope(trainer.trainerId)]);
  const byId = new Map(batches.map((b) => [b.batchId, b]));
  const batchesOf = (id: string) => (students.find((s) => s.studentId === id)?.batchIds ?? []).map((b) => byId.get(b)).filter((b) => !!b);
  const mine = (id: string) => batchesOf(id).some((b) => b.trainers.some((t) => t.trainerId === trainer.trainerId));
  const rows = results
    .filter((s) => s.status === "Active" && scope.unitsOf(s.studentId).size > 0)
    .sort((a, b) => Number(mine(b.studentId)) - Number(mine(a.studentId)) || a.name.localeCompare(b.name));

  return (
    <div className="animate-fade-up space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-ink sm:text-[1.65rem]">Students</h1>
        <p className="mt-1 text-sm text-ink">Students currently in your batches. Open a student to see the units assigned to you.</p>
      </div>

      {rows.length ? (
        <div className="overflow-hidden rounded-[1.75rem] border border-ink/10 bg-white shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-ink text-[11px] uppercase tracking-wide text-white">
                <tr>
                  <th className="px-5 py-3 font-medium">Student</th>
                  <th className="px-5 py-3 font-medium">Courses</th>
                  <th className="px-5 py-3 font-medium">Batch</th>
                  <th className="px-5 py-3 font-medium">Units passed</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {rows.map((s) => (
                  <tr key={s.studentId} className="transition hover:bg-lilac/30">
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-peach text-[11px] font-bold text-white">{initials(s.name)}</span>
                        <span className="min-w-0">
                          <span className="block font-medium text-ink">{s.name}</span>
                          <span className="block truncate text-[11px] text-ink">
                            {s.studentId} · {s.email}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-semibold text-plum">{s.courseCodes.join(", ")}</td>
                    <td className="px-5 py-3.5 text-xs text-ink">
                      {batchesOf(s.studentId).map((b) => (
                        <span key={b.batchId} className="block">
                          {b.name}
                          {b.trainers.some((t) => t.trainerId === trainer.trainerId) && <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">Yours</span>}
                        </span>
                      ))}
                      {!batchesOf(s.studentId).length && "—"}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-ink">
                      {s.passed} / {s.units}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/trainer/students/${s.studentId}`}
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
          <p className="mt-3 text-sm text-ink">No students in your batches yet. The college assigns batches and units to trainers.</p>
        </div>
      )}
    </div>
  );
}
