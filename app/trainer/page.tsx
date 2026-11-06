import Link from "next/link";
import { Suspense } from "react";
import { BookIcon, CheckIcon, ClipboardIcon, ClockIcon, FileIcon, TicketIcon } from "../dashboard/_components/icons";
import LocalTime from "../dashboard/assessment/_components/LocalTime";
import WelcomeArt from "./WelcomeArt";
import { partLabel as modulePartLabel } from "@/lib/assessment-meta";
import { listUpcomingDue } from "@/lib/assessments";
import { requireTrainer } from "@/lib/auth";
import { listCourses } from "@/lib/courses";
import { getSettings } from "@/lib/settings";
import { statusLabel, statusStyle } from "@/lib/submission-meta";
import { countDecidedSince, listAllForMarking, listAwaitingRework } from "@/lib/submissions";
import { listTickets } from "@/lib/tickets";
import { trainerScope } from "@/lib/trainer-access";

// Trainer home: date header, a welcome banner, four overview tiles, then the work waiting to be marked
// (one row each, oldest first), students waiting on rework and due dates coming up.

const DAY = 86_400_000;
const TZ = "Australia/Sydney";
// The request time; this page is rendered per request (it reads the session), so "now" is that moment
const requestTime = () => Date.now();
const partLabel = (key: string) => modulePartLabel(null, key);
const daysSince = (iso: string | null, now: number) => (iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY)) : 0);
const dayWord = (n: number) => (n === 1 ? "1 day" : `${n} days`);

// How long work has waited: the colour always comes with words
function waitTone(days: number) {
  if (days > 7) return { cls: "bg-rose-100 text-rose-800", text: `${dayWord(days)} · overdue` };
  if (days >= 3) return { cls: "bg-amber-100 text-amber-900", text: `Waiting ${dayWord(days)}` };
  return { cls: "bg-emerald-100 text-emerald-800", text: days === 0 ? "Came in today" : `Waiting ${dayWord(days)}` };
}

// Thumbnail tile per part, like the cover images in the list
const PART_TILE: Record<string, { tone: string; icon: typeof ClipboardIcon }> = {
  quiz: { tone: "bg-[#fdc580] text-[#1d1b33]", icon: ClipboardIcon },
  theory: { tone: "bg-plum text-white", icon: BookIcon },
  workplace: { tone: "bg-[#e8659a] text-white", icon: FileIcon },
};

type Tile = { href: string; label: string; value: number | string; icon: typeof ClipboardIcon; tone: string; chip: string };

