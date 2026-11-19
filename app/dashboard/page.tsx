import Link from "next/link";
import { Suspense } from "react";
import Calendar, { type CalendarDue } from "./_components/Calendar";
import Notification from "./_components/Notification";
import PortalPromotions from "./_components/PortalPromotions";
import { ArrowRightIcon, BoxIcon, CalendarIcon, ClipboardIcon, HomeIcon, MailIcon, PhoneIcon, ShieldIcon, TicketIcon } from "./_components/icons";
import { unitDueAt } from "@/lib/assessment-meta";
import { listCourseAssessments } from "@/lib/assessments";
import { requireStudent } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { listExtensionRequests } from "@/lib/deadlines";
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

async function Profile() {
  const session = await requireStudent();
  const [student, requests] = await Promise.all([
    getStudent(session.sub),
    listExtensionRequests({ studentId: session.sub }),
  ]);
  const details = [
    { label: "Student ID", value: session.sub, icon: ClipboardIcon },
    { label: "Email", value: student?.email, icon: MailIcon },
    { label: "Phone", value: student?.phone, icon: PhoneIcon },
    { label: "State", value: student?.state, icon: HomeIcon },
  ];
  const activity = [
    { label: "Enrolled since", value: student?.enrolled, icon: CalendarIcon, className: "@[23rem]:col-span-2 @[43rem]:col-span-1" },
    { label: "Account status", value: student?.status, icon: ShieldIcon },
    { label: "Student portal requests", value: requests.length, icon: TicketIcon, href: "/dashboard/requests" },
  ];

  return <ProfileCard name={student?.name ?? session.name} details={details} activity={activity} />;
}

type ProfileDetail = {
  label: string;
  value?: string | number;
  icon: typeof BoxIcon;
  className?: string;
  href?: string;
};

function ProfileField({ label, value, icon: Icon, className = "", href }: ProfileDetail) {
  if (value === undefined || value === "") return null;

  return (
    <div className={`grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-x-2.5 ${className}`}>
      <span aria-hidden="true" className="row-span-2 grid size-8 place-items-center rounded-lg bg-[var(--s-soft)]">
        <Icon className="size-4" />
      </span>
      <dt className="text-xs font-medium text-ink/75">{label}</dt>
      <dd className="wrap-anywhere text-sm font-semibold text-ink">
        {href ? <Link href={href} aria-label={`${label}: ${value}`} className="hover:underline">{value}</Link> : value}
      </dd>
    </div>
  );
}

function ProfileCard({ name, details, activity }: { name: string; details: ProfileDetail[]; activity: ProfileDetail[] }) {
  return (
    <section aria-label="My details" className="s-card @container rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <span aria-hidden="true" className="s-profile-avatar grid size-16 shrink-0 place-items-center rounded-2xl text-2xl font-bold">
          {initials(name)}
        </span>
        <div className="min-w-0">
          <h2 className="s-student-name wrap-anywhere text-3xl font-semibold leading-tight">{name}</h2>
          <p className="mt-1 text-sm font-medium text-ink/75">Student</p>
        </div>
      </div>
      <dl className="mt-5 grid gap-x-5 gap-y-4 border-t border-[var(--s-line)] pt-4 @[23rem]:grid-cols-2 @[43rem]:grid-cols-3">
        {details.map((detail) => <ProfileField key={detail.label} {...detail} />)}
      </dl>
      <dl className="mt-4 grid gap-x-5 gap-y-4 @[23rem]:grid-cols-2 @[43rem]:grid-cols-3">
        {activity.map((detail) => <ProfileField key={detail.label} {...detail} />)}
      </dl>
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
        <div className="s-dashboard-center min-w-0 space-y-5">
          <Suspense fallback={<div aria-hidden="true" className="s-card min-h-40 rounded-[1.75rem]" />}>
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
        <aside className="min-w-0 space-y-5">
          <div className="s-card rounded-[1.75rem] p-5">
            <Notification />
          </div>
          <Suspense>
            <PortalPromotions />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}
