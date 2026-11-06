import Link from "next/link";
import { Suspense } from "react";
import Calendar, { type CalendarDue } from "./_components/Calendar";
import Notification from "./_components/Notification";
import { ArrowRightIcon, ClipboardIcon, BoxIcon, TicketIcon } from "./_components/icons";
import { unitDueAt } from "@/lib/assessment-meta";
import { listCourseAssessments } from "@/lib/assessments";
import { requireStudent } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { listStudentDueDates } from "@/lib/due-dates";
import { listHiddenUnits } from "@/lib/hidden-units";
import { getStudent } from "@/lib/students";
import { listTickets } from "@/lib/tickets";
import { listUnitRecords } from "@/lib/unit-records";
import { unitAccess } from "@/lib/unit-status-meta";

// The three cards at the top, counted for the logged-in student
async function QuickLinks() {
  const session = await requireStudent();
  const [student, tickets] = await Promise.all([getStudent(session.sub), listTickets({ studentId: session.sub })]);
  const courses = student?.courses ?? [];
  const active = courses.filter((c) => c.status === "Active").length;
  const open = tickets.filter((t) => t.status !== "Resolved");
  const inProgress = open.filter((t) => t.status === "In progress").length;
  const links = [
    {
      href: "/dashboard/course",
      label: "My courses",
      value: courses.length,
      hint: courses.length === 1 ? "1 course enrolled" : `${courses.length} courses enrolled`,
      icon: BoxIcon,
      tone: "bg-[#ffe8d6]",
    },
    {
      href: "/dashboard/course",
      label: "Active courses",
      value: active,
      hint: "Continue learning",
      icon: ClipboardIcon,
      tone: "bg-lilac",
    },
    {
      href: "/dashboard/tickets",
      label: "Open support requests",
      value: open.length,
      hint: open.length ? `${inProgress} in progress` : "No open support requests",
      icon: TicketIcon,
      tone: "bg-[#e8f3ff]",
    },
  ];
  return <Cards links={links} />;
}

// Due dates for the calendar dots: every unit the student can see (not hidden) without a final result yet;
// a locked unit is marked "Locked" in the pop-up.
// A due date Super Admin set for this student replaces the unit's own.
async function DueCalendar() {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  const dues: CalendarDue[] = (
    await Promise.all(
      (student?.courses ?? []).map(async ({ code }) => {
        const [course, assessments, ownDue, hidden, records] = await Promise.all([
          getCourse(code),
          listCourseAssessments(code),
          listStudentDueDates(session.sub, code),
          listHiddenUnits(session.sub, code),
          listUnitRecords(session.sub, code),
        ]);
        return (course?.units ?? []).flatMap((u) => {
          const iso = ownDue[u.code] ?? unitDueAt(assessments[u.code]);
          const rec = records[u.code] ?? null;
          const open = !hidden.has(u.code) && (rec?.status ?? "Active") === "Active";
          return iso && open
            ? [{ id: `${code}/${u.code}`, iso, label: `Due: ${u.code} – ${u.title}`, note: unitAccess(rec).open ? undefined : "Not open yet" }]
            : [];
        });
      }),
    )
  ).flat();
  return <Calendar dues={dues} />;
}

type Card = { href: string; label: string; value: number | string; hint: string; icon: typeof BoxIcon; tone: string };

function Cards({ links }: { links: Card[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {links.map(({ href, label, value, hint, icon: Icon, tone }) => (
        <Link
          key={label}
          href={href}
          className={`group rounded-[1.5rem] p-5 transition hover:brightness-[0.98] ${tone}`}
        >
          <div className="flex items-start justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/80 text-plum">
              <Icon className="h-5 w-5" />
            </span>
            <ArrowRightIcon className="h-4 w-4 text-ink transition group-hover:translate-x-0.5 group-hover:text-plum" />
          </div>
          <p className="mt-4 text-sm font-medium text-ink">{label}</p>
          <p className="mt-1 text-2xl font-medium text-ink">{value}</p>
          <p className="mt-1 text-xs font-medium text-ink">{hint}</p>
        </Link>
      ))}
    </div>
  );
}

// Shown while the counts load
const placeholder: Card[] = [
  { href: "/dashboard/course", label: "My courses", value: "–", hint: "Loading…", icon: BoxIcon, tone: "bg-[#ffe8d6]" },
  { href: "/dashboard/course", label: "Active courses", value: "–", hint: "Loading…", icon: ClipboardIcon, tone: "bg-lilac" },
  { href: "/dashboard/tickets", label: "Open support requests", value: "–", hint: "Loading…", icon: TicketIcon, tone: "bg-[#e8f3ff]" },
];

export default function DashboardPage() {
  return (
    <div className="animate-fade-up space-y-10">
      <Suspense fallback={<Cards links={placeholder} />}>
        <QuickLinks />
      </Suspense>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:gap-14">
        <div className="space-y-10">
          <Suspense fallback={<Calendar />}>
            <DueCalendar />
          </Suspense>
        </div>
        <div className="space-y-10">
          <Notification />
        </div>
      </div>
    </div>
  );
}
