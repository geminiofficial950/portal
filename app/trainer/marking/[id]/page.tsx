import Link from "next/link";
import { notFound } from "next/navigation";
import { BackIcon } from "../../../dashboard/_components/icons";
import ReviewClient from "./ReviewClient";
import { getAssessment } from "@/lib/assessments";
import { studentModuleDues } from "@/lib/deadlines";
import { getUnitRecord } from "@/lib/unit-records";
import { requireTrainer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getSubmission } from "@/lib/submissions";
import { trainerCanSee } from "@/lib/trainer-access";

export default async function ReviewPage(props: PageProps<"/trainer/marking/[id]">) {
  const trainer = await requireTrainer();
  const { id } = await props.params;
  const submission = await getSubmission(id);
  if (!submission || submission.status === "Draft") notFound();
  // only students currently in the trainer's batch, and only units assigned to them (a direct link gives nothing more)
  if (!(await trainerCanSee(trainer.trainerId, submission.studentId, submission.unitCode))) notFound();

  const [assessment, settings] = await Promise.all([
    getAssessment(submission.courseCode, submission.unitCode),
    getSettings(),
  ]);

  return (
    <div className="animate-fade-up space-y-6">
      <Link
        href={`/trainer/marking/course/${encodeURIComponent(submission.courseCode)}/${encodeURIComponent(submission.unitCode)}?part=${submission.part}`}
        className="inline-flex items-center gap-2 text-sm text-ink transition hover:text-plum"
      >
        <BackIcon className="h-4 w-4" />
        Back to {submission.unitCode}
      </Link>
      <ReviewClient
        initialSubmission={submission}
        module={assessment.modules.find((m) => m.id === submission.part) ?? null}
        due={(await studentModuleDues(submission.studentId, submission.courseCode))[`${submission.unitCode}/${submission.part}`] ?? null}
        unitStatus={(await getUnitRecord(submission.studentId, submission.courseCode, submission.unitCode)).status}
        canMark={settings.trainerPermissions.markAssessments}
      />
    </div>
  );
}
