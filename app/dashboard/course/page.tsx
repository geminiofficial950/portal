import Link from "next/link";
import { ArrowRightIcon, BookIcon, BoxIcon, ClipboardIcon, ClockIcon } from "../_components/icons";
import { ASSESSMENT_PARTS, summarise } from "@/lib/assessment-meta";
import { listCourseAssessments } from "@/lib/assessments";
import { requireStudent } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { getStudent } from "@/lib/students";
import { listStudentSubmissions } from "@/lib/submissions";
import { countResources } from "@/lib/unit-content";
import { listStudentResults } from "@/lib/unit-results";

// The student's course at a glance. Units themselves are opened from the Assessment page.
export default async function CoursePage() {
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

  const [resources, assessments, submissions, results] = await Promise.all([
    countResources(course.code),
    listCourseAssessments(course.code),
    listStudentSubmissions(student.studentId, course.code),
    listStudentResults(student.studentId, course.code),
  ]);

  let totalParts = 0;
  let totalAccepted = 0;
  for (const u of course.units) {
    const set = assessments[u.code] ? summarise(assessments[u.code]) : null;
    for (const p of ASSESSMENT_PARTS.filter((p) => set?.[p.key])) {
      totalParts++;
      if (submissions.some((s) => s.unitCode === u.code && s.part === p.key && s.status === "Accepted")) totalAccepted++;
    }
  }
  const passed = results.filter((r) => r.result === "Pass").length;
  const totalResources = Object.values(resources).reduce((n, c) => n + c, 0);

  return (
    <div className="animate-fade-up space-y-8">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-plum">
          {course.code} · {course.release} · {course.category}
        </p>
        <h1 className="mt-1 text-2xl font-medium text-ink sm:text-[1.65rem]">{course.name}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/55">
          <ClockIcon className="h-4 w-4" />
          {course.duration} · {course.units.length} units
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Units", value: course.units.length, icon: BoxIcon, tone: "bg-lilac" },
          { label: "Units passed", value: `${passed} / ${course.units.length}`, icon: ClipboardIcon, tone: "bg-emerald-50" },
          { label: "Resources to read", value: totalResources, icon: BookIcon, tone: "bg-[#ffe8d6]" },
          { label: "Assessment parts accepted", value: `${totalAccepted} / ${totalParts}`, icon: ClipboardIcon, tone: "bg-[#e8f3ff]" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className={`rounded-[1.5rem] p-5 ${tone}`}>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/80 text-plum">
              <Icon className="h-4 w-4" />
            </span>
            <p className="mt-3 text-2xl font-medium text-ink">{value}</p>
            <p className="mt-0.5 text-xs text-ink/50">{label}</p>
          </div>
        ))}
      </div>

      <Link
        href="/dashboard/assessment"
        className="group flex items-center justify-between gap-4 rounded-[1.5rem] bg-plum p-5 text-white shadow-lg shadow-plum/20 transition hover:bg-plum-light sm:p-6"
      >
        <span>
          <span className="block text-base font-medium">Go to my units</span>
          <span className="mt-0.5 block text-sm text-white/70">Read each unit, open its resources and complete the assessment.</span>
        </span>
        <ArrowRightIcon className="h-5 w-5 shrink-0 transition group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
