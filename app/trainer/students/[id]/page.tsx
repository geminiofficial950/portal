import Link from "next/link";
import { notFound } from "next/navigation";
import CourseTabs from "../../../dashboard/_components/CourseTabs";
import { BackIcon } from "../../../dashboard/_components/icons";
import StudentProgress from "../../../dashboard/_components/StudentProgress";
import StudentDocumentsPanel from "../../../superadmin/students/[id]/StudentDocumentsPanel";
import { listPlacementDocs, listRequests, listSignedDocs } from "@/lib/documents";
import { requireTrainer } from "@/lib/auth";
import { listCourses } from "@/lib/courses";
import { getStudentProgress } from "@/lib/progress";
import { getSettings } from "@/lib/settings";
import { getStudent } from "@/lib/students";
import { trainerScope } from "@/lib/trainer-access";

// A trainer sees a student only while the student is in one of their batches, and only the units assigned to them there
export default async function TrainerStudentProgressPage(props: PageProps<"/trainer/students/[id]">) {
  const trainer = await requireTrainer();
  const [{ id }, { course }] = await Promise.all([props.params, props.searchParams]);
  const studentId = decodeURIComponent(id);
  const [progress, student, settings, allCourses] = await Promise.all([
    getStudentProgress(studentId, typeof course === "string" ? course : null),
    getStudent(studentId),
    getSettings(),
    listCourses(),
  ]);
  if (!progress || !student) notFound();
  const scope = await trainerScope(trainer.trainerId);
  const mine = scope.unitsOf(student.studentId);
  const units = progress.units.filter((u) => mine.has(u.code));
  if (!units.length) notFound();

  return (
    <div className="animate-fade-up space-y-6">
      <Link href="/trainer/students" className="inline-flex items-center gap-2 text-sm text-ink transition hover:text-plum">
        <BackIcon className="h-4 w-4" />
        All students
      </Link>
      <CourseTabs
        baseHref={`/trainer/students/${student.studentId}`}
        courses={student.courses.map((c) => ({ code: c.code, name: allCourses.find((x) => x.code === c.code)?.name ?? c.code }))}
        current={progress.course.code}
      />
      <StudentProgress
        key={progress.course.code}
        initial={{ ...progress, units: units.map((u) => ({ ...u, photos: [] })) }}
        canGrade={settings.trainerPermissions.markAssessments}
        role="trainer"
        workHrefBase={`/trainer/students/${progress.student.studentId}`}
      />
      {/* course documents the student uploaded — a trainer of their current batch can approve or ask for changes */}
      <StudentDocumentsPanel
        reviewOnly
        studentId={student.studentId}
        name={student.name}
        courseCodes={student.courses.map((c) => c.code)}
        placementDocs={await listPlacementDocs(student.courses.map((c) => c.code))}
        signed={await listSignedDocs(student.studentId)}
        initialRequests={await listRequests(student.studentId)}
      />
    </div>
  );
}
