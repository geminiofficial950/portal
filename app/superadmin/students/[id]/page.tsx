import Link from "next/link";
import { notFound } from "next/navigation";
import { BackIcon } from "../../../dashboard/_components/icons";
import StudentCoursesPanel from "./StudentCoursesPanel";
import StudentDocumentsPanel from "./StudentDocumentsPanel";
import StudentNotes from "./StudentNotes";
import { requireAdmin } from "@/lib/auth";
import { listCourses } from "@/lib/courses";
import { listPlacementDocs, listRequests, listSignedDocs } from "@/lib/documents";
import { initials } from "@/lib/format";
import { listBatches } from "@/lib/groups";
import { getStudentProgress } from "@/lib/progress";
import { listStudentNotes, trainersOfStudent } from "@/lib/student-notes";
import { getStudent, type StudentDTO } from "@/lib/students";

const accountTone: Record<StudentDTO["status"], string> = {
  Active: "bg-emerald-100 text-emerald-800",
  Pending: "bg-amber-100 text-amber-900",
  Suspended: "bg-rose-100 text-rose-800",
};
const accountWord: Record<StudentDTO["status"], string> = { Active: "Enabled", Pending: "Pending", Suspended: "Disabled" };
const day = (v: string | null) => (v ? new Date(`${v}T12:00:00Z`).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—");

// A student's profile: their details, their courses (View opens that course's units in a popup), documents, then staff notes
export default async function AdminStudentProgressPage(props: PageProps<"/superadmin/students/[id]">) {
  const admin = await requireAdmin();
  const [{ id }, { course }] = await Promise.all([props.params, props.searchParams]);
  const studentId = decodeURIComponent(id);
  const student = await getStudent(studentId);
  if (!student) notFound();
  const viewing = typeof course === "string" && student.courses.some((c) => c.code === course) ? course : null;
  const [progress, allCourses, batches, placementDocs, signed, requests, notes, trainers] = await Promise.all([
    viewing ? getStudentProgress(studentId, viewing) : null,
    listCourses(),
    listBatches(),
    listPlacementDocs(student.courses.map((c) => c.code)),
    listSignedDocs(student.studentId),
    listRequests(student.studentId),
    listStudentNotes(student.studentId, { role: "admin", id: admin.sub }),
    trainersOfStudent(student.studentId),
  ]);
  const nameOf = (code: string) => allCourses.find((c) => c.code === code)?.name ?? code;
  const baseHref = `/superadmin/students/${encodeURIComponent(student.studentId)}`;
  const batchNames = batches.filter((b) => student.batchIds.includes(b.batchId)).map((b) => b.name);

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/superadmin/students" className="inline-flex items-center gap-2 text-sm text-ink transition hover:text-plum">
          <BackIcon className="h-4 w-4" />
          All students
        </Link>
        {admin.isSuper && (
          <Link href={`${baseHref}/logs`} className="rounded-full bg-lilac px-5 py-2.5 text-sm font-medium text-plum transition hover:bg-plum/10">
            Activity log
          </Link>
        )}
      </div>

      {/* Student details */}
      <section aria-label="Student details" className="rounded-[1.5rem] border border-ink/10 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-plum text-xl font-bold text-white">{initials(student.name)}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-ink">{student.name}</h1>
            <p className="text-sm text-ink">{student.studentId}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${accountTone[student.status]}`}>Account {accountWord[student.status]}</span>
        </div>
        <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Email", student.email],
            ["Start date", day(student.startDate)],
            ["End date", day(student.endDate)],
            ["Enrolled", student.enrolled],
            ["Courses", student.courses.map((c) => c.code).join(", ")],
            ["Batch", batchNames.join(", ") || "No batch"],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-sm font-semibold text-ink">{label}</dt>
              <dd className="break-words text-base text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <StudentCoursesPanel
        key={student.courses.map((c) => c.code).join()}
        studentId={student.studentId}
        name={student.name}
        initial={student.courses.map((c) => ({ ...c, name: nameOf(c.code) }))}
        allCourses={allCourses.map(({ code, name }) => ({ code, name }))}
        isSuper={admin.isSuper}
        initialView={progress}
        batches={batches.map((b) => ({ batchId: b.batchId, name: b.name, courseCode: b.courseCode }))}
      />

      <StudentDocumentsPanel
        studentId={student.studentId}
        name={student.name}
        courseCodes={student.courses.map((c) => c.code)}
        placementDocs={placementDocs}
        signed={signed}
        initialRequests={requests}
      />

      <StudentNotes studentId={student.studentId} role="admin" trainers={trainers} initial={notes} />
    </div>
  );
}
