import Link from "next/link";
import { Suspense } from "react";
import Calendar, { type CalendarDue } from "./_components/Calendar";
import Notification from "./_components/Notification";
import { ArrowRightIcon, ClipboardIcon, BoxIcon, TicketIcon } from "./_components/icons";
import { unitDueAt } from "@/lib/assessment-meta";
import { listCourseAssessments } from "@/lib/assessments";
import { requireStudent } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { listRequests } from "@/lib/documents";
import { listStudentDueDates } from "@/lib/due-dates";
import { listHiddenUnits } from "@/lib/hidden-units";
import { initials } from "@/lib/format";
import { getStudent, studyCodes } from "@/lib/students";
import { listTickets } from "@/lib/tickets";
import { listUnitRecords } from "@/lib/unit-records";
import { unitAccess } from "@/lib/unit-status-meta";

// The three cards at the top, counted for the logged-in student
async function QuickLinks() {
  const session = await requireStudent();
  const [student, tickets, requests] = await Promise.all([
    getStudent(session.sub),
    listTickets({ studentId: session.sub }),
    listRequests(session.sub),
  ]);
  const courses = student?.courses ?? [];
  const needed = requests.filter((request) => !request.file).length;
  const open = tickets.filter((t) => t.status !== "Resolved");
  const inProgress = open.filter((t) => t.status === "In progress").length;
  const links = [
    {
      href: "/dashboard/course",
      label: "My courses",
      value: courses.length,
      hint: courses.length === 1 ? "1 course enrolled" : `${courses.length} courses enrolled`,
      icon: BoxIcon,
      tone: "bg-[var(--s-lime)]",
    },
    {
      href: "/dashboard/requests#requested-heading",
      label: "Document requests",
      value: needed,
      hint: needed ? "Awaiting your upload" : "No uploads pending",
      icon: ClipboardIcon,
      tone: "bg-[var(--s-teal)]",
    },
    {
      href: "/dashboard/tickets",
      label: "Support requests",
      value: open.length,
      hint: open.length ? `${inProgress} in progress` : "No open requests",
      icon: TicketIcon,
      tone: "bg-[var(--s-pink)]",
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
      (student ? studyCodes(student) : []).map(async (code) => {
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
    <section aria-labelledby="summary-heading" className="s-card @container rounded-[1.75rem] p-5">
      <h2 id="summary-heading" className="text-xl font-semibold text-ink">My summary</h2>
      <div className="mt-4 grid gap-3 @[32rem]:grid-cols-3">
        {links.map(({ href, label, value, hint, icon: Icon, tone }) => (
          <Link
            key={label}
            href={href}
            className={`s-summary-tile group flex min-w-0 flex-col rounded-[1.5rem] p-4 text-[var(--s-tile-ink)] transition motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--s-dark)] ${tone}`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--s-badge)]">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-current/15 transition group-hover:bg-[var(--s-badge-hover)]">
                <ArrowRightIcon aria-hidden="true" className="h-4 w-4 -rotate-45" />
              </span>
            </span>
            <span className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-3">
              <span className="min-w-0 flex-1 basis-24">
                <span className="block text-base font-semibold leading-snug">{label}</span>
                <span className="mt-1 block text-xs leading-snug opacity-80">{hint}</span>
              </span>
              <span className="ml-auto grid min-h-10 min-w-10 shrink-0 place-items-center rounded-full bg-[var(--s-badge)] px-2 text-xl font-bold leading-none tabular-nums">{value}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// The student's own card at the top: initials, name, ID, email and the courses they're in
async function Profile() {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  const name = student?.name ?? session.name;
  const courses = await Promise.all((student?.courses ?? []).map(async (c) => ({ code: c.code, name: (await getCourse(c.code))?.name ?? c.code })));
  return <ProfileCard name={name} id={session.sub} email={student?.email ?? ""} courses={courses} />;
}

function ProfileCard({ name, id, email, courses }: { name: string; id: string; email: string; courses: { code: string; name: string }[] }) {
  return (
    <section aria-label="My details" className="s-card flex flex-wrap items-center gap-5 rounded-[1.75rem] p-5 sm:flex-nowrap">
      <span className="grid h-24 w-24 shrink-0 place-items-center rounded-[1.5rem] bg-[var(--s-avatar)] text-3xl font-bold text-[var(--s-tile-ink)]">{initials(name) || "·"}</span>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-semibold leading-tight text-ink">{name}</p>
        <p className="mt-1 text-base text-ink">
          <span className="font-semibold">Student</span> · ID {id}
        </p>
        {email && <p className="mt-0.5 truncate text-base text-ink">{email}</p>}
        {courses.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {courses.map((c) => (
              <span key={c.code} className="rounded-full bg-[var(--s-soft)] px-3 py-1 text-sm font-medium text-ink">
                {c.code} · {c.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// Shown while the counts load
const placeholder: Card[] = [
  { href: "/dashboard/course", label: "My courses", value: "–", hint: "Loading…", icon: BoxIcon, tone: "bg-[var(--s-lime)]" },
  { href: "/dashboard/requests#requested-heading", label: "Document requests", value: "–", hint: "Loading…", icon: ClipboardIcon, tone: "bg-[var(--s-teal)]" },
  { href: "/dashboard/tickets", label: "Support requests", value: "–", hint: "Loading…", icon: TicketIcon, tone: "bg-[var(--s-pink)]" },
];

export default function DashboardPage() {
  return (
    <div className="animate-fade-up space-y-5">
      <h1 className="text-3xl font-semibold text-ink sm:text-4xl">My Dashboard</h1>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <div className="min-w-0 space-y-5">
          <Suspense fallback={<ProfileCard name="" id="" email="" courses={[]} />}>
            <Profile />
          </Suspense>
          <Suspense fallback={<Cards links={placeholder} />}>
            <QuickLinks />
          </Suspense>
          <section className="s-card rounded-[1.75rem] p-5">
            <Suspense fallback={<Calendar />}>
              <DueCalendar />
            </Suspense>
          </section>
        </div>
        <aside className="s-card h-fit rounded-[1.75rem] p-5">
          <Notification />
        </aside>
      </div>
    </div>
  );
}
