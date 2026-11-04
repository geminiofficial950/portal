import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, BackIcon, CheckIcon } from "../../../../dashboard/_components/icons";
import { MARKED_PARTS, summarise } from "@/lib/assessment-meta";
import { listCourseAssessments } from "@/lib/assessments";
import { requireTrainer } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { listCourseWork } from "@/lib/submissions";

const SHOW = [
  { key: "all", label: "All units" },
  { key: "todo", label: "Needs marking" },
] as const;

// One row per unit, one column per part — like a gradebook
const cols = "md:grid-cols-[2.5rem_minmax(0,1fr)_repeat(3,10rem)_1.25rem]";

// Trainer marking, by course: the units that have an assessment, with the state of each part at a glance.
// Units without one aren't shown — there's nothing a trainer can mark there.
export default async function MarkingCoursePage(props: PageProps<"/trainer/marking/course/[code]">) {
  await requireTrainer();
  const [{ code }, { show: showParam }] = await Promise.all([props.params, props.searchParams]);
  const course = await getCourse(decodeURIComponent(code));
  if (!course) notFound();

  const [assessments, work] = await Promise.all([listCourseAssessments(course.code), listCourseWork(course.code)]);
  const waiting = (unit: string, part?: string) =>
    work.filter((s) => s.unitCode === unit && s.status === "Submitted" && (!part || s.part === part)).length;
  const handedIn = (unit: string, part: string) => work.some((s) => s.unitCode === unit && s.part === part);
  const total = work.filter((s) => s.status === "Submitted").length;

  const show = SHOW.find((s) => s.key === showParam)?.key ?? "all";
  const assessed = course.units.map((u, i) => ({ ...u, n: i + 1 })).filter((u) => assessments[u.code]);
  const units = show === "todo" ? assessed.filter((u) => waiting(u.code) > 0) : assessed;
  const base = `/trainer/marking/course/${encodeURIComponent(course.code)}`;

  return (
    <div className="animate-fade-up space-y-6">
      <Link href="/trainer/marking" className="inline-flex items-center gap-2 text-sm font-medium text-ink transition hover:text-plum">
        <BackIcon className="h-4 w-4" />
        Marking
      </Link>

      {/* course heading with a quiet stats line */}
      <header className="space-y-3">
        <span className="inline-block rounded-md bg-plum px-2.5 py-1 text-xs font-semibold tracking-wide text-white">{course.code}</span>
        <h1 className="text-2xl font-semibold leading-tight text-ink sm:text-[1.75rem]">{course.name}</h1>
        <dl className="flex flex-wrap gap-3 pt-1">
          {[
            { label: "Units", value: assessed.length, accent: false },
            { label: "To mark", value: total, accent: total > 0 },
          ].map((st) => (
            <div
              key={st.label}
              className={`min-w-28 rounded-xl px-4 py-2.5 ${st.accent ? "bg-plum text-white" : "border border-ink/10 bg-white text-ink"}`}
            >
              <dd className="text-2xl font-semibold leading-none">{st.value}</dd>
              <dt className="mt-1 text-xs font-medium">{st.label}</dt>
            </div>
          ))}
        </dl>
      </header>

      {/* show filter */}
      <nav aria-label="Show units" className="inline-flex rounded-full bg-[#f6f5fa] p-1 ring-1 ring-ink/10">
        {SHOW.map((s) => (
          <Link
            key={s.key}
            href={s.key === "all" ? base : `${base}?show=${s.key}`}
            scroll={false}
            aria-current={show === s.key ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${show === s.key ? "bg-plum text-white shadow-sm" : "text-ink hover:text-plum"}`}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-[0_16px_40px_-24px_rgba(91,63,153,0.35)]">
        {/* column heads */}
        <div className={`hidden gap-4 border-b border-ink/10 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-plum md:grid ${cols}`}>
          <span>#</span>
          <span>Unit</span>
          {MARKED_PARTS.map((p) => (
            <span key={p.key}>{p.label.replace(" and Activities", "")}</span>
          ))}
          <span />
        </div>

        {units.length ? (
          <ol>
            {units.map((u) => {
              const a = assessments[u.code];
              const set = a ? summarise(a) : null;
              const todo = waiting(u.code) > 0;
              return (
                <li key={u.code} className="border-t border-ink/10 first:border-t-0">
                  <Link
                    href={`${base}/${encodeURIComponent(u.code)}`}
                    className={`group grid grid-cols-[2.5rem_minmax(0,1fr)_1.25rem] items-center gap-x-4 gap-y-3 px-5 py-4 transition hover:bg-[#faf8ff] ${cols} ${
                      todo ? "bg-[#fffaf0] shadow-[inset_4px_0_0_#5b3f99]" : ""
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-lg text-sm font-semibold ${waiting(u.code) ? "bg-plum text-white" : "bg-[#efeaf9] text-plum"}`}
                    >
                      {u.n}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold tracking-wide text-plum">{u.code}</span>
                      <span className="block font-medium leading-snug text-ink md:truncate">{u.title}</span>
                    </span>

                    {/* one cell per part; on phones they wrap under the title. Only work to mark is coloured. */}
                    <span className="col-span-3 col-start-1 flex flex-wrap gap-x-4 gap-y-2 md:contents">
                      {MARKED_PARTS.map((p) => {
                        const m = waiting(u.code, p.key);
                        return (
                          <span key={p.key} className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-plum md:hidden">{p.label.replace(" and Activities", "")}</span>
                            {!set?.[p.key] ? (
                              <span className="text-sm text-ink">—</span>
                            ) : m ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                {m} to mark
                              </span>
                            ) : handedIn(u.code, p.key) ? (
                              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100">
                                  <CheckIcon className="h-3 w-3" />
                                </span>
                                Done
                              </span>
                            ) : (
                              <span className="text-sm text-ink" title="No work handed in yet">
                                —<span className="sr-only">No work yet</span>
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </span>

                    <ArrowRightIcon className="col-start-3 row-start-1 h-4 w-4 justify-self-end text-ink transition group-hover:translate-x-0.5 group-hover:text-plum md:col-start-auto md:row-start-auto" />
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="px-5 py-10 text-center text-sm font-medium text-ink">
            {show === "todo" ? "Nothing to mark in this course." : "No assessments in this course yet."}
          </p>
        )}
      </div>
    </div>
  );
}
