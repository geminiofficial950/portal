import Link from "next/link";
import { notFound } from "next/navigation";
import { BackIcon } from "../../../dashboard/_components/icons";
import StudentProgress from "../../../dashboard/_components/StudentProgress";
import { requireTrainer } from "@/lib/auth";
import { getStudentProgress } from "@/lib/progress";
import { getSettings } from "@/lib/settings";

export default async function TrainerStudentProgressPage(props: PageProps<"/trainer/students/[id]">) {
  await requireTrainer();
  const { id } = await props.params;
  const [progress, settings] = await Promise.all([getStudentProgress(decodeURIComponent(id)), getSettings()]);
  if (!progress) notFound();

  return (
    <div className="animate-fade-up space-y-6">
      <Link href="/trainer/students" className="inline-flex items-center gap-2 text-sm text-ink/55 transition hover:text-plum">
        <BackIcon className="h-4 w-4" />
        All students
      </Link>
      <StudentProgress
        initial={{ ...progress, units: progress.units.map((u) => ({ ...u, photos: [] })) }}
        canGrade={settings.trainerPermissions.markAssessments}
        canClear={false}
        workHrefBase={`/trainer/students/${progress.student.studentId}`}
      />
    </div>
  );
}
