"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRightIcon,
  BookIcon,
  BoxIcon,
  ChatIcon,
  CheckIcon,
  ClipboardIcon,
  SearchIcon,
  TicketIcon,
} from "../_components/icons";

type Guide = {
  id: string;
  category: string;
  title: string;
  howDoI: string;
  summary: string;
  readTime: string;
  href: string;
  cta: string;
  icon: "book" | "box" | "clipboard" | "ticket" | "chat";
  steps: { title: string; detail: string }[];
  tip: string;
};

const categories = ["All", "Getting started", "Assessments", "Courses", "Help"] as const;

const guides: Guide[] = [
  {
    id: "g1",
    category: "Getting started",
    title: "Find your way around the portal",
    howDoI: "Where do I start each day?",
    summary: "A quick map of Dashboard, Courses, Assessments, and Help so nothing feels hidden.",
    readTime: "3 min",
    href: "/dashboard",
    cta: "Go to Dashboard",
    icon: "book",
    tip: "Check Today’s tasks on the Dashboard before opening a new module.",
    steps: [
      {
        title: "Open Dashboard",
        detail: "See your calendar, today’s tasks, and any new trainer notes in one place.",
      },
      {
        title: "Jump to Courses",
        detail: "Continue the module you’re on and watch lectures or open documents.",
      },
      {
        title: "Check Assessments",
        detail: "View due dates, open an assessment, then upload evidence when ready.",
      },
      {
        title: "Ask for help if stuck",
        detail: "Use Tickets for portal or assessment issues — Student Services replies there.",
      },
    ],
  },
  {
    id: "g2",
    category: "Assessments",
    title: "Submit assessment evidence",
    howDoI: "How do I upload my work?",
    summary: "File types, size limits, and how to know your upload actually went through.",
    readTime: "4 min",
    href: "/dashboard/course",
    cta: "Open my course",
    icon: "clipboard",
    tip: "Name your file with your student ID and unit code — trainers find it faster.",
    steps: [
      {
        title: "Open the assessment",
        detail: "From Course, tap Go to my course, then pick the unit and the task in the list on the right.",
      },
      {
        title: "Read the instructions",
        detail: "Tick off the checklist so you don’t miss a required step.",
      },
      {
        title: "Upload your file",
        detail: "PDF, DOCX, or JPG under 10MB. Replace the file if you picked the wrong one.",
      },
      {
        title: "Submit and wait",
        detail: "You’ll see a confirmation. Status updates when your trainer marks it.",
      },
    ],
  },
  {
    id: "g3",
    category: "Courses",
    title: "Continue a lecture or document",
    howDoI: "How do I keep learning?",
    summary: "Open a course, pick a video or document, and track which modules are done.",
    readTime: "3 min",
    href: "/dashboard/course",
    cta: "Open Courses",
    icon: "box",
    tip: "Use Full screen on videos when you’re revising on a laptop.",
    steps: [
      {
        title: "Choose your course",
        detail: "Pick a course from Your Courses, then Open Course.",
      },
      {
        title: "Select a lesson",
        detail: "Videos and documents sit under Lesson materials on the left.",
      },
      {
        title: "Follow the module list",
        detail: "The right panel shows Done, Current, and Locked modules.",
      },
      {
        title: "Come back anytime",
        detail: "Progress saves against the course — next class dates show on the card.",
      },
    ],
  },
  {
    id: "g4",
    category: "Help",
    title: "Ask Student Services for help",
    howDoI: "Who do I message when I’m stuck?",
    summary: "Send a clear request, pick the right topic, and follow replies in one thread.",
    readTime: "2 min",
    href: "/dashboard/tickets",
    cta: "Ask for help",
    icon: "ticket",
    tip: "Include unit codes and dates — replies come faster when details are clear.",
    steps: [
      {
        title: "Tap Ask for help",
        detail: "On the Tickets page, start a new request.",
      },
      {
        title: "Pick a topic",
        detail: "Assessment, classes, portal, or course — so it reaches the right team.",
      },
      {
        title: "Write a short title + details",
        detail: "Explain what’s wrong in plain language. Screenshots help for portal issues.",
      },
      {
        title: "Watch the conversation",
        detail: "Status moves from Waiting → In progress → Sorted. Reply in the same thread.",
      },
    ],
  },
  {
    id: "g5",
    category: "Help",
    title: "Contact support another way",
    howDoI: "Can I call or email instead?",
    summary: "Phone, email, and booking options when a ticket isn’t enough.",
    readTime: "2 min",
    href: "/dashboard/support",
    cta: "Open Support",
    icon: "chat",
    tip: "Support desk hours are Mon–Fri, 9:00 AM – 5:00 PM AEST.",
    steps: [
      {
        title: "Open Support",
        detail: "See email, phone, and ticket shortcuts on one page.",
      },
      {
        title: "Try FAQs first",
        detail: "Password resets, extensions, and meeting bookings are covered there.",
      },
      {
        title: "Send a message",
        detail: "Use the form if you want a written reply within one business day.",
      },
      {
        title: "Visit Student Services",
        detail: "For longer chats about enrolment or study plans, visit the campus support desk.",
      },
    ],
  },
];

