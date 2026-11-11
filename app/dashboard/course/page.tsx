import Link from "next/link";
import { ArrowRightIcon, BookIcon, BoxIcon, CheckIcon, ClipboardIcon, ClockIcon } from "../_components/icons";
import CourseIllustration from "./CourseIllustration";
import { requireStudent } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { courseStatusStyle } from "@/lib/course-status";
import { listPlacementDocs, listSignedDocs } from "@/lib/documents";
import { listHiddenUnits } from "@/lib/hidden-units";
import { getStudent } from "@/lib/students";
import { listUnitRecords } from "@/lib/unit-records";
import { unitAccess } from "@/lib/unit-status-meta";
import StudentDocuments from "./StudentDocuments";

// Every course the student is enrolled in, at a glance (with its course status), then Course documents and the Placement pack.
// The training plan (units with status) is on My classes; documents the college asked for are on Requests.
// "Go to my course" opens the course details page (units + learning content).
export default async function CoursePage() {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  const courses = student
    ? (
        await Promise.all(
          student.courses.map(async (c) => {
            const [course, hidden, records] = await Promise.all([getCourse(c.code), listHiddenUnits(student.studentId, c.code), listUnitRecords(student.studentId, c.code)]);
            const units = (course?.units ?? [])
              .filter((u) => !hidden.has(u.code))
              .map((u) => ({ ...u, record: records[u.code] ?? null, access: unitAccess(records[u.code] ?? null) }));
            return course ? [{ course, status: c.status, visibleUnits: units.length, units }] : [];
          }),
        )
      ).flat()
    : [];

  if (!student || courses.length === 0) {
    return (
      <div className="animate-fade-up rounded-[1.75rem] bg-lilac/70 px-6 py-12 text-center text-sm text-ink">
        You’re not enrolled in a course yet. Please contact the college.
      </div>
    );
  }

  const [placementDocs, signed] = await Promise.all([listPlacementDocs(courses.map((c) => c.course.code)), listSignedDocs(student.studentId)]);

  const totalUnits = courses.reduce((n, c) => n + c.visibleUnits, 0);

  return (
    <div className="animate-fade-up space-y-10">
      {/* Overview */}
      <section aria-labelledby="overview-heading" className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-plum">Overview</p>
          <h1 id="overview-heading" className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">
            My learning
          </h1>
          <p className="mt-1 text-base text-ink">A quick look at what you’re studying.</p>
        </div>
        <div className="flex flex-wrap items-center gap-5 rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.2)] sm:p-6">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-lilac text-plum">
            <BookIcon className="h-8 w-8" />
          </span>
          <div className="min-w-40 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-plum">Current learning</p>
            <p className="mt-1 text-3xl font-semibold text-ink">{courses.length}</p>
            <p className="text-base text-ink">
              Enrolled {courses.length === 1 ? "course" : "courses"} · {totalUnits} units
            </p>
          </div>
          <a
            href="#my-courses"
            className="w-full rounded-xl border border-plum/30 bg-lilac px-5 py-3 text-center text-sm font-semibold text-plum transition hover:bg-plum hover:text-white sm:w-auto"
          >
            View my courses
          </a>
        </div>
      </section>

      {/* One card per course */}
      <section id="my-courses" aria-labelledby="courses-heading" className="scroll-mt-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="courses-heading" className="text-2xl font-semibold text-ink sm:text-3xl">
              My courses
            </h2>
            <p className="mt-1 text-base text-ink">Continue learning from your enrolled courses.</p>
          </div>
          <span className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink">
            {courses.length} {courses.length === 1 ? "course" : "courses"}
          </span>
        </div>

        <ul className="space-y-5">
          {courses.map(({ course, status, visibleUnits }) => (
            <li key={course.code}>
              <article
                aria-label={course.name}
                className="grid gap-6 rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.2)] sm:p-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]"
              >
                <div className="relative overflow-hidden rounded-2xl border border-ink/10">
                  <CourseIllustration className="block h-48 w-full sm:h-56 lg:h-full lg:min-h-56" />
                  <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-plum shadow-sm">
                    Course
                  </span>
                </div>

                <div className="flex min-w-0 flex-col gap-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-plum">Your course</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-semibold leading-snug text-ink sm:text-2xl">{course.name}</h3>
                    </div>
                    <p className="mt-2 flex items-center gap-2 text-base text-ink">
                      <span className="text-lg font-semibold text-plum">#</span>
                      <span className="font-mono">{course.code}</span>
                      <span aria-hidden>·</span>
                      {course.category}
                    </p>
                    {course.description && <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-ink">{course.description}</p>}
                  </div>

                  <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                    {[
                      { label: "Units", value: visibleUnits, icon: BoxIcon },
                      { label: "Duration", value: course.duration, icon: ClockIcon },
                      {
                        label: "Work placement",
                        value: course.placementHours === null ? "To be confirmed" : `${course.placementHours} hours`,
                        icon: ClipboardIcon,
                      },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-lilac text-plum">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <dt className="text-sm text-ink">{label}</dt>
                          <dd className="text-base font-semibold text-ink">{value}</dd>
                        </span>
                      </div>
                    ))}
                    {/* Course status */}
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-lilac text-plum">
                        <CheckIcon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <dt className="text-sm text-ink">Course status</dt>
                        <dd>
                          <span className={`inline-block rounded-full px-3 py-0.5 text-sm font-semibold ${courseStatusStyle[status]}`}>{status}</span>
                        </dd>
                      </span>
                    </div>
                  </dl>

                  <Link
                    href={`/dashboard/course/${encodeURIComponent(course.code)}`}
                    className="group mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl bg-plum px-6 py-4 text-base font-semibold text-white shadow-lg shadow-plum/25 transition hover:bg-plum-light sm:w-fit"
                  >
                    <BookIcon className="h-5 w-5" />
                    Go to my course
                    <ArrowRightIcon className="h-5 w-5 transition group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </section>

      <div>
        <StudentDocuments
          placement={courses.map(({ course }) => ({
            code: course.code,
            name: course.name,
            text: course.placementText,
            docs: placementDocs.filter((d) => d.courseCode === course.code),
          }))}
          initialSigned={signed}
        />
      </div>
    </div>
  );
}
