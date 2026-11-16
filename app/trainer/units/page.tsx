import Link from "next/link";
import { requireTrainer } from "@/lib/auth";
import { listAllAssessments } from "@/lib/assessments";
import { listCourses } from "@/lib/courses";
import { markableModules } from "@/lib/module-meta";
import { listAllHandedIn } from "@/lib/submissions";
import { trainerScope } from "@/lib/trainer-access";

const fmtDue = (iso: string) =>
  new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

// The units assigned to this trainer, per batch, with each module's due date and how much is waiting to be marked.
// Dates are the modules' default due dates (Melbourne time); a student's own date (extension) is changed on the batch's Deadlines tab.
export default async function AssignedUnitsPage() {
  const trainer = await requireTrainer();
  const [scope, courses, work, assessments] = await Promise.all([trainerScope(trainer.trainerId), listCourses(), listAllHandedIn(), listAllAssessments()]);
  const duesOf = (course: string | null, unit: string) => markableModules(assessments[`${course}/${unit}`]?.modules ?? []).map((m) => ({ id: m.id, title: m.title, dueAt: m.dueAt }));
  const title = (course: string | null, unit: string) => courses.find((c) => c.code === course)?.units.find((u) => u.code === unit)?.title ?? unit;
  const rows = scope.batches.flatMap((b) =>
    (b.trainers.find((t) => t.trainerId === trainer.trainerId)?.unitCodes ?? []).map((unit) => {
      const students = scope.students.filter((s) => s.batchIds.includes(b.batchId));
      const waiting = work.filter((w) => w.unitCode === unit && w.status === "Submitted" && students.some((s) => s.studentId === w.studentId)).length;
      return { batch: b, unit, students: students.length, waiting, dues: duesOf(b.courseCode, unit) };
    }),
  );
  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-[1.65rem]">Assigned units</h1>
        <p className="mt-1 text-sm text-ink">
          You can access only these units, for the students currently in these batches. Due dates are in Melbourne time — to give a student or the whole batch a different date, open the batch → Deadlines.
        </p>
      </div>
      <div className="overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-ink text-xs uppercase tracking-wide text-white">
              <tr>
                <th className="px-5 py-3 font-medium">Unit</th>
                <th className="px-5 py-3 font-medium">Batch</th>
                <th className="px-5 py-3 font-medium">Due dates</th>
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
                  <td className="px-5 py-3 text-ink">
                    {r.dues.length ? (
                      <ul className="space-y-1">
                        {r.dues.map((m) => (
                          <li key={m.id}>
                            <span className="font-medium">{m.title}:</span>{" "}
                            {m.dueAt ? <span className="font-semibold">{fmtDue(m.dueAt)}</span> : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">No due date</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "—"
                    )}
                    <Link href={`/trainer/batches/${encodeURIComponent(r.batch.batchId)}?tab=deadlines&unit=${encodeURIComponent(r.unit)}`} className="mt-1 inline-block text-xs font-semibold text-plum underline">
                      Change for students
                    </Link>
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
