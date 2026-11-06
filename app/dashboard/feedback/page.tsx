import Link from "next/link";
import LocalTime from "../assessment/_components/LocalTime";
import { partLabel } from "@/lib/assessment-meta";
import { listCourseAssessments } from "@/lib/assessments";
import { requireStudent } from "@/lib/auth";
import { getStudent } from "@/lib/students";
import { statusLabel, statusStyle } from "@/lib/submission-meta";
import { listStudentSubmissions } from "@/lib/submissions";

// Every piece of published feedback the student has, newest first, with whether they've responded
export default async function StudentFeedbackPage() {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  const rows = (
    await Promise.all(
      (student?.courses ?? []).map(async (c) => {
        const [subs, assessments] = await Promise.all([listStudentSubmissions(session.sub, c.code), listCourseAssessments(c.code)]);
        return subs.filter((s) => s.decidedAt).map((s) => ({ s, title: partLabel(assessments[s.unitCode], s.part) }));
      }),
    )
  )
    .flat()
    .sort((a, b) => (b.s.decidedAt ?? "").localeCompare(a.s.decidedAt ?? ""));
  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Feedback</h1>
        <p className="mt-1 text-base text-ink">Feedback from your trainers. Open one to accept it or ask for a review.</p>
      </div>
      <ul className="space-y-3">
        {rows.map(({ s, title }) => (
          <li key={s.submissionId}>
            <Link
              href={`/dashboard/assessment/${encodeURIComponent(s.unitCode)}?course=${encodeURIComponent(s.courseCode)}&item=${encodeURIComponent(`part:${s.part}`)}`}
              className="block rounded-[1.5rem] border border-ink/10 bg-white p-5 transition hover:border-plum"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-semibold text-ink">
                  {title} · {s.unitCode}
                </p>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusStyle[s.status]}`}>{statusLabel[s.status]}</span>
              </div>
              {s.feedback && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-base text-ink">{s.feedback}</p>}
              <p className="mt-2 text-sm text-ink">
                {s.decidedBy} · <LocalTime iso={s.decidedAt!} /> ·{" "}
                {s.response ? (s.response.state === "accepted" ? "You accepted it" : "You asked for a review") : <span className="font-semibold text-plum">Please respond</span>}
              </p>
            </Link>
          </li>
        ))}
        {!rows.length && <li className="rounded-[1.5rem] bg-lilac/70 px-5 py-10 text-center text-base text-ink">No feedback yet.</li>}
      </ul>
    </div>
  );
}
