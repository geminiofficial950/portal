import Link from "next/link";
import { notFound } from "next/navigation";
import { BackIcon } from "../../../../dashboard/_components/icons";
import { requireAdmin } from "@/lib/auth";
import { listCourses } from "@/lib/courses";
import { formatStamp } from "@/lib/format";
import { listStudentLogs } from "@/lib/student-logs";
import { getStudent } from "@/lib/students";

const SHOWN = 500;

// Everything this student did in the portal, newest first, with a CSV download (Admins and Super Admin)
export default async function StudentLogsPage(props: PageProps<"/superadmin/students/[id]/logs">) {
  await requireAdmin();
  const [{ id }, { course }] = await Promise.all([props.params, props.searchParams]);
  const studentId = decodeURIComponent(id);
  const picked = typeof course === "string" && course ? course : null;
  const [student, allCourses, logs] = await Promise.all([
    getStudent(studentId),
    listCourses(),
    listStudentLogs(studentId, { courseCode: picked, limit: SHOWN }),
  ]);
  if (!student) notFound();
  const nameOf = (code: string) => allCourses.find((c) => c.code === code)?.name ?? code;
  const base = `/superadmin/students/${encodeURIComponent(student.studentId)}/logs`;
  const download = `/api/student-logs/${encodeURIComponent(student.studentId)}${picked ? `?course=${encodeURIComponent(picked)}` : ""}`;
  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-medium transition ${active ? "bg-plum text-white" : "bg-lilac text-ink hover:bg-plum/10"}`;

  return (
    <div className="animate-fade-up space-y-6">
      <Link href={`/superadmin/students/${encodeURIComponent(student.studentId)}`} className="inline-flex items-center gap-2 text-sm font-medium text-ink transition hover:text-plum">
        <BackIcon className="h-4 w-4" />
        Back to {student.name}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-ink sm:text-[1.65rem]">Activity log</h1>
          <p className="mt-1 text-sm text-ink">
            {student.name} · {student.studentId} — everything they did in the portal, newest first (Sydney time).
          </p>
        </div>
        <a href={download} className="rounded-full bg-plum px-5 py-3 text-sm font-medium text-white transition hover:bg-plum-light">
          Download log (CSV)
        </a>
      </div>

      {student.courses.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Link href={base} className={chip(!picked)}>
            All courses
          </Link>
          {student.courses.map((c) => (
            <Link key={c.code} href={`${base}?course=${encodeURIComponent(c.code)}`} className={chip(picked === c.code)}>
              {c.code}
            </Link>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-[1.5rem] border border-ink/10 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm text-ink">
          <thead>
            <tr className="border-b border-ink/10 text-xs font-semibold uppercase tracking-wide text-plum">
              <th className="px-5 py-3">Date and time</th>
              <th className="px-3 py-3">Course</th>
              <th className="px-3 py-3">Unit</th>
              <th className="px-3 py-3">Activity</th>
              <th className="px-5 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i} className="border-b border-ink/5 last:border-0">
                <td className="whitespace-nowrap px-5 py-3 font-medium">{formatStamp(new Date(l.at))}</td>
                <td className="px-3 py-3" title={l.courseCode ? nameOf(l.courseCode) : undefined}>
                  {l.courseCode ?? "—"}
                </td>
                <td className="px-3 py-3">{l.unitCode ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-3 font-semibold">{l.action}</td>
                <td className="px-5 py-3">{l.detail || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="px-5 py-12 text-center text-sm text-ink">Nothing recorded yet.</p>}
      </div>
      {logs.length === SHOWN && (
        <p className="text-sm text-ink">Showing the latest {SHOWN}. Download the log to see everything.</p>
      )}
    </div>
  );
}
