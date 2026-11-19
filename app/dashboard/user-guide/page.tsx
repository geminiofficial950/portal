"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  ArrowRightIcon,
  BellIcon,
  BookIcon,
  BoxIcon,
  ChatIcon,
  CheckIcon,
  ClipboardIcon,
  ClockIcon,
  FileIcon,
  HeadsetIcon,
  InfoIcon,
  SearchIcon,
  SettingsIcon,
  TicketIcon,
  VideoIcon,
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
  icon: "book" | "box" | "clipboard" | "ticket" | "chat" | "clock" | "video" | "file" | "bell" | "headset" | "settings";
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
        detail: "Use Support for portal or assessment issues — Student Services replies there.",
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
        detail: "PDF, DOCX, or JPG under 10MB. Then tick the declaration and sign it with your mouse or a picture of your signature.",
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
        detail: "On the Support page, start a new request.",
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
    summary: "Phone, email, and booking options when a support request isn’t enough.",
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
  {
    id: "g6",
    category: "Assessments",
    title: "Ask for more time on a task",
    howDoI: "How do I ask for an extension?",
    summary: "Request an extension from the task itself, then follow your trainer’s decision under Requests.",
    readTime: "2 min",
    href: "/dashboard/requests",
    cta: "Open Requests",
    icon: "clock",
    tip: "Ask before the due date and give a clear reason — it helps your trainer decide quickly.",
    steps: [
      {
        title: "Open the task",
        detail: "Go to Courses, open your course and pick the unit and the task that needs more time.",
      },
      {
        title: "Select Request an extension",
        detail: "Answer “Why do you need more time?” in a sentence or two, then select Request extension.",
      },
      {
        title: "Wait for your trainer",
        detail: "The task shows “Request sent — your trainer will decide” until they reply.",
      },
      {
        title: "Check the decision",
        detail: "Requests in the menu lists every extension request. If it’s approved, you’ll get a notification with the new due date.",
      },
    ],
  },
  {
    id: "g7",
    category: "Assessments",
    title: "Respond to your trainer’s feedback",
    howDoI: "How do I accept feedback or ask for a review?",
    summary: "Read what your trainer wrote, then accept it or ask them to look at something again.",
    readTime: "3 min",
    href: "/dashboard/feedback",
    cta: "Open Feedback",
    icon: "chat",
    tip: "If you ask for a review, say exactly which part you’d like looked at again.",
    steps: [
      {
        title: "Open Feedback",
        detail: "Feedback in the menu lists every piece of feedback from your trainers, newest first.",
      },
      {
        title: "Read it carefully",
        detail: "Open one to see your result and your trainer’s comments. New ones say “Please respond to this feedback”.",
      },
      {
        title: "Accept it",
        detail: "Happy with it? Select Accept and sign. It then shows “You accepted this feedback”.",
      },
      {
        title: "Or ask for a review",
        detail: "Write what you’d like your trainer to look at again and select Send review request. You’ll see their reply on the same page.",
      },
    ],
  },
  {
    id: "g8",
    category: "Courses",
    title: "Join your live class",
    howDoI: "How do I join my class online?",
    summary: "Find your class days and times, and join from the portal when it’s on.",
    readTime: "2 min",
    href: "/dashboard/classroom",
    cta: "Open My classes",
    icon: "video",
    tip: "Join a few minutes early to check your microphone and camera.",
    steps: [
      {
        title: "Open My classes",
        detail: "It’s in the menu. You’ll see the day and time of each class (Melbourne time).",
      },
      {
        title: "Check the time",
        detail: "Your course page also shows your class times under Class schedule.",
      },
      {
        title: "Select Join",
        detail: "When the class is on it shows Live now — select Join to open the class.",
      },
      {
        title: "No link yet?",
        detail: "“Meeting link coming soon” means the college hasn’t added it yet. Check back closer to class time.",
      },
    ],
  },
  {
    id: "g9",
    category: "Courses",
    title: "Find your course and placement documents",
    howDoI: "Where are my course documents?",
    summary: "Every course has tabs for its units, documents, placement pack and trainer.",
    readTime: "2 min",
    href: "/dashboard/course",
    cta: "Open Courses",
    icon: "file",
    tip: "If the college asks you for a document, upload it where it says Upload document.",
    steps: [
      {
        title: "Open your course",
        detail: "Go to Courses and open the course you’re studying.",
      },
      {
        title: "Course documents",
        detail: "The Course documents tab has the files for your course — open or download them any time.",
      },
      {
        title: "Placement pack",
        detail: "The Placement pack tab has the forms and guides for your work placement.",
      },
      {
        title: "Your trainer",
        detail: "The Trainer tab shows who your trainer is and their email address.",
      },
    ],
  },
  {
    id: "g10",
    category: "Getting started",
    title: "Keep up with updates and due dates",
    howDoI: "How will I know when something changes?",
    summary: "Notifications and your calendar show new units, class changes and due dates.",
    readTime: "2 min",
    href: "/dashboard",
    cta: "Go to Dashboard",
    icon: "bell",
    tip: "Check your Dashboard at the start of each study session so you never miss a change.",
    steps: [
      {
        title: "Check Notifications",
        detail: "On your Dashboard you’ll be told when a unit is unlocked, a class changes or a due date moves.",
      },
      {
        title: "Look at your calendar",
        detail: "The calendar on your Dashboard marks your due dates and meetings. Select a day to see what’s on.",
      },
      {
        title: "Watch your email too",
        detail: "Important updates, like a unit opening for you, are also emailed to you.",
      },
      {
        title: "Act on it",
        detail: "Open the unit or class straight from the update, and start the work while it’s fresh.",
      },
    ],
  },
  {
    id: "g11",
    category: "Help",
    title: "Report a problem with the portal",
    howDoI: "Something isn’t working — what do I do?",
    summary: "Tell the tech team what went wrong, with screenshots, in under a minute.",
    readTime: "2 min",
    href: "/dashboard/tickets",
    cta: "Open Student support",
    icon: "headset",
    tip: "A screenshot of the error is the fastest way for us to fix it.",
    steps: [
      {
        title: "Select Tech support",
        detail: "It’s the button at the bottom of the menu, above your name.",
      },
      {
        title: "Give it a short title",
        detail: "For example “Upload button not working”.",
      },
      {
        title: "Say what went wrong",
        detail: "What were you doing, and what happened? Add any error message you saw, and add screenshots.",
      },
      {
        title: "Select Raise ticket",
        detail: "The tech team will look at it and reply. You can follow it under Student support.",
      },
    ],
  },
  {
    id: "g12",
    category: "Getting started",
    title: "Make the portal easier to read",
    howDoI: "Can I change the text size or colours?",
    summary: "Change the font and text size, switch to dark mode, or go full screen.",
    readTime: "1 min",
    href: "/dashboard",
    cta: "Go to Dashboard",
    icon: "settings",
    tip: "Your text settings are remembered on this device, so you only set them once.",
    steps: [
      {
        title: "Open Text Style",
        detail: "Select Aa Text Style at the top of the page.",
      },
      {
        title: "Pick a font and size",
        detail: "Choose a font you find easy to read and move the slider from 90% to 120%. Reset to default puts it back.",
      },
      {
        title: "Switch to dark mode",
        detail: "Select the moon button at the bottom of the menu. Select it again to go back to light.",
      },
      {
        title: "Go full screen",
        detail: "Select the full screen button next to Student Portal at the top of the menu.",
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
  clock: ClockIcon,
  video: VideoIcon,
  file: FileIcon,
  bell: BellIcon,
  headset: HeadsetIcon,
  settings: SettingsIcon,
};

// the same soft icon circles as the Student support cards
const tones: Record<Guide["icon"], string> = {
  book: "bg-[#e9e2fb] text-[#5b3f99]",
  box: "bg-sky-100 text-sky-800",
  clipboard: "bg-amber-100 text-amber-800",
  ticket: "bg-emerald-100 text-emerald-800",
  chat: "bg-rose-100 text-rose-800",
  clock: "bg-orange-100 text-orange-800",
  video: "bg-indigo-100 text-indigo-800",
  file: "bg-teal-100 text-teal-800",
  bell: "bg-yellow-100 text-yellow-800",
  headset: "bg-cyan-100 text-cyan-800",
  settings: "bg-slate-200 text-slate-800",
};

export default function UserGuidePage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [selectedId, setSelectedId] = useState(guides[0].id);
  const [doneSteps, setDoneSteps] = useState<Record<string, boolean>>({});
  const article = useRef<HTMLElement>(null);

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
  // the list reads by category (Getting started, Assessments, Courses, Help), in the order the guides are written
  const topics = useMemo(() => [...filtered].sort((a, b) => categories.indexOf(a.category as never) - categories.indexOf(b.category as never)), [filtered]);

  const selected = filtered.find((g) => g.id === selectedId) ?? filtered[0] ?? guides[0];
  const Icon = icons[selected.icon];
  const completed = selected.steps.filter((_, i) => doneSteps[`${selected.id}-${i}`]).length;

  const pick = (id: string) => {
    setSelectedId(id);
    // on a phone or tablet the guide sits under the list: bring it into view
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      requestAnimationFrame(() => article.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  return (
    <div className="animate-fade-up space-y-6">
      {/* lg: pushed down a little so it sits clear of the Text Style / clock bar in the top-right corner */}
      <div className="lg:pt-7">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">How do I…?</h1>
        <p className="mt-1.5 max-w-2xl text-base text-ink/80">
          Short guides for the things students ask most — the portal, courses, assessments and help.
        </p>
      </div>

      <div className="space-y-3">
        <label className="flex w-full max-w-xl items-center gap-3 rounded-full border border-[var(--s-line)] bg-[var(--s-card)] px-4 py-3 shadow-[0_8px_24px_-18px_rgba(19,33,36,0.35)] transition focus-within:border-[var(--s-dark)] focus-within:ring-4 focus-within:ring-[var(--s-dark)]/15">
          <SearchIcon className="h-5 w-5 shrink-0 text-ink/70" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search — e.g. upload assessment"
            aria-label="Search the guides"
            className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink/50"
          />
        </label>

        {/* categories: one scrolling row on a phone */}
        <div role="group" aria-label="Guide categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
          {categories.map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                aria-pressed={active}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "border-[var(--s-dark)] bg-[var(--s-dark)] text-white"
                    : "border-[var(--s-line)] bg-[var(--s-card)] text-ink hover:bg-[var(--s-soft)]"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:gap-6">
        <aside aria-labelledby="topics-heading" className="s-card rounded-[1.75rem] p-3 backdrop-blur-xl backdrop-saturate-150 sm:p-4 lg:sticky lg:top-4">
          <h2 id="topics-heading" className="px-2 pb-2 pt-1 text-lg font-bold text-ink">
            Topics
          </h2>
          {/* two columns on a tablet so the list isn't too long; one column beside the guide on a laptop */}
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
            {topics.map((guide) => {
              const active = selected.id === guide.id;
              const GIcon = icons[guide.icon];
              return (
                <li key={guide.id}>
                  <button
                    type="button"
                    onClick={() => pick(guide.id)}
                    aria-current={active ? "true" : undefined}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                      active ? "bg-[var(--s-dark)] text-white shadow-sm" : "text-ink hover:bg-[var(--s-soft)]"
                    }`}
                  >
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tones[guide.icon]}`}>
                      <GIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold leading-snug">{guide.howDoI}</span>
                      <span className={`mt-0.5 block text-sm ${active ? "text-white/80" : "text-ink/70"}`}>
                        {guide.category} · {guide.readTime}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="rounded-2xl bg-[var(--s-soft)] px-4 py-8 text-center text-sm text-ink sm:col-span-2 lg:col-span-1">Nothing matches “{query}”.</li>
            )}
          </ul>
        </aside>

        <article
          ref={article}
          key={selected.id}
          aria-labelledby="guide-heading"
          className="animate-fade-up s-card min-w-0 scroll-mt-20 overflow-hidden rounded-[1.75rem] backdrop-blur-xl backdrop-saturate-150"
        >
          <div className="border-b border-[var(--s-line)] px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex items-start gap-4">
              <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${tones[selected.icon]}`}>
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink/70">{selected.category}</p>
                <h2 id="guide-heading" className="mt-0.5 text-2xl font-bold leading-tight text-ink">
                  {selected.title}
                </h2>
                <p className="mt-2 text-base leading-relaxed text-ink/80">{selected.summary}</p>
              </div>
            </div>
            {/* how many steps the student has ticked off */}
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="h-2 min-w-[8rem] flex-1 overflow-hidden rounded-full bg-[var(--s-soft)]">
                <span
                  className="block h-full rounded-full bg-emerald-500 transition-[width] duration-500"
                  style={{ width: `${(completed / selected.steps.length) * 100}%` }}
                />
              </span>
              <span className="shrink-0 text-sm text-ink/75">
                {selected.readTime} · {completed}/{selected.steps.length} steps ticked
              </span>
            </div>
          </div>

          <ol className="space-y-2.5 px-5 py-5 sm:px-7 sm:py-6">
            {selected.steps.map((step, i) => {
              const key = `${selected.id}-${i}`;
              const done = Boolean(doneSteps[key]);
              return (
                <li key={key}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    onClick={() => setDoneSteps((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className={`flex w-full items-start gap-4 rounded-2xl border px-4 py-4 text-left transition ${
                      done ? "border-emerald-500/50 bg-emerald-500/10" : "border-[var(--s-line)] bg-[var(--s-card)] hover:bg-[var(--s-soft)]"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold transition ${
                        done ? "bg-[var(--s-dark)] text-white" : "bg-[var(--s-soft)] text-ink"
                      }`}
                    >
                      {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-base font-semibold text-ink ${done ? "line-through opacity-60" : ""}`}>{step.title}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-ink/80">{step.detail}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mx-5 mb-5 flex gap-3 rounded-2xl bg-[var(--s-soft)] px-4 py-4 sm:mx-7 sm:mb-6">
            <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink" />
            <p className="text-sm leading-relaxed text-ink">
              <span className="font-semibold">Tip: </span>
              {selected.tip}
            </p>
          </div>

          <div className="border-t border-[var(--s-line)] px-5 py-4 sm:px-7">
            <Link
              href={selected.href}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--s-dark)] px-6 py-3 text-base font-semibold text-white transition hover:opacity-90 sm:w-auto"
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
