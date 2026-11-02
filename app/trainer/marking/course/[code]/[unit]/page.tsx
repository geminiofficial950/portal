import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, BackIcon, CheckIcon, ClipboardIcon } from "../../../../../dashboard/_components/icons";
import LocalTime from "../../../../../dashboard/assessment/_components/LocalTime";
import { MARKED_PARTS, summarise } from "@/lib/assessment-meta";
import { getAssessment } from "@/lib/assessments";
import { requireTrainer } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { statusLabel, statusStyle } from "@/lib/submission-meta";
import { listCourseWork } from "@/lib/submissions";

const ORDER = { Submitted: 0, MoreDocs: 1, Rejected: 2, Accepted: 3, Draft: 4 } as const;

// Trainer marking, step 3: one unit, one tab per part (like the student's unit page)
export default async function MarkingUnitPage(props: PageProps<"/trainer/marking/course/[code]/[unit]">) {
  await requireTrainer();
  const { code, unit: unitParam } = await props.params;
  const course = await getCourse(decodeURIComponent(code));
  const unit = course?.units.find((u) => u.code === decodeURIComponent(unitParam));
  if (!course || !unit) notFound();

  const [assessment, work] = await Promise.all([getAssessment(course.code, unit.code), listCourseWork(course.code, unit.code)]);
  const set = summarise(assessment);
  const parts = MARKED_PARTS.filter((p) => set[p.key]);
  const toMark = (part: string) => work.filter((s) => s.part === part && s.status === "Submitted").length;
  const done = (part: string) => work.some((s) => s.part === part) && work.filter((s) => s.part === part).every((s) => s.status === "Accepted");

  const asked = (await props.searchParams).part;
  const tab = parts.find((p) => p.key === asked) ?? parts.find((p) => toMark(p.key) > 0) ?? parts[0];
  const items = tab ? work.filter((s) => s.part === tab.key).sort((a, b) => ORDER[a.status] - ORDER[b.status]) : [];
  const base = `/trainer/marking/course/${encodeURIComponent(course.code)}/${encodeURIComponent(unit.code)}`;

  return (
    <div className="animate-fade-up space-y-6">
      <Link href={`/trainer/marking/course/${encodeURIComponent(course.code)}`} className="inline-flex items-center gap-2 text-sm text-ink/55 transition hover:text-plum">
        <BackIcon className="h-4 w-4" />
        {course.code} units
      </Link>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-plum">
          {course.code} · {unit.code}
        </p>
        <h1 className="mt-1 text-2xl font-medium text-ink sm:text-[1.65rem]">{unit.title}</h1>
        <p className="mt-1 text-sm text-ink/55">Pick a part, then open a student’s work to give feedback and accept or reject it.</p>
      </div>

      {parts.length === 0 ? (
        <div className="grid place-items-center rounded-[1.5rem] bg-lilac/70 px-5 py-12 text-center">
          <ClipboardIcon className="h-8 w-8 text-plum/40" />
          <p className="mt-3 text-sm text-ink">This unit has no Theory Task or Workplacement Task set up yet.</p>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Assessment parts" className={`grid gap-2 sm:grid-cols-2 ${parts.length === 3 ? "lg:grid-cols-3" : ""}`}>
            {parts.map((p, i) => {
              const active = tab?.key === p.key;
              const n = toMark(p.key);
              return (
                <Link
                  key={p.key}
                  href={`${base}?part=${p.key}`}
                  role="tab"
                  aria-selected={active}
                  scroll={false}
                  className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-left transition ${
                    active ? "bg-plum text-white shadow-md shadow-plum/20" : "bg-lilac text-ink hover:bg-plum/10"
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-medium ${
                      done(p.key) ? "bg-emerald-400 text-white" : active ? "bg-white/20" : "bg-white text-plum"
                    }`}
                  >
                    {done(p.key) ? <CheckIcon className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{p.label}</span>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        n ? statusStyle.Submitted : statusStyle["Not started"]
                      }`}
                    >
                      {n ? `${n} to mark` : "Nothing to mark"}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>

          <ul className="space-y-3">
            {items.map((s) => (
              <li key={s.submissionId}>
                <Link
                  href={`/trainer/marking/${s.submissionId}`}
                  className="group grid gap-3 rounded-[1.5rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] transition hover:border-plum/20 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${statusStyle[s.status]}`}>
                        {s.status === "Submitted" ? "To mark" : statusLabel[s.status]}
                      </span>
                      {s.attempt > 1 && <span className="text-[11px] text-ink/45">Attempt {s.attempt}</span>}
                    </div>
                    <p className="mt-1.5 font-medium text-ink">
                      {s.studentName} <span className="text-xs font-normal text-ink/45">({s.studentId})</span>
                    </p>
                    {s.submittedAt && (
                      <p className="mt-0.5 text-[11px] text-ink/45">
                        Submitted <LocalTime iso={s.submittedAt} />
                        {s.decidedBy && ` · ${statusLabel[s.status]} — ${s.decidedBy}`}
                      </p>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-plum">
                    {s.status === "Submitted" ? "Review" : "View"}
                    <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
            {items.length === 0 && (
              <li className="grid place-items-center rounded-[1.5rem] bg-lilac/70 px-5 py-12 text-center">
                <ClipboardIcon className="h-8 w-8 text-plum/40" />
                <p className="mt-3 text-sm text-ink/45">No student has handed in the {tab?.label.toLowerCase()} yet.</p>
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
