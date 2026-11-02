import Link from "next/link";
import { ArrowRightIcon } from "../../dashboard/_components/icons";
import { requireTrainer } from "@/lib/auth";
import { listCourses } from "@/lib/courses";
import { countToMarkByCourse } from "@/lib/submissions";

// Trainer marking, step 1: pick a course
export default async function MarkingPage() {
  await requireTrainer();
  const [courses, toMark] = await Promise.all([listCourses(), countToMarkByCourse()]);
  const total = Object.values(toMark).reduce((a, b) => a + b, 0);

  return (
    <div className="animate-fade-up space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-ink sm:text-[1.65rem]">Assessment marking</h1>
          <p className="mt-1 text-sm text-ink">Open a course, then a unit, to review the Theory Task and Workplacement Task work students handed in.</p>
        </div>
        <div className="min-w-48 rounded-[1.5rem] bg-lilac px-5 py-4">
          <p className="text-2xl font-medium text-ink">{total}</p>
          <p className="mt-1 text-xs text-ink/50">waiting to be marked</p>
        </div>
      </div>

      <ol className="space-y-3">
        {courses.map((c, i) => (
          <li key={c.code}>
            <Link
              href={`/trainer/marking/course/${encodeURIComponent(c.code)}`}
              className="group grid gap-4 rounded-[1.5rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] transition hover:border-plum/20 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="flex min-w-0 items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lilac text-sm font-medium text-plum">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-plum">{c.code}</p>
                  <p className="font-medium leading-snug text-ink">{c.name}</p>
                  <p className="mt-1 text-xs text-ink/45">
                    {c.units.length} unit{c.units.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 sm:justify-end">
                {toMark[c.code] ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">{toMark[c.code]} to mark</span>
                ) : (
                  <span className="text-xs text-ink/40">Nothing to mark</span>
                )}
                <ArrowRightIcon className="h-4 w-4 text-ink/30 transition group-hover:translate-x-0.5 group-hover:text-plum" />
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
