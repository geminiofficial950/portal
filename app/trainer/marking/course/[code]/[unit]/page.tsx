import Link from "next/link";
import { notFound } from "next/navigation";
import { BackIcon, BookIcon, CheckIcon, ClipboardIcon, FileIcon } from "../../../../../dashboard/_components/icons";
import LocalTime from "../../../../../dashboard/assessment/_components/LocalTime";
import { MARKED_PARTS, summarise } from "@/lib/assessment-meta";
import { getAssessment } from "@/lib/assessments";
import { requireTrainer } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { statusLabel, statusStyle } from "@/lib/submission-meta";
import { listCourseWork } from "@/lib/submissions";

const ORDER = { Submitted: 0, MoreDocs: 1, Rejected: 2, Accepted: 3, Draft: 4 } as const;
const DAY = 86_400_000;
// The request time; this page is rendered per request (it reads the session), so "now" is that moment
const requestTime = () => Date.now();
const dayWord = (n: number) => (n === 1 ? "1 day" : `${n} days`);

// Thumbnail tile per part (same as the marking inbox)
const PART_TILE: Record<string, { tone: string; icon: typeof ClipboardIcon }> = {
  quiz: { tone: "bg-[#fdc580] text-[#1d1b33]", icon: ClipboardIcon },
  theory: { tone: "bg-plum text-white", icon: BookIcon },
  workplace: { tone: "bg-[#e8659a] text-white", icon: FileIcon },
};

// How long work has waited: the colour always comes with words
function waitTone(days: number) {
  if (days > 7) return { cls: "bg-rose-100 text-rose-800", text: `${dayWord(days)} · overdue` };
  if (days >= 3) return { cls: "bg-amber-100 text-amber-900", text: `Waiting ${dayWord(days)}` };
  return { cls: "bg-emerald-100 text-emerald-800", text: days === 0 ? "Came in today" : `Waiting ${dayWord(days)}` };
}

// Trainer marking, one unit: a tab per part, then every student's work for that part
export default async function MarkingUnitPage(props: PageProps<"/trainer/marking/course/[code]/[unit]">) {
  await requireTrainer();
  const { code, unit: unitParam } = await props.params;
  const course = await getCourse(decodeURIComponent(code));
  const unit = course?.units.find((u) => u.code === decodeURIComponent(unitParam));
  if (!course || !unit) notFound();

  const now = requestTime();
  const [assessment, work] = await Promise.all([getAssessment(course.code, unit.code), listCourseWork(course.code, unit.code)]);
  const set = summarise(assessment);
  const parts = MARKED_PARTS.filter((p) => set[p.key]);
  const toMark = (part: string) => work.filter((s) => s.part === part && s.status === "Submitted").length;
  const done = (part: string) => work.some((s) => s.part === part) && work.filter((s) => s.part === part).every((s) => s.status === "Accepted");

  const asked = (await props.searchParams).part;
  const tab = parts.find((p) => p.key === asked) ?? parts.find((p) => toMark(p.key) > 0) ?? parts[0];
  const items = tab ? work.filter((s) => s.part === tab.key).sort((a, b) => ORDER[a.status] - ORDER[b.status]) : [];
  const base = `/trainer/marking/course/${encodeURIComponent(course.code)}/${encodeURIComponent(unit.code)}`;
  const tile = PART_TILE[tab?.key ?? "theory"] ?? PART_TILE.theory;

  return (
    <div className="animate-fade-up space-y-6">
      <Link href={`/trainer/marking/course/${encodeURIComponent(course.code)}`} className="inline-flex items-center gap-2 text-sm font-medium text-ink transition hover:text-plum">
        <BackIcon className="h-4 w-4" />
        {course.code} units
      </Link>

      <div>
        <p className="text-sm font-semibold text-plum">
          {course.code} · {unit.code}
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold text-ink">{unit.title}</h1>
        <p className="mt-1 text-sm text-ink">Pick a part, then open a student’s work to give it a status.</p>
      </div>

      {parts.length === 0 ? (
        <p className="rounded-xl bg-[#f6f5fa] px-5 py-10 text-center text-sm font-medium text-ink">This unit has no assessment set up yet.</p>
      ) : (
        <>
          <div role="tablist" aria-label="Assessment parts" className="flex flex-wrap gap-2">
            {parts.map((p) => {
              const active = tab?.key === p.key;
              const n = toMark(p.key);
              return (
                <Link
                  key={p.key}
                  href={`${base}?part=${p.key}`}
                  role="tab"
                  aria-selected={active}
                  scroll={false}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active ? "bg-plum text-white" : "bg-[#f6f5fa] text-ink hover:bg-plum/10"
                  }`}
                >
                  {done(p.key) && <CheckIcon className="h-4 w-4" />}
                  {p.label}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-[rgba(255,255,255,0.25)]" : n ? "bg-amber-100 text-amber-900" : "bg-white"}`}>
                    {n ? `${n} to mark` : "0"}
                  </span>
                </Link>
              );
            })}
          </div>

          {items.length ? (
            <ul className="space-y-3">
              {items.map((s) => {
                const wait = waitTone(s.submittedAt ? Math.max(0, Math.floor((now - new Date(s.submittedAt).getTime()) / DAY)) : 0);
                const pending = s.status === "Submitted";
                return (
                  <li key={s.submissionId} className="flex flex-wrap items-center gap-4 rounded-xl bg-[#f6f5fa] p-4 sm:flex-nowrap">
                    <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-lg ${tile.tone}`}>
                      <tile.icon className="h-7 w-7" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/trainer/marking/${s.submissionId}`} className="font-semibold text-plum hover:underline">
                        {s.studentName} <span className="font-medium text-ink">({s.studentId})</span>
                      </Link>
                      <p className="mt-1 text-sm font-semibold text-ink">
                        {tab?.label}
                        {s.attempt > 1 && ` · attempt ${s.attempt}`}
                        <span className="font-medium">
                          {s.submittedAt && (
                            <>
                              {" "}
                              · submitted <LocalTime iso={s.submittedAt} />
                            </>
                          )}
                        </span>
                      </p>
                      {!pending && s.decidedBy && (
                        <p className="mt-0.5 text-sm text-ink">
                          {statusLabel[s.status]} — {s.decidedBy}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2.5">
                      {pending ? (
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${wait.cls}`}>{wait.text}</span>
                      ) : (
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[s.status]}`}>{statusLabel[s.status]}</span>
                      )}
                      <Link
                        href={`/trainer/marking/${s.submissionId}`}
                        className={`rounded-full px-5 py-2 text-xs font-semibold transition ${
                          pending ? "bg-plum text-white hover:bg-plum-light" : "bg-[#e4dcfb] text-plum hover:bg-plum hover:text-white"
                        }`}
                      >
                        {pending ? "Review" : "View"}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-xl bg-[#f6f5fa] px-5 py-10 text-center text-sm font-medium text-ink">
              No student has handed in the {tab?.label} yet.
            </p>
          )}
        </>
      )}
    </div>
  );
}
