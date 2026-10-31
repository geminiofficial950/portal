import Link from "next/link";
import { notFound } from "next/navigation";
import { BackIcon } from "../../../dashboard/_components/icons";
import StudentProgress from "../../../dashboard/_components/StudentProgress";
import { requireAdmin } from "@/lib/auth";
import { getStudentProgress } from "@/lib/progress";

export default async function AdminStudentProgressPage(props: PageProps<"/superadmin/students/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const progress = await getStudentProgress(decodeURIComponent(id));
  if (!progress) notFound();

  return (
    <div className="animate-fade-up space-y-6">
      <Link href="/superadmin/students" className="inline-flex items-center gap-2 text-sm text-ink/55 transition hover:text-plum">
        <BackIcon className="h-4 w-4" />
        All students
      </Link>
      <StudentProgress initial={progress} canGrade canClear showPhotos canChangeDue workHrefBase={`/superadmin/students/${progress.student.studentId}`} />
    </div>
  );
}
