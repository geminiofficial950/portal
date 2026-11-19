import Link from "next/link";
import CourseTrainer from "./CourseTrainer";
import { imageUrl } from "@/lib/display-image-meta";
import { requireStudent } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { WITHDRAWN_NOTE, type CourseStatus } from "@/lib/course-status";
import { listPlacementDocs, listSignedDocs } from "@/lib/documents";
import { listHiddenUnits } from "@/lib/hidden-units";
import { getStudent } from "@/lib/students";
import { studentCourseTrainers } from "@/lib/trainer-access";
import { listUnitRecords } from "@/lib/unit-records";
import { unitAccess } from "@/lib/unit-status-meta";
import LearningEssentials from "./LearningEssentials";

// Every course the student is enrolled in, at a glance (with its course status), then a "Need help?" phone line.
// Each course has its own Learning essentials box (Course documents, Placement pack) beside it. Quick help is hidden for now.
// The training plan (units with status) is on My classes; documents the college asked for are on Requests.
// "View course" opens the course details page (units + learning content).
const statusDot: Record<CourseStatus, string> = {
  Active: "bg-emerald-600",
  Completed: "bg-sky-600",
  Deferred: "bg-amber-500",
  "Risk of withdrawal": "bg-amber-500",
  Withdrawn: "bg-rose-600",
  Cancelled: "bg-rose-600",
  Inactive: "bg-slate-400",
  Competent: "bg-emerald-600",
  "Not yet competent": "bg-orange-500",
};

