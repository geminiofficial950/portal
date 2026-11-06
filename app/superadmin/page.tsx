import Link from "next/link";
import {
  ArrowRightIcon,
  BoxIcon,
  ClipboardIcon,
  TicketIcon,
  UserPlusIcon,
  UsersIcon,
} from "../dashboard/_components/icons";
import EnrolmentChart from "./_components/EnrolmentChart";
import LiveRefresh from "./_components/LiveRefresh";
import { listActivity, type ActivityKind } from "@/lib/activity";
import { requireAdmin } from "@/lib/auth";
import { listCourses } from "@/lib/courses";
import { initials } from "@/lib/format";
import { courseProgressAverages } from "@/lib/progress";
import { countStudents, enrolmentsByMonth } from "@/lib/students";
import { listAllForMarking } from "@/lib/submissions";
import { countOpenTickets, listOpenTickets } from "@/lib/tickets";
import { countTrainers } from "@/lib/trainers";

const priorityStyle = {
  High: "bg-rose-100 text-rose-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-lilac text-plum",
};

const activityTone: Record<ActivityKind, string> = {
  student: "bg-sky-400",
  course: "bg-violet-400",
  trainer: "bg-amber-400",
  ticket: "bg-emerald-400",
  settings: "bg-rose-400",
};

// The request time; the page is rendered per request (it reads the session)
const requestTime = () => new Date();

// Super Admin / Admin overview, all from live data; LiveRefresh reloads it every minute and when the tab is opened again
export default async function SuperAdminOverview() {
  await requireAdmin();
  const now = requestTime();
  const [studentCount, courses, trainerCount, ticketCount, enrolments, openTickets, activity, toMark] = await Promise.all([
    countStudents(),
    listCourses(),
    countTrainers(),
    countOpenTickets(),
    enrolmentsByMonth(6),
    listOpenTickets(4),
    listActivity(6),
    listAllForMarking(),
  ]);
  const progress = await courseProgressAverages(courses.map((c) => c.code));

  const oldestWait = toMark[0]?.submittedAt ? Math.floor((now.getTime() - new Date(toMark[0].submittedAt).getTime()) / 86_400_000) : 0;

  const kpis = [
    { href: "/superadmin/students", label: "Total students", value: studentCount.total, hint: `${studentCount.pending} pending approval`, icon: UsersIcon, tone: "bg-lilac" },
    { href: "/superadmin/courses", label: "Courses", value: courses.length, hint: `${courses.reduce((n, c) => n + c.units.length, 0)} units in total`, icon: BoxIcon, tone: "bg-[#ffe8d6]" },
    { href: "/superadmin/trainers", label: "Trainers", value: trainerCount.total, hint: `${trainerCount.active} active`, icon: UserPlusIcon, tone: "bg-[#e8f3ff]" },
    { href: "/superadmin/tickets", label: "Open tickets", value: ticketCount.open, hint: `${ticketCount.unassigned} unassigned`, icon: TicketIcon, tone: "bg-emerald-50" },
    {
      href: "/superadmin/students",
      label: "Waiting to be marked",
      value: toMark.length,
      hint: toMark.length ? `Oldest waiting ${oldestWait} day${oldestWait === 1 ? "" : "s"}` : "Nothing waiting",
      icon: ClipboardIcon,
      tone: "bg-[#fdeaf2]",
    },
  ];

  const completion = courses.map((c) => ({ code: c.code, name: c.name, students: progress[c.code]?.students ?? 0, avg: progress[c.code]?.avg ?? 0 }));

  return (
    <div className="animate-fade-up space-y-10">
      <LiveRefresh at={now.toISOString()} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map(({ href, label, value, hint, icon: Icon, tone }) => (
          <Link
            key={href}
            href={href}
            className={`group rounded-[1.5rem] p-5 transition hover:brightness-[0.98] ${tone}`}
          >
            <div className="flex items-start justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/80 text-plum">
                <Icon className="h-5 w-5" />
              </span>
              <ArrowRightIcon className="h-4 w-4 text-ink/80 transition group-hover:translate-x-0.5 group-hover:text-plum" />
            </div>
            <p className="mt-4 text-sm font-medium text-ink">{label}</p>
            <p className="mt-1 text-2xl font-medium text-ink">{value}</p>
            <p className="mt-1 text-xs font-medium text-ink/85">{hint}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:gap-14">
        <div className="space-y-10">
          <EnrolmentChart data={enrolments} />

          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-ink">Course progress</h2>
              <Link href="/superadmin/courses" className="text-xs text-peach hover:underline">
                View all
              </Link>
            </div>
            <ul className="mt-4 space-y-4 rounded-[1.75rem] bg-lilac/70 p-5">
              {completion.map((c) => (
                <li key={c.code}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-ink">
                      <span className="mr-2 text-[11px] font-medium text-plum">{c.code}</span>
                      {c.name}
                    </span>
                    <span className="shrink-0 text-xs text-ink/55">
                      {c.students ? `${c.students} student${c.students === 1 ? "" : "s"} · ${c.avg}%` : "No students yet"}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white">
                    <div className="h-full rounded-full bg-plum" style={{ width: `${c.avg}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-10">
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-ink">Support requests needing attention</h2>
              <Link href="/superadmin/tickets" className="text-xs text-peach hover:underline">
                View all
              </Link>
            </div>
            {openTickets.length ? (
              <ul className="mt-4 space-y-2">
                {openTickets.map((t) => (
                  <li key={t.ticketId}>
                    <Link
                      href="/superadmin/tickets"
                      className="flex items-center gap-4 rounded-2xl bg-plum p-4 text-white transition first:shadow-lg first:shadow-plum/20 hover:bg-plum-light"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/20">
                        <TicketIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{t.subject}</span>
                        <span className="mt-0.5 block text-[11px] text-white/70">
                          {t.ticketId} · {t.studentName} · {t.assignee}
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${priorityStyle[t.priority]}`}>
                        {t.priority}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-2xl bg-emerald-50 px-5 py-6 text-center text-sm text-emerald-700">
                All caught up — no open tickets.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-lg font-medium text-ink">Recent activity</h2>
            {activity.length ? (
              <ul className="mt-4 space-y-4 rounded-[1.75rem] bg-lilac/70 p-5">
                {activity.map((a, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${activityTone[a.kind]} text-[10px] font-bold text-white`}>
                      {initials(a.who)}
                    </span>
                    <p className="text-sm text-ink/80">
                      <span className="font-medium text-ink">{a.who}</span> {a.what}
                      <span className="mt-0.5 block text-[11px] text-ink/40">{a.when}</span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-[1.75rem] bg-lilac/70 px-5 py-6 text-center text-sm text-ink/50">
                Nothing yet — actions like adding students show up here.
              </p>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
