import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, BackIcon, ClipboardIcon } from "../../../../dashboard/_components/icons";
import { MARKED_PARTS, summarise } from "@/lib/assessment-meta";
import { listCourseAssessments } from "@/lib/assessments";
import { requireTrainer } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { listCourseWork } from "@/lib/submissions";

// Trainer marking, step 2: the course's units, like the student's assessment list
export default async function MarkingCoursePage(props: PageProps<"/trainer/marking/course/[code]">) {
  await requireTrainer();
  const course = await getCourse(decodeURIComponent((await props.params).code));
  if (!course) notFound();

  const [assessments, work] = await Promise.all([listCourseAssessments(course.code), listCourseWork(course.code)]);
  const count = (unit: string, part?: string) =>
    work.filter((s) => s.unitCode === unit && s.status === "Submitted" && (!part || s.part === part)).length;
  const total = work.filter((s) => s.status === "Submitted").length;

  return (
    <div className="animate-fade-up space-y-8">
      <Link href="/trainer/marking" className="inline-flex items-center gap-2 text-sm text-ink/55 transition hover:text-plum">
        <BackIcon className="h-4 w-4" />
        All courses
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-plum">{course.code}</p>
          <h1 className="mt-1 text-2xl font-medium text-ink sm:text-[1.65rem]">{course.name}</h1>
          <p className="mt-1 text-sm text-ink">Open a unit to mark its Theory Task and Workplacement Task.</p>
        </div>
        <div className="min-w-48 rounded-[1.5rem] bg-lilac px-5 py-4">
          <p className="text-2xl font-medium text-ink">{total}</p>
          <p className="mt-1 text-xs text-ink/50">waiting to be marked in this course</p>
        </div>
      </div>

      <ol className="space-y-3">
        {course.units.map((u, i) => {
          const a = assessments[u.code];
          const set = a ? summarise(a) : null;
          const n = count(u.code);
          return (
            <li key={u.code}>
              <Link
                href={`/trainer/marking/course/${encodeURIComponent(course.code)}/${encodeURIComponent(u.code)}`}
                className="group grid gap-4 rounded-[1.5rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] transition hover:border-plum/20 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lilac text-sm font-medium text-plum">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-plum">{u.code}</p>
                    <p className="font-medium leading-snug text-ink">{u.title}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {MARKED_PARTS.map((p) => {
                        const on = !!set?.[p.key];
                        const m = count(u.code, p.key);
                        return (
                          <span
                            key={p.key}
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                              !on ? "bg-lilac/60 text-ink/30 line-through" : m ? "bg-amber-100 text-amber-700" : "bg-lilac text-ink/55"
                            }`}
                          >
                            {p.label}
                            {m ? ` · ${m} to mark` : ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 lg:justify-end">
                  {!a ? (
                    <span className="flex items-center gap-1.5 text-xs text-ink/40">
                      <ClipboardIcon className="h-4 w-4" />
                      Not set up yet
                    </span>
                  ) : n ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">{n} to mark</span>
                  ) : (
                    <span className="text-xs text-ink/40">Nothing to mark</span>
                  )}
                  <ArrowRightIcon className="h-4 w-4 text-ink/30 transition group-hover:translate-x-0.5 group-hover:text-plum" />
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