export default async function CoursePage() {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  const courses = student
    ? (
        await Promise.all(
          student.courses.map(async (c) => {
            const [course, hidden, records, trainerRows] = await Promise.all([
              getCourse(c.code),
              listHiddenUnits(student.studentId, c.code),
              listUnitRecords(student.studentId, c.code),
              studentCourseTrainers(student.batchIds, c.code),
            ]);
            const units = (course?.units ?? [])
              .filter((u) => !hidden.has(u.code))
              .map((u) => ({ ...u, record: records[u.code] ?? null, access: unitAccess(records[u.code] ?? null) }));
            const trainers = trainerRows.map(({ trainerId, name, email, batch, photo }) => ({ trainerId, name, email, batch, photo }));
            return course ? [{ course, status: c.status, visibleUnits: units.length, units, trainers }] : [];
          }),
        )
      ).flat()
    : [];

  if (!student || courses.length === 0) {
    return (
      <div className="animate-fade-up rounded-[1.75rem] s-card px-6 py-12 text-center text-sm text-ink">
        You’re not enrolled in a course yet. Please contact the college.
      </div>
    );
  }

  const [placementDocs, signed] = await Promise.all([listPlacementDocs(courses.map((c) => c.course.code)), listSignedDocs(student.studentId)]);
  // this course's documents, for its own Learning essentials box
  const docsFor = (course: (typeof courses)[number]["course"]) => [
    { code: course.code, name: course.name, text: course.placementText, docs: placementDocs.filter((d) => d.courseCode === course.code) },
  ];

  const glass = "s-card backdrop-blur-xl backdrop-saturate-150";

  return (
    <div className="s-dashboard-center animate-fade-up space-y-10">
      {/* Header */}
      <div>
        <h1 id="courses-heading" className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          My courses
        </h1>
        <p className="mt-1.5 text-base text-ink/80">Choose a course to continue learning.</p>
      </div>

      <div className="space-y-6">
        {/* One row per course: its card, and its own Learning essentials box beside it (same top, same height) */}
        <ul aria-labelledby="courses-heading" className="space-y-5">
          {courses.map(({ course, status, visibleUnits, trainers }) => (
            <li key={course.code} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
              <article aria-label={course.name} className={`${glass} flex flex-col gap-5 rounded-[1.5rem] p-5`}>
                <div className="flex items-center gap-4">
                  {course.thumbnail ? (
                    // the course picture Super Admin uploaded
                    // eslint-disable-next-line @next/next/no-img-element -- private file served by /api/files
                    <img src={imageUrl(course.thumbnail)!} alt="" className="size-14 shrink-0 rounded-2xl object-cover" />
                  ) : (
                  <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#e3f1df] text-[#2f6b3a]">
                    {/* open book */}
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 6.5C10.5 5.3 8.4 4.75 5.5 4.75c-.8 0-1.5.1-2.25.25v13.5c.75-.15 1.45-.25 2.25-.25 2.9 0 5 .55 6.5 1.75m0-13.5c1.5-1.2 3.6-1.75 6.5-1.75.8 0 1.5.1 2.25.25v13.5c-.75-.15-1.45-.25-2.25-.25-2.9 0-5 .55-6.5 1.75m0-13.5V20" />
                    </svg>
                  </span>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold leading-snug text-ink">{course.name}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
                      <span className="text-ink/70">{course.code}</span>
                      <span className="inline-flex items-center gap-1.5 text-ink">
                        <span aria-hidden className={`size-2 rounded-full ${statusDot[status]}`} />
                        {status}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-[var(--s-line)] pt-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <span className="inline-flex items-center gap-2 text-base text-ink">
                      {/* layers */}
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
                        <path d="m3 12.5 9 5 9-5M3 16.5l9 5 9-5" strokeLinecap="round" />
                      </svg>
                      {visibleUnits} {visibleUnits === 1 ? "unit" : "units"}
                    </span>
                    <span aria-hidden className="h-6 w-px bg-[var(--s-line)]" />
                    {trainers.length > 0 ? (
                      <CourseTrainer trainers={trainers} />
                    ) : (
                      <span className="inline-flex items-center gap-2 text-base text-ink/60">
                        {/* person */}
                        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                          <circle cx="12" cy="8" r="4" />
                          <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
                        </svg>
                        No trainer assigned yet
                      </span>
                    )}
                  </div>
                  {status === "Withdrawn" ? (
                    <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800">{WITHDRAWN_NOTE}</p>
                  ) : (
                    <Link
                      href={`/dashboard/course/${encodeURIComponent(course.code)}`}
                      className="inline-flex items-center rounded-xl bg-[#1677f2] px-5 py-2.5 text-base font-semibold text-white transition hover:bg-[#0f66d6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1677f2]"
                    >
                      View course
                    </Link>
                  )}
                </div>
              </article>

              {/* Learning essentials for this course (not for a withdrawn course) */}
              {status !== "Withdrawn" && <LearningEssentials placement={docsFor(course)} initialSigned={signed} />}
            </li>
          ))}
        </ul>

        <p className="px-1 text-base">
          <span className="text-ink/70">Need help? Call us on</span>{" "}
          <a href="tel:1800069877" className="font-medium text-ink hover:underline">
            1800 069 877
          </a>
        </p>

        {/* Quick help — hidden for now. To bring it back: uncomment, and add ChevronDownIcon, MailIcon, PhoneIcon
            (from "../_components/icons") to the imports.
        <aside aria-labelledby="quick-help-heading" className={`${glass} rounded-[1.75rem] p-5 xl:sticky xl:top-6`}>
          <h2 id="quick-help-heading" className="text-xl font-bold text-ink">
            Quick help
          </h2>
          <ul className="mt-4 space-y-3">
            {[
              { label: "Contact administration", href: "mailto:admin@stellacollege.edu.au", icon: MailIcon, tone: "bg-[#d9f2ea]" },
              { label: "1800 069 877", href: "tel:1800069877", icon: PhoneIcon, tone: "bg-[#ece4fb]" },
            ].map(({ label, href, icon: Icon, tone }) => (
              <li key={label}>
                <a
                  href={href}
                  className="group flex items-center gap-3 rounded-2xl border border-[var(--s-line)] bg-[var(--s-soft)]/60 p-2.5 pr-4 text-base font-semibold text-ink transition hover:bg-[var(--s-soft)]"
                >
                  <span className={`grid size-11 shrink-0 place-items-center rounded-xl text-[#172027] ${tone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">{label}</span>
                  <ChevronDownIcon className="h-5 w-5 shrink-0 -rotate-90 transition group-hover:translate-x-0.5" />
                </a>
              </li>
            ))}
          </ul>
        </aside>
        */}

      </div>

    </div>
  );
}
