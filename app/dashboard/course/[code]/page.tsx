import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import CourseDetails, { type ClassTime, type DetailUnit, type SessionItem } from "./CourseDetails";
import { InfoIcon } from "../../_components/icons";
import { requireStudent } from "@/lib/auth";
import { formatClassTime } from "@/lib/batch-meta";
import { getCourse } from "@/lib/courses";
import { courseStatusStyle } from "@/lib/course-status";
import { imageUrl } from "@/lib/display-image-meta";
import { listPlacementDocs, listSignedDocs } from "@/lib/documents";
import { getBatch } from "@/lib/groups";
import { listSessions } from "@/lib/class-sessions";
import { listHiddenUnits } from "@/lib/hidden-units";
import { canJoin, sessionState, sessionWhen } from "@/lib/session-meta";
import { logStudent } from "@/lib/student-logs";
import { getStudent, hasCourse, isWithdrawn } from "@/lib/students";
import { studentCourseTrainers } from "@/lib/trainer-access";
import { listUnitRecords } from "@/lib/unit-records";
import { unitAccess } from "@/lib/unit-status-meta";

const requestTime = () => Date.now();

// "View course": the course's units (and when each opens), its documents, placement pack and trainer, plus class times.
// Each open unit links to the unit player (/dashboard/assessment/[unit]).
export default async function CourseDetailsPage(props: PageProps<"/dashboard/course/[code]">) {
  const session = await requireStudent();
  const code = decodeURIComponent((await props.params).code);
  const student = await getStudent(session.sub);
  const course = student && hasCourse(student, code) ? await getCourse(code) : null;
  if (!student || !course) notFound();
  if (isWithdrawn(student, course.code)) redirect("/dashboard/course"); // closed: the course card says Withdrawn

  await logStudent({ studentId: student.studentId, studentName: student.name, courseCode: course.code, action: "Opened course", detail: course.name }, 30);
  const [hidden, records, placementDocs, signed, trainerRows, batches] = await Promise.all([
    listHiddenUnits(student.studentId, course.code),
    listUnitRecords(student.studentId, course.code),
    listPlacementDocs([course.code]),
    listSignedDocs(student.studentId),
    studentCourseTrainers(student.batchIds, course.code),
    Promise.all(student.batchIds.map((id) => getBatch(id))),
  ]);

  const units: DetailUnit[] = course.units
    .filter((u) => !hidden.has(u.code))
    .map((u) => {
      const rec = records[u.code] ?? null;
      const access = unitAccess(rec);
      const href = `/dashboard/assessment/${encodeURIComponent(u.code)}?course=${encodeURIComponent(course.code)}`;
      if (rec && rec.status !== "Active") return { code: u.code, title: u.title, href, open: false, state: "closed", label: rec.status };
      if (access.open) return { code: u.code, title: u.title, href, open: true, state: "open", label: "Active" };
      if (access.reason?.startsWith("Opens ")) return { code: u.code, title: u.title, href, open: false, state: "scheduled", label: access.reason };
      return { code: u.code, title: u.title, href, open: false, state: "locked", label: "Not open yet" };
    });

  const placement = [{ code: course.code, name: course.name, text: course.placementText, docs: placementDocs }];
  const trainers = trainerRows.map(({ trainerId, name, email, batch, photo }) => ({ trainerId, name, email, batch, photo }));
  // weekly class times of the student's batch for this course
  const classes: ClassTime[] = batches
    .filter((b) => b?.courseCode === course.code)
    .flatMap((b) => b!.classes.map((c) => ({ id: c.id, day: c.day, time: formatClassTime(c.time), link: c.link })));
  // one-off class sessions of those batches that haven't ended (workshops, revision classes…), soonest first
  const now = requestTime();
  const courseBatchIds = batches.flatMap((b) => (b?.courseCode === course.code ? [b.batchId] : []));
  const sessions: SessionItem[] = (await listSessions(courseBatchIds))
    .filter((s) => sessionState(s, now) !== "ended")
    .map((s) => ({
      id: s.sessionId,
      title: s.title,
      when: sessionWhen(s),
      unit: s.unitCode ? (course.units.find((u) => u.code === s.unitCode)?.title ?? s.unitCode) : null,
      trainer: s.trainerName,
      state: sessionState(s, now),
      link: canJoin(s, now) ? s.link : null,
      instructions: s.instructions,
    }));
  const status = student.courses.find((c) => c.code === course.code)?.status ?? "Active";

  return (
    <div className="s-dashboard-center animate-fade-up space-y-6 pt-6 sm:pt-10">
      {/* Header: course picture, breadcrumb, name, code and status; Need help on the right */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-5">
          {course.thumbnail && (
            // the course picture Super Admin uploaded
            // eslint-disable-next-line @next/next/no-img-element -- private file served by /api/files
            <img src={imageUrl(course.thumbnail)!} alt="" className="hidden size-24 shrink-0 rounded-3xl object-cover shadow-sm sm:block" />
          )}
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="text-sm text-ink/70">
              <Link href="/dashboard/course" className="hover:text-ink hover:underline">
                My courses
              </Link>
              <span aria-hidden> / </span>
              <span className="text-ink">{course.name}</span>
            </nav>
            <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{course.name}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-3 text-base">
              <span className="text-ink/70">{course.code}</span>
              <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${courseStatusStyle[status]}`}>{status}</span>
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/tickets"
          className="s-card inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-ink backdrop-blur-xl transition hover:-translate-y-0.5"
        >
          <InfoIcon className="h-5 w-5" />
          Need help?
        </Link>
      </div>

      <CourseDetails
        units={units}
        placement={placement}
        initialSigned={signed}
        trainers={trainers}
        classes={classes}
        sessions={sessions}
      />
    </div>
  );
}
