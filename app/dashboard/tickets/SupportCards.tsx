"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { CalendarIcon, CloseIcon, InfoIcon, PhoneIcon } from "../_components/icons";
import GuidedBooking from "./GuidedBooking";
import SupportIcon from "./SupportIcons";
import { SUPPORT_GROUPS, type SupportGroup } from "@/lib/support-booking-meta";
import type { TicketDTO } from "@/lib/ticket-meta";

const PHONE = { text: "1800 069 877", href: "tel:1800069877" };

const Chevron = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

const ArrowUpRight = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

// "Support, made simple": one card per support group. Selecting a card grows it into the guided booking for that group
// (needs → time → confirm); the booking appears under "Your bookings" and in Admin → Support.
// "Feedback and concerns" has no booking — it's the row with the form button under the cards.
export default function SupportCards({
  me,
  bookings,
  onBooked,
}: {
  me: { name: string; studentId: string; email: string };
  bookings: number;
  onBooked: (t: TicketDTO) => void;
}) {
  // the group being booked, and where its card was on screen (the booking grows out of it)
  const [booking, setBooking] = useState<{ group: SupportGroup; from: DOMRect | null } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const bookable = SUPPORT_GROUPS.filter((g) => !g.formLink);
  const forms = SUPPORT_GROUPS.filter((g) => g.formLink);

  const openForm = () => toast(`The feedback and complaints form is coming soon. For now, call ${PHONE.text}.`);
  // back to the cards: the booking shrinks away first
  const backToTopics = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return void setBooking(null);
    setLeaving(true);
    setTimeout(() => {
      setLeaving(false);
      setBooking(null);
    }, 190);
  };

  const showBookings = () => {
    const el = document.getElementById("my-bookings-heading");
    if (!el) return void toast("You haven’t booked any support yet.");
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section aria-labelledby="support-heading" className="space-y-4">
      {/* lg: pushed down a little so My bookings sits below the Text Style / clock bar in the top-right corner */}
      <div className="flex flex-wrap items-end justify-between gap-3 lg:pt-7">
        <div key={booking ? "guided" : "cards"} className="support-rise">
          <h1 id="support-heading" className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {booking ? "Let’s find the right support." : "Support, made simple."}
          </h1>
          <p className="mt-1.5 text-base text-ink/80">{booking ? "A few simple steps to book the help you need." : "Choose what you need help with."}</p>
        </div>
        <button
          type="button"
          onClick={showBookings}
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[var(--s-line)] bg-[var(--s-card)] px-3.5 py-1.5 text-sm font-semibold text-ink transition hover:bg-[var(--s-soft)]"
        >
          <CalendarIcon className="h-4 w-4" />
          My bookings
          {bookings > 0 && <span className="rounded-full bg-[var(--s-soft)] px-2 text-xs tabular-nums">{bookings}</span>}
        </button>
      </div>

      {booking ? (
        <div className={leaving ? "support-leave" : ""}>
          <GuidedBooking
            key={booking.group.id}
            group={booking.group}
            me={me}
            from={booking.from}
            onChangeTopic={backToTopics}
            onOpenForm={openForm}
            onHelpChoose={() => setChoosing(true)}
            onDone={(t) => {
              setBooking(null);
              onBooked(t);
            }}
          />
        </div>
      ) : (
      <div className="animate-fade-up space-y-4">
      <div className="s-card space-y-4 rounded-[1.75rem] p-4 backdrop-blur-xl backdrop-saturate-150 sm:p-5">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bookable.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={(e) => setBooking({ group: g, from: e.currentTarget.getBoundingClientRect() })}
                aria-label={`${g.title}: ${g.subtitle}. Book support`}
                className="group flex h-full w-full flex-col rounded-2xl border border-[var(--s-line)] bg-[var(--s-card)] p-5 text-left shadow-[0_8px_24px_-18px_rgba(19,33,36,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgba(19,33,36,0.45)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--s-dark)]/20"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${g.tone}`}>
                    <SupportIcon name={g.icon} className="h-6 w-6" />
                  </span>
                  <Chevron className="h-5 w-5 text-ink transition group-hover:translate-x-0.5" />
                </span>
                <span className="mt-3 block text-xl font-bold leading-snug text-ink">{g.title}</span>
                <span className="mt-0.5 block text-sm text-ink/75">{g.subtitle}</span>
              </button>
            </li>
          ))}
        </ul>

        {forms.map((g) => (
          <div key={g.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--s-line)] bg-[var(--s-card)] px-5 py-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--s-soft)] text-ink">
              <SupportIcon name={g.icon} className="h-6 w-6" />
            </span>
            {/* min width: on a phone the button wraps below instead of squeezing the text */}
            <span className="min-w-[12rem] flex-1">
              <span className="block text-lg font-bold text-ink">{g.title}</span>
              <span className="block text-sm text-ink/75">{g.subtitle}</span>
            </span>
            {/* no form link yet: the button says so instead of going nowhere */}
            <button
              type="button"
              onClick={openForm}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--s-dark)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Open form
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl bg-[#132124] px-5 py-4 text-white sm:px-7">
        <p className="text-lg font-bold">Not sure who to contact?</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <button
            type="button"
            onClick={() => setChoosing(true)}
            aria-haspopup="dialog"
            className="rounded-full bg-[#d6f5e3] px-6 py-2.5 text-sm font-semibold text-[#132124] transition hover:bg-[#c2efd5]"
          >
            Help me choose
          </button>
          <span aria-hidden className="hidden h-8 w-px bg-white/25 sm:block" />
          <a href={PHONE.href} className="inline-flex items-center gap-2 text-lg font-semibold hover:underline">
            <PhoneIcon className="h-5 w-5" />
            {PHONE.text}
          </a>
        </div>
      </div>

      <p className="flex items-center gap-2 px-1 text-sm text-ink/75">
        <InfoIcon className="h-4 w-4 shrink-0" />
        Support is free for enrolled students.
      </p>
      </div>
      )}

      {choosing && (
        <HelpMeChoose
          groups={bookable}
          onClose={() => setChoosing(false)}
          onPick={(g) => {
            setChoosing(false);
            setBooking({ group: g, from: null });
          }}
        />
      )}
    </section>
  );
}

// "Help me choose": every group with what it covers, so the student can find the right one and book it
function HelpMeChoose({ groups, onClose, onPick }: { groups: SupportGroup[]; onClose: () => void; onPick: (g: SupportGroup) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-choose-heading"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
          <span>
            <span id="help-choose-heading" className="block text-lg font-semibold text-ink">
              Which support do I need?
            </span>
            <span className="block text-sm text-ink/75">Find what you need help with, then book it.</span>
          </span>
          <button type="button" onClick={onClose} aria-label="Close" autoFocus className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink hover:bg-lilac">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <ul className="divide-y divide-ink/10">
          {groups.map((g) => (
            <li key={g.id}>
              <button type="button" onClick={() => onPick(g)} className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-lilac/60">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${g.tone}`}>
                  <SupportIcon name={g.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{g.title}</span>
                  <span className="block text-sm text-ink/75">{g.options.map((o) => o.detail).join(" · ")}</span>
                </span>
                <Chevron className="mt-2.5 h-4 w-4 shrink-0 text-ink" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