const icons = {
  book: BookIcon,
  box: BoxIcon,
  clipboard: ClipboardIcon,
  ticket: TicketIcon,
  chat: ChatIcon,
};

export default function UserGuidePage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [selectedId, setSelectedId] = useState(guides[0].id);
  const [doneSteps, setDoneSteps] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guides.filter((g) => {
      const catOk = category === "All" || g.category === category;
      const textOk =
        !q ||
        g.title.toLowerCase().includes(q) ||
        g.howDoI.toLowerCase().includes(q) ||
        g.summary.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q);
      return catOk && textOk;
    });
  }, [query, category]);

  const selected = filtered.find((g) => g.id === selectedId) ?? filtered[0] ?? guides[0];
  const Icon = icons[selected.icon];
  const completed = selected.steps.filter((_, i) => doneSteps[`${selected.id}-${i}`]).length;

  return (
    <div className="animate-fade-up space-y-6">
      <div className="overflow-hidden rounded-[1.75rem] bg-plum px-6 py-7 text-white sm:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
          Student help
        </p>
        <h1 className="mt-2 text-2xl font-semibold sm:text-[1.75rem]">How do I…?</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
          Short guides for the things students ask most — portal, courses, assessments, and help.
        </p>
        <label className="mt-5 flex max-w-md items-center gap-3 rounded-full bg-white/10 px-4 py-3 ring-1 ring-white/15">
          <SearchIcon className="h-4 w-4 shrink-0 text-white/70" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search — e.g. upload assessment"
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/45"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const active = category === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                active
                  ? "bg-plum text-white"
                  : "bg-lilac text-ink hover:bg-lilac/80 hover:text-ink"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] lg:gap-10">
        <aside>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-ink">
            Topics
          </p>
          <ul className="space-y-2">
            {filtered.map((guide) => {
              const active = selected.id === guide.id;
              const GIcon = icons[guide.icon];
              return (
                <li key={guide.id}>
                  <button
                    onClick={() => setSelectedId(guide.id)}
                    className={`flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left transition ${
                      active
                        ? "bg-plum text-white shadow-lg shadow-plum/20"
                        : "bg-lilac/70 text-ink hover:bg-lilac"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                        active ? "bg-white/15" : "bg-white text-plum"
                      }`}
                    >
                      <GIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-snug">{guide.howDoI}</span>
                      <span
                        className={`mt-1 block text-[11px] ${active ? "text-white/65" : "text-ink"}`}
                      >
                        {guide.readTime}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="rounded-2xl bg-lilac/70 px-4 py-8 text-center text-sm text-ink">
                Nothing matches “{query}”.
              </li>
            )}
          </ul>
        </aside>

        <article className="min-w-0 overflow-hidden rounded-[1.75rem] border border-ink/5 bg-white shadow-[0_12px_40px_-16px_rgba(91,63,153,0.12)]">
          <div className="border-b border-ink/5 bg-lilac/40 px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex flex-wrap items-start gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-plum shadow-sm">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-plum/70">
                  {selected.category}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-ink sm:text-[1.35rem]">
                  {selected.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink">{selected.summary}</p>
                <p className="mt-3 text-[11px] text-ink">
                  {selected.readTime} · {completed}/{selected.steps.length} steps ticked
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 px-5 py-5 sm:px-7 sm:py-6">
            {selected.steps.map((step, i) => {
              const key = `${selected.id}-${i}`;
              const done = Boolean(doneSteps[key]);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setDoneSteps((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                  className={`flex w-full gap-4 rounded-2xl px-4 py-4 text-left transition ${
                    done ? "bg-plum/8" : "bg-lilac/50 hover:bg-lilac/80"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-medium ${
                      done ? "bg-plum text-white" : "bg-white text-plum ring-1 ring-plum/15"
                    }`}
                  >
                    {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-medium text-ink ${done ? "line-through opacity-60" : ""}`}>
                      {step.title}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-ink">
                      {step.detail}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mx-5 mb-5 rounded-2xl bg-lilac/70 px-4 py-4 sm:mx-7 sm:mb-6">
            <p className="text-[10px] font-medium uppercase tracking-wide text-plum/70">Tip</p>
            <p className="mt-1 text-sm leading-relaxed text-ink">{selected.tip}</p>
          </div>

          <div className="border-t border-ink/5 px-5 py-4 sm:px-7">
            <Link
              href={selected.href}
              className="inline-flex items-center gap-2 rounded-full bg-plum px-5 py-3 text-sm font-medium text-white transition hover:bg-plum-light"
            >
              {selected.cta}
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
