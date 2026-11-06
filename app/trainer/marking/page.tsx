import Link from "next/link";
import { ArrowRightIcon } from "../../dashboard/_components/icons";
import MarkingInbox, { type InboxRow } from "./MarkingInbox";
import { partLabel, partsOf } from "@/lib/assessment-meta";
import { listAllAssessments } from "@/lib/assessments";
import { requireTrainer } from "@/lib/auth";
import { listCourses } from "@/lib/courses";
import { getSettings } from "@/lib/settings";
import { listAllHandedIn } from "@/lib/submissions";
import { trainerScope } from "@/lib/trainer-access";

const DAY = 86_400_000;
// The request time; this page is rendered per request (it reads the session), so "now" is that moment
const requestTime = () => Date.now();
const daysSince = (iso: string | null, now: number) => (iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY)) : 0);

// Trainer marking: one inbox for everything handed in (to mark / sent back / marked) with filters,
// and the course → unit browse kept underneath
export default async function MarkingPage() {
  const trainer = await requireTrainer();
  const now = requestTime();
  const [allWork, courses, settings, assessed, scope] = await Promise.all([listAllHandedIn(), listCourses(), getSettings(), listAllAssessments(), trainerScope(trainer.trainerId)]);
  // only work of students currently in the trainer's batches, in the units assigned to them
  const work = allWork.filter((s) => scope.can(s.studentId, s.unitCode));
  // units with marked modules — the only ones a trainer can mark
  const assessedUnits = (code: string) => courses.find((c) => c.code === code)?.units.filter((u) => partsOf(assessed[`${code}/${u.code}`]).length > 0).length ?? 0;
  const unitTitle = (code: string, unit: string) => courses.find((c) => c.code === code)?.units.find((u) => u.code === unit)?.title ?? unit;

  const rows: InboxRow[] = work.map((s) => ({
    id: s.submissionId,
    studentId: s.studentId,
    studentName: s.studentName,
    courseCode: s.courseCode,
    unitCode: s.unitCode,
    unitTitle: unitTitle(s.courseCode, s.unitCode),
    part: s.part,
    partLabel: partLabel(assessed[`${s.courseCode}/${s.unitCode}`], s.part),
    attempt: s.attempt,
    status: s.status,
    submittedAt: s.submittedAt,
    decidedAt: s.decidedAt,
    decidedBy: s.decidedBy,
    waitDays: daysSince(s.submittedAt, now),
    sinceDecidedDays: daysSince(s.decidedAt, now),
  }));
  const toMarkByCourse = (code: string) => rows.filter((r) => r.courseCode === code && r.status === "Submitted").length;

  return (
    <div className="animate-fade-up space-y-10">
      <MarkingInbox
        rows={rows}
        courses={courses.map(({ code, name }) => ({ code, name }))}
        canMark={settings.trainerPermissions.markAssessments}
      />

      {/* the course → unit → part way in, kept for browsing */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">Browse by course</h2>
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {courses.map((c) => {
            const n = toMarkByCourse(c.code);
            return (
              <li key={c.code}>
                <Link
                  href={`/trainer/marking/course/${encodeURIComponent(c.code)}`}
                  className="group flex h-full items-center gap-4 rounded-xl bg-[#f6f5fa] p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* course code on two lines: letters, then the number */}
                  <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-plum text-[11px] font-bold leading-tight text-white">
                    <span>{c.code.match(/^\D+/)?.[0] ?? c.code}</span>
                    <span>{c.code.replace(/^\D+/, "")}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-snug text-ink">{c.name}</span>
                    <span className="mt-1 block text-xs font-medium text-ink">
                      {assessedUnits(c.code)} unit{assessedUnits(c.code) === 1 ? "" : "s"} with assessments ·{" "}
                      {n ? <span className="font-semibold text-plum">{n} to mark</span> : "nothing to mark"}
                    </span>
                  </span>
                  <ArrowRightIcon className="h-4 w-4 shrink-0 text-ink transition group-hover:translate-x-0.5 group-hover:text-plum" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
