import Link from "next/link";
import { notFound } from "next/navigation";
import CourseTabs from "../../../dashboard/_components/CourseTabs";
import { BackIcon } from "../../../dashboard/_components/icons";
import StudentProgress from "../../../dashboard/_components/StudentProgress";
import StudentCoursesPanel from "./StudentCoursesPanel";
import StudentDocumentsPanel from "./StudentDocumentsPanel";
import { requireAdmin } from "@/lib/auth";
import { listCourses } from "@/lib/courses";
import { listPlacementDocs, listRequests, listSignedDocs } from "@/lib/documents";
import { getStudentProgress } from "@/lib/progress";
import { getStudent } from "@/lib/students";

export default async function AdminStudentProgressPage(props: PageProps<"/superadmin/students/[id]">) {
  const admin = await requireAdmin();
  const [{ id }, { course }] = await Promise.all([props.params, props.searchParams]);
  const studentId = decodeURIComponent(id);
  const [progress, student, allCourses] = await Promise.all([
    getStudentProgress(studentId, typeof course === "string" ? course : null),
    getStudent(studentId),
    listCourses(),
  ]);
  if (!progress || !student) notFound();
  const [placementDocs, signed, requests] = await Promise.all([
    listPlacementDocs(student.courses.map((c) => c.code)),
    listSignedDocs(student.studentId),
    listRequests(student.studentId),
  ]);
  const nameOf = (code: string) => allCourses.find((c) => c.code === code)?.name ?? code;

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/superadmin/students" className="inline-flex items-center gap-2 text-sm text-ink/55 transition hover:text-plum">
          <BackIcon className="h-4 w-4" />
          All students
        </Link>
        <Link
          href={`/superadmin/students/${encodeURIComponent(student.studentId)}/logs`}
          className="rounded-full bg-lilac px-5 py-2.5 text-sm font-medium text-plum transition hover:bg-plum/10"
        >
          Activity log
        </Link>
      </div>
      <StudentCoursesPanel
        key={student.courses.map((c) => c.code).join()}
        studentId={student.studentId}
        name={student.name}
        initial={student.courses.map((c) => ({ ...c, name: nameOf(c.code) }))}
        allCourses={allCourses.map(({ code, name }) => ({ code, name }))}
      />
      <StudentDocumentsPanel
        studentId={student.studentId}
        name={student.name}
        courseCodes={student.courses.map((c) => c.code)}
        placementDocs={placementDocs}
        signed={signed}
        initialRequests={requests}
      />
      <CourseTabs
        baseHref={`/superadmin/students/${student.studentId}`}
        courses={student.courses.map((c) => ({ code: c.code, name: nameOf(c.code) }))}
        current={progress.course.code}
      />
      <StudentProgress
        key={progress.course.code}
        initial={progress}
        canGrade
        canClear
        showPhotos
        canChangeDue={admin.isSuper}
        canHide
        canUnlock
        workHrefBase={`/superadmin/students/${progress.student.studentId}`}
      />
    </div>
  );
}
