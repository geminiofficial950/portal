import Link from "next/link";
import { notFound } from "next/navigation";
import CourseTabs from "../../../dashboard/_components/CourseTabs";
import { BackIcon } from "../../../dashboard/_components/icons";
import StudentProgress from "../../../dashboard/_components/StudentProgress";
import { requireTrainer } from "@/lib/auth";
import { listCourses } from "@/lib/courses";
import { getStudentProgress } from "@/lib/progress";
import { getSettings } from "@/lib/settings";
import { getStudent } from "@/lib/students";

export default async function TrainerStudentProgressPage(props: PageProps<"/trainer/students/[id]">) {
  await requireTrainer();
  const [{ id }, { course }] = await Promise.all([props.params, props.searchParams]);
  const studentId = decodeURIComponent(id);
  const [progress, student, settings, allCourses] = await Promise.all([
    getStudentProgress(studentId, typeof course === "string" ? course : null),
    getStudent(studentId),
    getSettings(),
    listCourses(),
  ]);
  if (!progress || !student) notFound();

  return (
    <div className="animate-fade-up space-y-6">
      <Link href="/trainer/students" className="inline-flex items-center gap-2 text-sm text-ink/55 transition hover:text-plum">
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
        initial={{ ...progress, units: progress.units.map((u) => ({ ...u, photos: [] })) }}
        canGrade={settings.trainerPermissions.markAssessments}
        canClear={false}
        canUnlock
        workHrefBase={`/trainer/students/${progress.student.studentId}`}
      />
    </div>
  );
}
