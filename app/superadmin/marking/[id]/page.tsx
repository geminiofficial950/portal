import Link from "next/link";
import { notFound } from "next/navigation";
import { BackIcon } from "../../../dashboard/_components/icons";
import ReviewClient from "../../../trainer/marking/[id]/ReviewClient";
import { getAssessment } from "@/lib/assessments";
import { requireAdmin } from "@/lib/auth";
import { getSubmission } from "@/lib/submissions";

// Super Admin can review and mark any submitted Theory Task / Workplacement Task work
export default async function AdminReviewPage(props: PageProps<"/superadmin/marking/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const submission = await getSubmission(id);
  if (!submission || submission.status === "Draft") notFound();
  const assessment = await getAssessment(submission.courseCode, submission.unitCode);

  return (
    <div className="animate-fade-up space-y-6">
      <Link
        href={`/superadmin/students/${submission.studentId}/${submission.unitCode}`}
        className="inline-flex items-center gap-2 text-sm text-ink/55 transition hover:text-plum"
      >
        <BackIcon className="h-4 w-4" />
        {submission.studentName}’s work for {submission.unitCode}
      </Link>
      <ReviewClient
        initialSubmission={submission}
        theory={assessment.theory.questions}
        rolePlay={assessment.rolePlay}
        workplace={assessment.workplace}
        canMark
      />
    </div>
  );
}
