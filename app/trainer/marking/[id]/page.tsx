import Link from "next/link";
import { notFound } from "next/navigation";
import { BackIcon } from "../../../dashboard/_components/icons";
import ReviewClient from "./ReviewClient";
import { getAssessment } from "@/lib/assessments";
import { requireTrainer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getSubmission } from "@/lib/submissions";

export default async function ReviewPage(props: PageProps<"/trainer/marking/[id]">) {
  await requireTrainer();
  const { id } = await props.params;
  const submission = await getSubmission(id);
  if (!submission || submission.status === "Draft") notFound();

  const [assessment, settings] = await Promise.all([
    getAssessment(submission.courseCode, submission.unitCode),
    getSettings(),
  ]);

  return (
    <div className="animate-fade-up space-y-6">
      <Link
        href={`/trainer/marking/course/${encodeURIComponent(submission.courseCode)}/${encodeURIComponent(submission.unitCode)}?part=${submission.part}`}
        className="inline-flex items-center gap-2 text-sm text-ink/55 transition hover:text-plum"
      >
        <BackIcon className="h-4 w-4" />
        Back to {submission.unitCode}
      </Link>
      <ReviewClient
        initialSubmission={submission}
        theory={assessment.theory.questions}
        rolePlay={assessment.rolePlay}
        workplace={assessment.workplace}
        canMark={settings.trainerPermissions.markAssessments}
      />
    </div>
  );
}
