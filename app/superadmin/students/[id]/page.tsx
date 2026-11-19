import Link from "next/link";
import { notFound } from "next/navigation";
import { BackIcon } from "../../../dashboard/_components/icons";
import StudentCoursesPanel from "./StudentCoursesPanel";
import StudentDocumentsPanel from "./StudentDocumentsPanel";
import StudentNotes from "./StudentNotes";
import StudentProfileCard from "./StudentProfileCard";
import { requireAdmin } from "@/lib/auth";
import { listCourses } from "@/lib/courses";
import { listPlacementDocs, listRequests, listSignedDocs } from "@/lib/documents";
import { listBatches } from "@/lib/groups";
import { getStudentProgress } from "@/lib/progress";
import { listStudentNotes, trainersOfStudent } from "@/lib/student-notes";
import { getStudent } from "@/lib/students";


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

      {/* Student details (Edit details: Admin edits name, phone, state, notes; Super Admin also the login) */}
      <StudentProfileCard key={student.studentId} student={student} batchNames={batchNames} canEditLogin={admin.isSuper} />

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
