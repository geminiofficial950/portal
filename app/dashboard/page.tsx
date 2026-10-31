import Link from "next/link";
import Calendar from "./_components/Calendar";
import Notification from "./_components/Notification";
import TeamChat from "./_components/TeamChat";
import TodayTasks from "./_components/TodayTasks";
import { ArrowRightIcon, ClipboardIcon, BoxIcon, TicketIcon } from "./_components/icons";

const quickLinks = [
  {
    href: "/dashboard/assessment",
    label: "Assessments due",
    value: "3",
    hint: "Next due 5 Nov",
    icon: ClipboardIcon,
    tone: "bg-[#ffe8d6]",
  },
  {
    href: "/dashboard/course",
    label: "Active courses",
    value: "4",
    hint: "54% avg progress",
    icon: BoxIcon,
    tone: "bg-lilac",
  },
  {
    href: "/dashboard/tickets",
    label: "Open tickets",
    value: "1",
    hint: "1 in review",
    icon: TicketIcon,
    tone: "bg-[#e8f3ff]",
  },
];

export default function DashboardPage() {
  return (
    <div className="animate-fade-up space-y-10">
      <div className="grid gap-4 sm:grid-cols-3">
        {quickLinks.map(({ href, label, value, hint, icon: Icon, tone }) => (
          <Link
            key={href}
            href={href}
            className={`group rounded-[1.5rem] p-5 transition hover:brightness-[0.98] ${tone}`}
          >
            <div className="flex items-start justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/80 text-plum">
                <Icon className="h-5 w-5" />
              </span>
              <ArrowRightIcon className="h-4 w-4 text-ink/30 transition group-hover:translate-x-0.5 group-hover:text-plum" />
            </div>
            <p className="mt-4 text-xs text-ink/50">{label}</p>
            <p className="mt-1 text-2xl font-medium text-ink">{value}</p>
            <p className="mt-1 text-[11px] text-ink/45">{hint}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:gap-14">
        <div className="space-y-10">
          <Calendar />
          <TodayTasks />
          <Link
            href="/dashboard/course"
            className="flex items-center justify-between gap-4 overflow-hidden rounded-[1.5rem] bg-[#ffe8d6] p-5 transition hover:brightness-[0.98]"
          >
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink/45">
                Upcoming workshop
              </p>
              <h3 className="mt-1 text-base font-medium text-ink">
                First Aid Practical Intensive
              </h3>
              <p className="mt-1 text-xs text-ink/55">6 Nov 2026 · On campus · HLTAID011</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-plum px-4 py-2 text-[11px] font-medium text-white">
              View course
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </span>
          </Link>
        </div>
        <div className="space-y-10">
          <Notification />
          <TeamChat />
        </div>
      </div>
    </div>
  );
}
