"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CalendarIcon, ClockIcon, CloseIcon, InfoIcon, LockIcon, MailIcon, VideoIcon } from "../../_components/icons";
import StudentDocuments, { type PlacementGroup } from "../StudentDocuments";
import type { CourseTrainerInfo } from "../CourseTrainer";
import type { SignedDocDTO } from "@/lib/document-meta";

export type DetailUnit = {
  code: string;
  title: string;
  href: string; // the unit player
  open: boolean;
  state: "open" | "scheduled" | "locked" | "closed"; // closed = has a final status (e.g. Competent)
  label: string; // "Active", "Opens 25 Nov 2026, 9:00 am", "Not open yet", "Competent"…
};
export type ClassTime = { id: string; day: string; time: string; link: string }; // one weekly class (time already formatted)
/** A one-off class session (workshop, revision class…) */
export type SessionItem = {
  id: string;
  title: string;
  when: string;
  unit: string | null;
  trainer: string | null;
  state: "upcoming" | "live" | "ended" | "cancelled";
  link: string | null; // set only while it can be joined (has a link, not cancelled or over)
  instructions: string;
};

type Tab = "units" | "course" | "placement" | "trainer";

const glass = "s-card backdrop-blur-xl backdrop-saturate-150";

const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const ICONS: Record<Tab, ReactNode> = {
  units: svg(<><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12.5 9 5 9-5M3 16.5l9 5 9-5" /></>),
  course: svg(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>),
  placement: svg(<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />),
  trainer: svg(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.9-3.2 3.4-5 6.5-5s5.6 1.8 6.5 5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 15.3c1.7.7 3 2.3 3.5 4.7" /></>),
};
const PERSON = svg(<><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" /></>);

const TABS: { id: Tab; label: string }[] = [
  { id: "units", label: "Units" },
  { id: "course", label: "Course documents" },
  { id: "placement", label: "Placement pack" },
  { id: "trainer", label: "Trainer" },
];

const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Weekly classes with the same time and link become one schedule (its days, in week order) */
function groupClasses(classes: ClassTime[]) {
  const groups = new Map<string, { key: string; time: string; link: string; days: string[]; joinId: string }>();
  for (const c of classes) {
    const key = `${c.time}|${c.link}`;
    const g = groups.get(key) ?? { key, time: c.time, link: c.link, days: [], joinId: c.id };
    g.days.push(c.day);
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({ ...g, days: WEEK.filter((d) => g.days.includes(d)) }));
}

const pill: Record<DetailUnit["state"], string> = {
  open: "bg-emerald-100 text-emerald-800",
  scheduled: "bg-amber-100 text-amber-900",
  locked: "bg-[var(--s-soft)] text-ink",
  closed: "bg-sky-100 text-sky-800",
};

// The course details page: units (with when they open), documents, placement pack and trainer, in tabs;
// the trainer and class times beside them.
export default function CourseDetails({
  units,
  placement,
  initialSigned,
  trainers,
  classes,
  sessions,
}: {
  units: DetailUnit[];
  placement: PlacementGroup[];
  initialSigned: SignedDocDTO[];
  trainers: CourseTrainerInfo[];
  classes: ClassTime[];
  sessions: SessionItem[];
}) {
  const [tab, setTab] = useState<Tab>("units");
  const anyOpen = units.some((u) => u.open);

  // Class schedule: the first 2 cards (weekly schedules, then upcoming sessions); "View all" opens every card in a pop-up
  const SHOWN = 2;
  const [allClasses, setAllClasses] = useState(false);
  const groups = groupClasses(classes);
  const cardCount = groups.length + sessions.length;
  const shownGroups = groups.slice(0, SHOWN);
  const shownSessions = sessions.slice(0, Math.max(0, SHOWN - groups.length));

  // The dark "active" pill slides to the clicked tab: measured from the active button, moved with a transform
  const listRef = useRef<HTMLDivElement>(null);
  const [pillBox, setPillBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const btn = list.querySelector<HTMLElement>(`#tab-${tab}`);
      if (btn) setPillBox({ x: btn.offsetLeft, y: btn.offsetTop, w: btn.offsetWidth, h: btn.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure); // tabs can wrap or change size (text size setting)
    ro.observe(list);
    return () => ro.disconnect();
  }, [tab]);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
      <div className="min-w-0 space-y-5">
        {/* Tabs */}
        <div
          ref={listRef}
          role="tablist"
          aria-label="Course sections"
          className={`${glass} relative flex flex-wrap gap-3 rounded-[2rem] p-2`}
          // a light shadow on every side (inline so it replaces the card's bottom-only shadow)
          style={{ boxShadow: "inset 0 1px 0 var(--s-surface-edge), 0 0 0 1px rgba(19, 33, 36, 0.04), 0 2px 16px rgba(19, 33, 36, 0.10)" }}
        >
          {pillBox && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 rounded-full bg-[var(--s-dark)] shadow-sm transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{ width: pillBox.w, height: pillBox.h, transform: `translate(${pillBox.x}px, ${pillBox.y}px)` }}
            />
          )}
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`relative z-10 inline-flex items-center gap-2.5 rounded-full px-6 py-3.5 text-lg font-semibold transition-colors duration-300 ${
                tab === t.id ? "text-white" : "text-ink hover:bg-[var(--s-soft)]"
              } ${tab === t.id && !pillBox ? "bg-[var(--s-dark)]" : "" /* before the first measure */}`}
            >
              {ICONS[t.id]}
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === "units" && (
            <section aria-labelledby="units-heading" className="space-y-4">
              <h2 id="units-heading" className="text-2xl font-bold text-ink">
                Your units
              </h2>
              {!anyOpen && units.length > 0 && (
                <p className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                  <InfoIcon className="h-5 w-5 shrink-0" />
                  Your units are not open yet. Your college will let you know when you can begin.
                </p>
              )}
              {units.length ? (
                <div className={`${glass} overflow-x-auto rounded-2xl`}>
                  <table className="w-full min-w-[520px] text-left">
                    <thead className="border-b border-[var(--s-line)] text-sm font-semibold text-ink">
                      <tr>
                        <th className="px-6 py-4">Unit Code &amp; Name</th>
                        <th className="py-4 pl-10 pr-6">Status</th>
                        <th className="py-4 pl-12 pr-6">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--s-line)]">
                      {units.map((u) => (
                        <tr key={u.code}>
                          <td className="px-6 py-5">
                            <p className="font-semibold text-ink">{u.title}</p>
                            <p className="text-sm text-ink/70">{u.code}</p>
                          </td>
                          <td className="px-6 py-5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${pill[u.state]}`}>
                              {!u.open && u.state !== "closed" && <LockIcon className="h-4 w-4" />}
                              {u.label}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            {u.open ? (
                              <Link
                                href={u.href}
                                aria-label={`Open ${u.title}`}
                                className="inline-flex rounded-full bg-[#1677f2] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f66d6]"
                              >
                                Open
                              </Link>
                            ) : (
                              <span aria-label="No action yet" className="text-ink/50">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={`${glass} rounded-2xl px-5 py-5 text-sm text-ink`}>No units are on this course yet.</p>
              )}
            </section>
          )}

          {tab === "course" && <StudentDocuments placement={placement} initialSigned={initialSigned} only="course" />}
          {tab === "placement" && <StudentDocuments placement={placement} initialSigned={initialSigned} only="placement" />}

          {tab === "trainer" && (
            <section aria-labelledby="trainer-heading" className="space-y-4">
              <h2 id="trainer-heading" className="text-2xl font-bold text-ink">
                {trainers.length > 1 ? "Your trainers" : "Your trainer"}
              </h2>
              {trainers.length ? (
                <ul className="space-y-3">
                  {trainers.map((t) => (
                    <li key={t.trainerId} className={`${glass} flex flex-wrap items-center gap-4 rounded-2xl p-5`}>
                      {t.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- private file served by /api/files
                        <img src={t.photo} alt="" className="size-14 shrink-0 rounded-2xl object-cover" />
                      ) : (
                        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#e3f1df] text-[#2f6b3a]">{PERSON}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold text-ink">{t.name}</p>
                        <p className="text-sm text-ink/70">Trainer{t.batch ? ` · ${t.batch}` : ""}</p>
                      </div>
                      <a
                        href={`mailto:${t.email}`}
                        className="inline-flex max-w-full items-center gap-2 rounded-xl border border-[var(--s-line)] px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-[var(--s-soft)]"
                      >
                        <MailIcon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{t.email}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={`${glass} rounded-2xl px-5 py-5 text-sm text-ink`}>No trainer assigned yet. The college will add one to your class.</p>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Beside the tabs: trainer and class times */}
      <aside className="space-y-5">
        <section aria-labelledby="side-trainer-heading" className={`${glass} rounded-[1.5rem] p-5`}>
          <h2 id="side-trainer-heading" className="text-lg font-bold text-ink">
            {trainers.length > 1 ? "Your trainers" : "Your trainer"}
          </h2>
          {trainers.length ? (
            <>
              <ul className="mt-3 space-y-2">
                {trainers.map((t) => (
                  <li key={t.trainerId} className="flex items-center gap-3">
                    {t.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- private file served by /api/files
                      <img src={t.photo} alt="" className="size-11 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#e3f1df] text-[#2f6b3a]">{PERSON}</span>
                    )}
                    <span className="font-semibold text-ink">{t.name}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setTab("trainer")}
                className="mt-4 flex w-full items-center justify-between rounded-xl border border-[var(--s-line)] px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-[var(--s-soft)]"
              >
                View trainer details
                <span aria-hidden>›</span>
              </button>
            </>
          ) : (
            <p className="mt-3 flex items-center gap-3 text-sm text-ink/70">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--s-soft)] text-ink/60">{PERSON}</span>
              No trainer assigned yet
            </p>
          )}
        </section>

        <section aria-labelledby="schedule-heading" className={`${glass} rounded-[1.5rem] p-5`}>
          <h2 id="schedule-heading" className="text-lg font-bold text-ink">
            Class schedule
          </h2>
          {cardCount ? (
            <ScheduleList groups={shownGroups} sessions={shownSessions} />
          ) : (
            <p className="mt-3 flex items-center gap-3 text-sm text-ink/80">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#ece4fb] text-[#172027]">
                <CalendarIcon className="h-5 w-5" />
              </span>
              Class times will appear here when added.
            </p>
          )}

          {cardCount > SHOWN && (
            <button
              type="button"
              onClick={() => setAllClasses(true)}
              aria-haspopup="dialog"
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--s-line)] px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-[var(--s-soft)]"
            >
              View all ({cardCount})
            </button>
          )}
          <SchedulePopup open={allClasses} onClose={() => setAllClasses(false)} groups={groups} sessions={sessions} />
        </section>
      </aside>
    </div>
  );
}

type ScheduleGroup = ReturnType<typeof groupClasses>[number];

/** Weekly schedule cards (days · time · Join), then upcoming one-off sessions */
function ScheduleList({ groups, sessions }: { groups: ScheduleGroup[]; sessions: SessionItem[] }) {
  return (
    <>
      {groups.length > 0 && (
        <ul className="mt-3 space-y-3">
              {/* classes at the same time with the same link are one schedule: its days, its time, one Join */}
              {groups.map((g) => (
                <li key={g.key} className="rounded-xl bg-[var(--s-soft)] p-3 text-sm text-ink">
                  {/* three lines: the days, the time, the link */}
                  <dl className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <dt className="flex w-14 shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/60">
                        <CalendarIcon className="h-4 w-4" />
                        Day
                      </dt>
                      <dd className="font-semibold">{g.days.map((d) => d.slice(0, 3)).join(", ")}</dd>
                    </div>
                    <div className="flex items-center gap-3">
                      <dt className="flex w-14 shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/60">
                        <ClockIcon className="h-4 w-4" />
                        Time
                      </dt>
                      <dd className="font-semibold">
                        {g.time} <span className="font-normal text-ink/70">(Melbourne)</span>
                      </dd>
                    </div>
                    <div className="flex items-center gap-3">
                      <dt className="flex w-14 shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/60">
                        <VideoIcon className="h-4 w-4" />
                        Link
                      </dt>
                      <dd className="min-w-0">
                        <a
                          href={`/classroom/${g.joinId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Join class"
                          className="block truncate font-semibold text-[#1677f2] hover:underline"
                        >
                          {g.link.replace(/^https?:\/\//, "")}
                        </a>
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
      )}
          {/* one-off sessions: workshops, revision classes… */}
          {sessions.length > 0 && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink/60">Upcoming sessions</p>
              <ul className="mt-2 space-y-2">
                {sessions.map((s) => (
                  <li key={s.id} className="rounded-xl bg-[var(--s-soft)] px-3 py-2.5 text-sm text-ink">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {s.title}
                      {s.state === "live" && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Live now</span>}
                      {s.state === "cancelled" && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">Cancelled</span>}
                    </p>
                    <p className={`mt-0.5 ${s.state === "cancelled" ? "text-ink/50 line-through" : "text-ink/80"}`}>{s.when}</p>
                    {(s.unit || s.trainer) && (
                      <p className="text-ink/70">
                        {[s.unit, s.trainer && `with ${s.trainer}`].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {s.instructions && s.state !== "cancelled" && <p className="mt-1 whitespace-pre-wrap text-xs text-ink/70">{s.instructions}</p>}
                    {s.state !== "cancelled" && (
                      <p className="mt-2 flex flex-wrap items-center gap-3">
                        {s.link ? (
                          <a href={s.link} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#1677f2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0f66d6]">
                            Join
                          </a>
                        ) : (
                          <span className="text-xs text-ink/60">Meeting link coming soon</span>
                        )}
                        <a href={`/api/calendar/${s.id}`} className="text-xs font-semibold text-ink underline decoration-[var(--s-line)] underline-offset-2 hover:decoration-current">
                          Add to calendar
                        </a>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

    </>
  );
}

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";
const CLOSE_MS = 220;

/** "View all": every weekly schedule and upcoming session in a pop-up (native <dialog>: Esc closes, focus stays inside) */
function SchedulePopup({ open, onClose, groups, sessions }: { open: boolean; onClose: () => void; groups: ScheduleGroup[]; sessions: SessionItem[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => setVisible(true));
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const close = () => {
    setVisible(false);
    window.setTimeout(() => {
      ref.current?.close();
      onClose();
    }, CLOSE_MS);
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="schedule-popup-title"
      onCancel={(e) => {
        e.preventDefault(); // Esc: close with the animation
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close(); // click on the backdrop
      }}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-visible bg-transparent p-0 text-ink backdrop:bg-[#0b1214]/45 backdrop:backdrop-blur-sm backdrop:transition-opacity backdrop:duration-300 motion-reduce:backdrop:transition-none ${
        visible ? "backdrop:opacity-100" : "backdrop:opacity-0"
      }`}
    >
      <div
        className={`max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[1.75rem] border border-[var(--s-line)] bg-[var(--s-card)] p-5 shadow-[0_30px_80px_-30px_rgba(11,18,20,0.55)] transition duration-300 ${EASE} motion-reduce:transition-none sm:p-6 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-95 opacity-0"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="schedule-popup-title" className="text-xl font-bold text-ink">
            Class schedule
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--s-soft)] text-ink transition hover:bg-[var(--s-icon)]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <ScheduleList groups={groups} sessions={sessions} />
      </div>
    </dialog>
  );
}
