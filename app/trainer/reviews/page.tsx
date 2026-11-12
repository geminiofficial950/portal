import Link from "next/link";
import LocalTime from "../../dashboard/assessment/_components/LocalTime";
import { requireTrainer } from "@/lib/auth";
import { listAcceptedFeedback, listReviewRequests } from "@/lib/submissions";
import { statusLabel } from "@/lib/submission-meta";
import { trainerScope } from "@/lib/trainer-access";

const card = "block rounded-[1.5rem] border border-ink/10 bg-white p-5 transition hover:border-plum";

// How students responded to the trainer's feedback (only students in the trainer's batches, in their units):
// review requests to answer first, then feedback the student accepted and signed.
export default async function FeedbackResponsesPage() {
  const trainer = await requireTrainer();
  const [reviews, accepted, scope] = await Promise.all([listReviewRequests(), listAcceptedFeedback(), trainerScope(trainer.trainerId)]);
  const mine = <T extends { studentId: string; unitCode: string }>(l: T[]) => l.filter((s) => scope.can(s.studentId, s.unitCode));
  const toReview = mine(reviews);
  const done = mine(accepted);
  return (
    <div className="animate-fade-up space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-[1.65rem]">Feedback responses</h1>
        <p className="mt-1 text-sm text-ink">See which students accepted your feedback and which asked for a review. Open one to see the work and reply.</p>
      </div>

      <section aria-labelledby="review-heading" className="space-y-3">
        <h2 id="review-heading" className="text-lg font-semibold text-ink">
          Review requested <span className="ml-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-900">{toReview.length}</span>
        </h2>
        <ul className="space-y-3">
          {toReview.map((s) => (
            <li key={s.submissionId}>
              <Link href={`/trainer/marking/${s.submissionId}`} className={card}>
                <p className="text-base font-semibold text-ink">
                  {s.studentName} · {s.unitCode}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">“{s.response?.comment}”</p>
                <p className="mt-1 text-sm text-ink">
                  Asked <LocalTime iso={s.response!.at} /> · {s.response!.replies.length ? `${s.response!.replies.length} repl${s.response!.replies.length === 1 ? "y" : "ies"}` : "not answered yet"}
                </p>
              </Link>
            </li>
          ))}
          {!toReview.length && <li className="rounded-[1.5rem] bg-lilac/70 px-5 py-6 text-center text-sm text-ink">No review requests.</li>}
        </ul>
      </section>

      <section aria-labelledby="accepted-heading" className="space-y-3">
        <h2 id="accepted-heading" className="text-lg font-semibold text-ink">
          Accepted and signed <span className="ml-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-semibold text-emerald-800">{done.length}</span>
        </h2>
        <ul className="space-y-3">
          {done.map((s) => (
            <li key={s.submissionId}>
              <Link href={`/trainer/marking/${s.submissionId}`} className={`${card} flex flex-wrap items-center gap-3`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-ink">
                    {s.studentName} · {s.unitCode}
                  </span>
                  <span className="block text-sm text-ink">
                    Result: {statusLabel[s.status]} · accepted <LocalTime iso={s.response!.at} />
                  </span>
                </span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">Accepted and signed</span>
              </Link>
            </li>
          ))}
          {!done.length && <li className="rounded-[1.5rem] bg-lilac/70 px-5 py-6 text-center text-sm text-ink">No student has accepted feedback yet.</li>}
        </ul>
      </section>
    </div>
  );
}
