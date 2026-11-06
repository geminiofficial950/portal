import Link from "next/link";
import LocalTime from "../../dashboard/assessment/_components/LocalTime";
import { requireTrainer } from "@/lib/auth";
import { listReviewRequests } from "@/lib/submissions";
import { trainerScope } from "@/lib/trainer-access";

// Students who asked for a review of their feedback (only students in the trainer's batches, in their units)
export default async function FeedbackReviewsPage() {
  const trainer = await requireTrainer();
  const [all, scope] = await Promise.all([listReviewRequests(), trainerScope(trainer.trainerId)]);
  const rows = all.filter((s) => scope.can(s.studentId, s.unitCode));
  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-[1.65rem]">Feedback reviews</h1>
        <p className="mt-1 text-sm text-ink">Students who asked you to review your feedback. Open one to reply; the original feedback is kept.</p>
      </div>
      <ul className="space-y-3">
        {rows.map((s) => (
          <li key={s.submissionId}>
            <Link href={`/trainer/marking/${s.submissionId}`} className="block rounded-[1.5rem] border border-ink/10 bg-white p-5 transition hover:border-plum">
              <p className="text-base font-semibold text-ink">
                {s.studentName} · {s.unitCode}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink">“{s.response?.comment}”</p>
              <p className="mt-1 text-xs text-ink">
                Asked <LocalTime iso={s.response!.at} /> · {s.response!.replies.length ? `${s.response!.replies.length} repl${s.response!.replies.length === 1 ? "y" : "ies"}` : "not answered yet"}
              </p>
            </Link>
          </li>
        ))}
        {!rows.length && <li className="rounded-[1.5rem] bg-lilac/70 px-5 py-10 text-center text-sm text-ink">No review requests.</li>}
      </ul>
    </div>
  );
}
