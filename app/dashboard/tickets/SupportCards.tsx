"use client";

import { useState } from "react";
import { CheckIcon } from "../_components/icons";
import BookingPanel from "./BookingPanel";
import SupportIcon from "./SupportIcons";
import { SUPPORT_GROUPS, type SupportGroup } from "@/lib/support-booking-meta";
import type { TicketDTO } from "@/lib/ticket-meta";

const PinIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);

// "Book support": one card per support group, laid out like a booking directory. The student ticks the options they
// need on a card, then Book support asks for a preferred time; the booking appears in their requests below and in
// Admin → Support (where it gets a priority and is assigned).
export default function SupportCards({ me, onBooked }: { me: { name: string; studentId: string; email: string }; onBooked: (t: TicketDTO) => void }) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [booking, setBooking] = useState<SupportGroup | null>(null);

  const toggle = (g: string, o: string) =>
    setPicked((p) => {
      const cur = p[g] ?? [];
      return { ...p, [g]: cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o] };
    });

  return (
    <section aria-labelledby="book-support-heading" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="book-support-heading" className="text-2xl font-semibold text-ink">
          Book support
        </h1>
        <span className="rounded-full bg-lilac px-2.5 py-0.5 text-xs font-semibold text-ink">{SUPPORT_GROUPS.length}</span>
        <p className="w-full text-sm text-ink">Tick what you need on a card, then select Book support to choose a time.</p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SUPPORT_GROUPS.map((g) => {
          const sel = picked[g.id] ?? [];
          const showAll = expanded[g.id] || g.options.length <= 3;
          const shown = showAll ? g.options : g.options.slice(0, 3);
          return (
            <li key={g.id}>
              <article aria-label={g.title} className="flex h-full flex-col rounded-2xl border border-ink/10 bg-white p-4 shadow-[0_8px_24px_-16px_rgba(31,27,46,0.3)]">
                <div className="flex items-start gap-3">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-sm ring-2 ring-white ${g.tone}`}>
                    <SupportIcon name={g.icon} className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-semibold leading-snug text-ink">{g.title}</span>
                    <span className="block text-sm text-ink">{g.subtitle}</span>
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${g.pill}`}>
                    <CheckIcon className="h-3.5 w-3.5" />
                    {g.options.length} option{g.options.length === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm text-ink">
                    <PinIcon className="h-4 w-4 text-plum" />
                    {g.where}
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink">{g.lines[0]}</p>
                <p className="text-xs text-ink">{g.lines[1]}</p>

                <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={`${g.title} options`}>
                  {shown.map((o) => {
                    const on = sel.includes(o.id);
                    // a form-link group has nothing to tick: its option is just shown
                    if (g.formLink)
                      return (
                        <span key={o.id} title={o.detail} className="inline-flex items-center rounded-full bg-[#efedf4] px-3 py-1.5 text-xs font-medium text-ink">
                          {o.label}
                        </span>
                      );
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => toggle(g.id, o.id)}
                        aria-pressed={on}
                        title={o.detail}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          on ? "bg-plum text-white shadow-sm" : "bg-[#efedf4] text-ink hover:bg-lilac"
                        }`}
                      >
                        {on && <CheckIcon className="h-3.5 w-3.5" />}
                        {o.label}
                      </button>
                    );
                  })}
                  {!showAll && (
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => ({ ...e, [g.id]: true }))}
                      aria-label={`Show ${g.options.length - 3} more ${g.title} options`}
                      className="rounded-full border border-ink/15 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-lilac"
                    >
                      +{g.options.length - 3}
                    </button>
                  )}
                </div>

                <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                  <span>
                    <span className="block text-sm font-bold text-ink">Free</span>
                    <span className="block text-xs text-ink">{sel.length ? `${sel.length} ticked` : "For enrolled students"}</span>
                  </span>
                  {g.formLink ? (
                    // not clickable for now
                    <span className="cursor-default rounded-full bg-plum px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-plum/25">Open a form link</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setBooking(g)}
                      className="rounded-full bg-plum px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-plum/25 transition hover:bg-plum-light"
                    >
                      Book support
                    </button>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {booking && (
        <BookingPanel
          group={booking}
          me={me}
          // the form starts with the card's ticks (a one-option group starts ticked); changes in the form stay in the form
          ticked={picked[booking.id]?.length ? picked[booking.id] : booking.options.length === 1 ? [booking.options[0].id] : []}
          onClose={() => setBooking(null)}
          onDone={(t) => {
            setPicked((p) => ({ ...p, [booking.id]: [] }));
            setBooking(null);
            onBooked(t);
          }}
        />
      )}
    </section>
  );
}
