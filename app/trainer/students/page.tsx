import Link from "next/link";
import { ArrowRightIcon, UsersIcon } from "../../dashboard/_components/icons";
import { requireTrainer } from "@/lib/auth";
import { initials } from "@/lib/format";
import { listStudentsWithResults } from "@/lib/progress";

export default async function TrainerStudentsPage() {
  await requireTrainer();
  const students = (await listStudentsWithResults()).filter((s) => s.status === "Active");

  return (
    <div className="animate-fade-up space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-ink sm:text-[1.65rem]">Students</h1>
        <p className="mt-1 text-sm text-ink/55">Open a student to see every unit and give each unit its final result.</p>
      </div>

      <ul className="space-y-3">
        {students.map((s) => (
          <li key={s.studentId}>
            <Link
              href={`/trainer/students/${s.studentId}`}
              className="group flex items-center gap-4 rounded-[1.5rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] transition hover:border-plum/20"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-peach text-xs font-bold text-white">{initials(s.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">{s.name}</span>
                <span className="block truncate text-[11px] text-ink/45">
                  {s.studentId} · {s.courseCodes.join(", ")} · {s.email}
                </span>
              </span>
              <span className="hidden text-right sm:block">
                <span className="block text-sm font-medium text-ink">
                  {s.passed} / {s.units}
                </span>
                <span className="block text-[11px] text-ink/45">units passed</span>
              </span>
              <ArrowRightIcon className="h-4 w-4 text-ink/30 transition group-hover:translate-x-0.5 group-hover:text-plum" />
            </Link>
          </li>
        ))}
        {students.length === 0 && (
          <li className="grid place-items-center rounded-[1.5rem] bg-lilac/70 px-5 py-12 text-center">
            <UsersIcon className="h-8 w-8 text-plum/40" />
            <p className="mt-3 text-sm text-ink/45">No active students yet.</p>
          </li>
        )}
      </ul>
    </div>
  );
}
