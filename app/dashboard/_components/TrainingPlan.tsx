import Link from "next/link";
import DueLabel from "../assessment/_components/DueLabel";
import { getCourse } from "@/lib/courses";
import { studentModuleDues } from "@/lib/deadlines";
import { listStudentSubmissions } from "@/lib/submissions";
import { listHiddenUnits } from "@/lib/hidden-units";
import type { StudentDTO } from "@/lib/students";
import { listUnitRecords } from "@/lib/unit-records";
import { unitAccess, unitStatusStyle } from "@/lib/unit-status-meta";

// The student's training plan: every unit of each enrolled course with its status. Only an open unit has a button;
// a unit with a non-active status (e.g. Competent) shows just its name and status. Shown on My classes.
export default async function TrainingPlan({ student }: { student: StudentDTO }) {
  const courses = (
    await Promise.all(
      student.courses.map(async (c) => {
        const [course, hidden, records, dues, subs] = await Promise.all([
          getCourse(c.code),
          listHiddenUnits(student.studentId, c.code),
          listUnitRecords(student.studentId, c.code),
          studentModuleDues(student.studentId, c.code),
          listStudentSubmissions(student.studentId, c.code),
        ]);
        if (!course) return [];
        // A unit's next deadline: the earliest due date of a module still waiting on the student (not handed in, or sent back)
        const handedIn = new Set(subs.filter((x) => x.status === "Submitted" || x.status === "Accepted").map((x) => `${x.unitCode}/${x.part}`));
        const nextDue = (unitCode: string) =>
          Object.entries(dues)
            .filter(([k, d]) => d && k.startsWith(`${unitCode}/`) && !handedIn.has(k))
            .map(([, d]) => d!)
            .sort()[0] ?? null;
        const units = course.units
          .filter((u) => !hidden.has(u.code))
          .map((u) => ({ ...u, record: records[u.code] ?? null, access: unitAccess(records[u.code] ?? null), due: nextDue(u.code) }));
        return [{ course, units }];
      }),
    )
  ).flat();
  if (!courses.length) return null;

  return (
    <section aria-labelledby="plan-heading" className="space-y-4">
      <h2 id="plan-heading" className="text-2xl font-semibold text-ink sm:text-3xl">
        Your training plan
      </h2>
      {courses.map(({ course, units }) => (
        <div key={course.code} className="space-y-2">
          {courses.length > 1 && (
            <p className="text-base font-semibold text-plum">
              {course.code} · {course.name}
            </p>
          )}
          <ol className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white">
            {units.map((u, i) => {
              const nonActive = u.record && u.record.status !== "Active";
              return (
                <li key={u.code} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${u.access.open ? "bg-emerald-600 text-white" : "bg-lilac text-ink"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-ink">{u.title}</span>
                    <span className="block text-sm text-ink">{u.code}</span>
                    {u.due && !nonActive && (
                      <span className="mt-1 block text-sm font-semibold">
                        <DueLabel dueAt={u.due} />
                      </span>
                    )}
                  </span>
                  {nonActive ? (
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${unitStatusStyle[u.record!.status]}`}>{u.record!.status}</span>
                  ) : u.access.open ? (
                    <Link
                      href={`/dashboard/assessment/${encodeURIComponent(u.code)}?course=${encodeURIComponent(course.code)}`}
                      className="rounded-xl bg-plum px-4 py-2 text-sm font-semibold text-white transition hover:bg-plum-light"
                    >
                      Open unit
                    </Link>
                  ) : (
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-800">{u.access.reason}</span>
                  )}
                </li>
              );
            })}
            {!units.length && <li className="px-4 py-3 text-base text-ink">The college hasn’t added units yet.</li>}
          </ol>
        </div>
      ))}
    </section>
  );
}
