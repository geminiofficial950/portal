import Link from "next/link";
import { ArrowRightIcon, BookIcon, ClipboardIcon } from "../_components/icons";
import DueLabel from "./_components/DueLabel";
import { ASSESSMENT_PARTS, summarise } from "@/lib/assessment-meta";
import { listCourseAssessments } from "@/lib/assessments";
import { requireStudent } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { listStudentDueDates } from "@/lib/due-dates";
import { statusStyle } from "@/lib/submission-meta";
import { getStudent } from "@/lib/students";
import { listStudentSubmissions } from "@/lib/submissions";
import { countResources } from "@/lib/unit-content";
import { resultStyle } from "@/lib/unit-meta";
import { listStudentResults } from "@/lib/unit-results";

export default async function AssessmentsPage() {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  const course = student ? await getCourse(student.course) : null;

  if (!student || !course) {
    return (
      <div className="animate-fade-up rounded-[1.75rem] bg-lilac/70 px-6 py-12 text-center text-sm text-ink/60">
        You’re not enrolled in a course yet. Please contact the college.
      </div>
    );
  }

  const [assessments, submissions, results, resourceCounts, ownDue] = await Promise.all([
    listCourseAssessments(course.code),
    listStudentSubmissions(student.studentId, course.code),
    listStudentResults(student.studentId, course.code),
    countResources(course.code),
    listStudentDueDates(student.studentId, course.code),
  ]);
  const resultOf = (unit: string) => results.find((r) => r.unitCode === unit);
  const statusOf = (unit: string, part: string) =>
    submissions.find((s) => s.unitCode === unit && s.part === part)?.status ?? "Not started";

  // Only parts the college has actually set up count towards progress
  let total = 0;
  let accepted = 0;
  for (const u of course.units) {
    const a = assessments[u.code];
    if (!a) continue;
    const set = summarise(a);
    for (const p of ASSESSMENT_PARTS) {
      if (!set[p.key]) continue;
      total++;
      if (statusOf(u.code, p.key) === "Accepted") accepted++;
    }
  }

  return (
    <div className="animate-fade-up space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-plum">{course.code}</p>
          <h1 className="mt-1 text-2xl font-medium text-ink sm:text-[1.65rem]">{course.name}</h1>
          <p className="mt-1 text-sm text-ink/55">Each unit: read the overview and resources, then complete the quiz, theory, role play and workplace task.</p>
        </div>
        <div className="min-w-56 rounded-[1.5rem] bg-lilac px-5 py-4">
          <p className="text-2xl font-medium text-ink">
            {accepted}
            <span className="text-base text-ink/40"> / {total}</span>
          </p>
          <p className="mt-1 text-xs text-ink/50">
            parts accepted · {results.filter((r) => r.result === "Pass").length} of {course.units.length} units passed
          </p>
          <div className="mt-3 h-1.5 rounded-full bg-white">
            <div className="h-full rounded-full bg-plum" style={{ width: `${total ? (accepted / total) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      <ol className="space-y-3">
        {course.units.map((u, i) => {
          const a = assessments[u.code];
          const set = a ? summarise(a) : null;
          return (
            <li key={u.code}>
              <Link
                href={`/dashboard/assessment/${encodeURIComponent(u.code)}`}
                className="group grid gap-4 rounded-[1.5rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] transition hover:border-plum/20 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lilac text-sm font-medium text-plum">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-plum">{u.code}</p>
                    <p className="font-medium leading-snug text-ink">{u.title}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ASSESSMENT_PARTS.map((p) => {
                        const s = set?.[p.key] ? statusOf(u.code, p.key) : null;
                        return (
                          <span
                            key={p.key}
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${s ? statusStyle[s] : "bg-lilac/60 text-ink/30 line-through"}`}
                            title={s ? `${p.label}: ${s}` : `${p.label}: not set for this unit`}
                          >
                            {p.label}
                            {s && s !== "Not started" ? ` · ${s}` : ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 lg:justify-end">
                  {resultOf(u.code) && (
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${resultStyle[resultOf(u.code)!.result]}`}>
                      Final: {resultOf(u.code)!.result}
                    </span>
                  )}
                  {!!resourceCounts[u.code] && (
                    <span className="flex items-center gap-1.5 text-xs text-ink/50">
                      <BookIcon className="h-4 w-4" />
                      {resourceCounts[u.code]} resource{resourceCounts[u.code] === 1 ? "" : "s"}
                    </span>
                  )}
                  {a ? (
                    <DueLabel dueAt={ownDue[u.code] ?? a.dueAt} />
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-ink/40">
                      <ClipboardIcon className="h-4 w-4" />
                      Not set up yet
                    </span>
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