function Overview({ tiles }: { tiles: Tile[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-ink">Overview</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(({ href, label, value, icon: Icon, tone, chip }) => (
          <Link key={label} href={href} className={`flex items-center gap-4 rounded-xl px-5 py-4 transition hover:-translate-y-0.5 hover:shadow-lg ${tone}`}>
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${chip}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-2xl font-bold leading-tight">{value}</span>
              <span className="block text-sm font-medium">{label}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// Icon chips use rgba() rather than bg-white/…, which dark mode would turn into a dark panel
const TILE_STYLES = {
  toMark: { tone: "bg-[#fdc580] text-[#1d1b33]", chip: "bg-[rgba(255,255,255,0.45)]" },
  overdue: { tone: "bg-plum text-white", chip: "bg-[rgba(255,255,255,0.2)]" },
  marked: { tone: "bg-[#e8659a] text-white", chip: "bg-[rgba(255,255,255,0.25)]" },
  tickets: { tone: "bg-[#c9bdf0] text-[#1d1b33]", chip: "bg-[rgba(255,255,255,0.5)]" },
};

const loadingTiles: Tile[] = [
  { href: "/trainer/marking", label: "To mark", value: "–", icon: ClipboardIcon, ...TILE_STYLES.toMark },
  { href: "/trainer/marking", label: "Waiting over 7 days", value: "–", icon: ClockIcon, ...TILE_STYLES.overdue },
  { href: "/trainer/marking", label: "Marked this week", value: "–", icon: CheckIcon, ...TILE_STYLES.marked },
  { href: "/trainer/tickets", label: "Open support requests", value: "–", icon: TicketIcon, ...TILE_STYLES.tickets },
];

export default function TrainerDashboard() {
  return (
    <div className="animate-fade-up space-y-8">
      <Suspense fallback={<Overview tiles={loadingTiles} />}>
        <DashboardBody />
      </Suspense>
    </div>
  );
}

async function DashboardBody() {
  const trainer = await requireTrainer();
  const me = `${trainer.name} · Trainer`; // how trainers' decisions are stored
  const now = requestTime();
  const [allQueue, allRework, markedWeek, tickets, upcoming, courses, settings, scope] = await Promise.all([
    listAllForMarking(),
    listAwaitingRework(50),
    countDecidedSince(me, new Date(now - 7 * DAY)),
    listTickets({ assigneeId: trainer.trainerId }),
    listUpcomingDue(14),
    listCourses(),
    getSettings(),
    trainerScope(trainer.trainerId),
  ]);
  // only students currently in the trainer's batches, in their assigned units
  const queue = allQueue.filter((s) => scope.can(s.studentId, s.unitCode));
  const rework = allRework.filter((s) => scope.can(s.studentId, s.unitCode)).slice(0, 5);
  const unitTitle = (code: string, unit: string) => courses.find((c) => c.code === code)?.units.find((u) => u.code === unit)?.title ?? unit;
  const openTickets = tickets.filter((t) => t.status !== "Resolved").length;
  const overdue = queue.filter((s) => daysSince(s.submittedAt, now) > 7).length;

  const weekday = new Intl.DateTimeFormat("en-AU", { timeZone: TZ, weekday: "long" }).format(now);
  const date = new Intl.DateTimeFormat("en-AU", { timeZone: TZ, day: "2-digit", month: "long", year: "numeric" }).format(now);

  return (
    <>
      {/* page title and date */}
      <div>
        <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-0.5 text-sm text-ink">
          <span className="font-semibold text-plum">{weekday}</span>, {date}
        </p>
      </div>

      {/* welcome banner */}
      <section className="relative overflow-visible rounded-[1.5rem] bg-[#e4dcfb] px-7 py-8 sm:px-10 lg:pr-[300px]">
        <h2 className="text-3xl font-bold text-ink sm:text-[2.1rem]">Hi, {trainer.name.split(" ")[0]}</h2>
        <p className="mt-2 max-w-md text-base text-ink">
          {queue.length
            ? `Ready to start your day? ${queue.length} piece${queue.length === 1 ? " is" : "s are"} waiting to be marked.`
            : "Ready to start your day? You're all caught up — nothing is waiting to be marked."}
        </p>
        <Link
          href={queue.length ? `/trainer/marking/${queue[0].submissionId}` : "/trainer/marking"}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-plum px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-plum-light"
        >
          <ClipboardIcon className="h-4 w-4" />
          {queue.length ? "Start marking" : "Open marking"}
        </Link>
        <WelcomeArt className="pointer-events-none absolute -top-10 right-4 hidden h-[210px] w-[310px] lg:block" />
      </section>

      <Overview
        tiles={[
          { href: "/trainer/marking", label: "To mark", value: queue.length, icon: ClipboardIcon, ...TILE_STYLES.toMark },
          { href: "/trainer/marking", label: "Waiting over 7 days", value: overdue, icon: ClockIcon, ...TILE_STYLES.overdue },
          { href: "/trainer/marking", label: "Marked this week", value: markedWeek, icon: CheckIcon, ...TILE_STYLES.marked },
          { href: "/trainer/tickets", label: "Open support requests", value: openTickets, icon: TicketIcon, ...TILE_STYLES.tickets },
        ]}
      />

      {!settings.trainerPermissions.markAssessments && (
        <p className="rounded-2xl bg-amber-50 px-5 py-3 text-sm text-amber-900">
          Super Admin has turned off assessment marking for trainers, so you can view work but not mark it.
        </p>
      )}

      {/* work waiting to be marked */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">Waiting to be marked</h2>
          <Link href="/trainer/marking" className="text-sm font-semibold text-plum hover:underline">
            View all
          </Link>
        </div>
        {queue.length ? (
          <ul className="space-y-4">
            {queue.slice(0, 5).map((s) => {
              const tile = PART_TILE[s.part] ?? PART_TILE.theory;
              const wait = waitTone(daysSince(s.submittedAt, now));
              return (
                <li key={s.submissionId} className="flex flex-wrap items-center gap-5 rounded-xl bg-[#f6f5fa] p-4 sm:flex-nowrap">
                  <span className={`grid h-20 w-20 shrink-0 place-items-center rounded-lg ${tile.tone}`}>
                    <tile.icon className="h-8 w-8" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/trainer/marking/${s.submissionId}`} className="font-semibold text-plum hover:underline">
                      {s.studentName}
                    </Link>
                    <p className="mt-1 text-sm text-ink">
                      {s.unitCode} · {unitTitle(s.courseCode, s.unitCode)}
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-ink">
                      {partLabel(s.part)}
                      {s.attempt > 1 && ` · attempt ${s.attempt}`}
                      {s.submittedAt && (
                        <span className="font-medium">
                          {" "}
                          · submitted <LocalTime iso={s.submittedAt} />
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${wait.cls}`}>{wait.text}</span>
                    <Link
                      href={`/trainer/marking/${s.submissionId}`}
                      className="rounded-full bg-plum px-5 py-2 text-xs font-semibold text-white transition hover:bg-plum-light"
                    >
                      Review
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl bg-emerald-50 px-5 py-8 text-center text-sm font-semibold text-emerald-900">
            All caught up — nothing is waiting to be marked.
          </p>
        )}
      </section>

      {/* rework and due dates */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-[#f6f5fa] p-5">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Students needing attention</h2>
            <Link href="/trainer/students" className="text-sm font-semibold text-plum hover:underline">
              All students
            </Link>
          </div>
          {rework.length ? (
            <ul className="space-y-3">
              {rework.map((s) => (
                <li key={s.submissionId}>
                  <Link
                    href={`/trainer/students/${encodeURIComponent(s.studentId)}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 transition hover:shadow"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{s.studentName}</span>
                      <span className="block truncate text-xs font-medium text-ink">
                        {s.unitCode} · {partLabel(s.part)} · sent back {dayWord(daysSince(s.decidedAt, now))} ago
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[s.status]}`}>{statusLabel[s.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg bg-white px-4 py-5 text-center text-sm font-medium text-ink">No students are waiting on rework.</p>
          )}
        </section>

        <section className="rounded-xl bg-[#f6f5fa] p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Due in the next 14 days</h2>
          {upcoming.length ? (
            <ul className="space-y-3">
              {upcoming.slice(0, 5).map((u) => {
                const left = Math.max(0, Math.ceil((new Date(u.dueAt).getTime() - now) / DAY));
                const d = new Date(u.dueAt);
                return (
                  <li key={`${u.courseCode}/${u.unitCode}`}>
                    <Link
                      href={`/trainer/marking/course/${encodeURIComponent(u.courseCode)}/${encodeURIComponent(u.unitCode)}`}
                      className="flex items-center gap-4 rounded-lg bg-white px-4 py-3 transition hover:shadow"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-plum text-center leading-tight text-white">
                        <span className="text-sm font-bold">{new Intl.DateTimeFormat("en-AU", { timeZone: TZ, day: "numeric" }).format(d)}</span>
                        <span className="text-[10px] font-semibold uppercase">{new Intl.DateTimeFormat("en-AU", { timeZone: TZ, month: "short" }).format(d)}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {u.unitCode} · {unitTitle(u.courseCode, u.unitCode)}
                        </span>
                        <span className="block text-xs font-medium text-ink">
                          {u.courseCode} · due {left === 0 ? "today" : `in ${dayWord(left)}`}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-lg bg-white px-4 py-5 text-center text-sm font-medium text-ink">No unit due dates in the next 14 days.</p>
          )}
        </section>
      </div>
    </>
  );
}
