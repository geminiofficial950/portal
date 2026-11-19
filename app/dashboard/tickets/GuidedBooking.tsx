"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ArrowRightIcon, CalendarIcon, CheckIcon, ClipboardIcon, HeadsetIcon, PhoneIcon } from "../_components/icons";
import { bookSupportAction } from "./actions";
import SupportIcon from "./SupportIcons";
import { CALLBACK_WINDOWS, SUPPORT_MODES, SUPPORT_NOTE_MAX, SUPPORT_TIMES, isEmail, isPhone, timeLabel, type SupportGroup } from "@/lib/support-booking-meta";
import type { TicketDTO } from "@/lib/ticket-meta";

type Me = { name: string; studentId: string; email: string };
type Step = 2 | 3 | 4; // step 1 (Topic) is the card the student picked

const STEPS = ["Topic", "Your needs", "Time", "Confirm"] as const;
const MODE_LABEL: Record<string, string> = { "Video call": "Video", "Phone call": "Phone", "In person": "In person" };
const field = "h-12 w-full rounded-xl border border-[var(--s-line)] bg-[var(--s-card)] px-4 text-base text-ink outline-none transition focus:border-[var(--s-dark)] focus:ring-4 focus:ring-[var(--s-dark)]/15";
const chip = (on: boolean) =>
  `rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
    on ? "border-[var(--s-dark)] bg-[var(--s-dark)] text-white shadow-sm" : "border-[var(--s-line)] bg-[var(--s-card)] text-ink hover:bg-[var(--s-soft)]"
  }`;

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

// The guided booking a support card grows into: Topic ✓ → Your needs → Time → Confirm, with "Your booking" and
// "Not sure where to start?" (Help me choose + phone) beside it.
// `from` is where the clicked card was on screen, so the booking card can grow out of it.
export default function GuidedBooking({
  group,
  me,
  from,
  onChangeTopic,
  onDone,
  onOpenForm,
  onHelpChoose,
}: {
  group: SupportGroup;
  me: Me;
  from: DOMRect | null;
  onChangeTopic: () => void;
  onDone: (t: TicketDTO) => void;
  onOpenForm: () => void;
  onHelpChoose: () => void;
}) {
  const [step, setStep] = useState<Step>(2);
  const [dir, setDir] = useState<"next" | "back">("next");
  // a one-option group starts ticked
  const [ticked, setTicked] = useState<string[]>(group.options.length === 1 ? [group.options[0].id] : []);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [mode, setMode] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [contact, setContact] = useState(me.email);
  const [busy, start] = useTransition();
  const card = useRef<HTMLDivElement>(null);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  // grow out of the clicked card (FLIP): start at the card's box, then animate to the booking's own box
  useLayoutEffect(() => {
    const el = card.current;
    if (!el || !from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = el.getBoundingClientRect();
    el.style.transformOrigin = "top left";
    el.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
    el.getBoundingClientRect(); // apply the start position before animating
    el.style.transition = "transform 560ms cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.transform = "";
    const done = () => {
      el.style.transition = "";
      el.style.transformOrigin = "";
    };
    el.addEventListener("transitionend", done, { once: true });
    if (to.top < 0 || to.top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [from]);

  const go = (to: Step) => {
    setDir(to > step ? "next" : "back");
    setStep(to);
  };

  const picked = group.options.filter((o) => ticked.includes(o.id));
  const contactOk = isEmail(contact) || isPhone(contact);
  const canGo = step === 2 ? picked.length > 0 : step === 3 ? !!date && !!slot && !!mode : consent && contactOk;
  const whenText = date && slot ? `${dayLabel(date)}, ${SUPPORT_TIMES.includes(slot) ? timeLabel(slot) : `call back ${slot.toLowerCase()}`}` : "";

  const next = () => {
    if (!canGo) return;
    if (step < 4) return go((step + 1) as Step);
    start(async () => {
      const res = await bookSupportAction({ groupId: group.id, optionIds: ticked, date, slot, mode, note, consent, contact });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Booking sent (${res.ticket.ticketId})`);
      onDone(res.ticket);
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
        {/* the booking card */}
        <div ref={card} className="s-card overflow-hidden rounded-[1.75rem] backdrop-blur-xl backdrop-saturate-150">
          <div className="support-rise" style={{ animationDelay: "180ms" }}>
            <Stepper step={step} onPick={(s) => (s === 1 ? onChangeTopic() : s < step && go(s as Step))} />

            <div className="px-5 pb-5 pt-4 sm:px-6">
              <button type="button" onClick={step === 2 ? onChangeTopic : () => go((step - 1) as Step)} className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:underline">
                <span aria-hidden>‹</span> {step === 2 ? "Change topic" : `Back to ${STEPS[step - 2].toLowerCase()}`}
              </button>

              <div className="mt-3 flex items-center gap-3">
                <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${group.tone}`}>
                  <SupportIcon name={group.icon} className="h-7 w-7" />
                </span>
                <span className="min-w-0">
                  <span className="block text-2xl font-bold leading-tight text-ink">{group.title}</span>
                  <span className="block text-base text-ink/80">
                    {step === 2 ? "What would you like help with?" : step === 3 ? "When suits you?" : "Check and send your booking."}
                  </span>
                </span>
              </div>

              {/* the step itself, sliding in from the side it came from */}
              <div key={step} className={`mt-4 ${dir === "next" ? "support-step-next" : "support-step-back"}`}>
                {step === 2 && (
                  <fieldset>
                    <legend className="sr-only">What would you like help with?</legend>
                    <ul className="space-y-2.5">
                      {group.options.map((o) => {
                        const on = ticked.includes(o.id);
                        return (
                          <li key={o.id}>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              onClick={() => setTicked((t) => (on ? t.filter((x) => x !== o.id) : [...t, o.id]))}
                              className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition ${
                                on ? "border-emerald-500/50 bg-emerald-500/10" : "border-[var(--s-line)] bg-[var(--s-card)] hover:bg-[var(--s-soft)]"
                              }`}
                            >
                              <span
                                className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition ${
                                  on ? "border-[var(--s-dark)] bg-[var(--s-dark)] text-white" : "border-ink/30"
                                }`}
                              >
                                {on && <CheckIcon className="h-4 w-4" />}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-lg font-semibold leading-snug text-ink">{o.label}</span>
                                <span className="block text-sm text-ink/75">{o.detail}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {group.options.length > 1 && <p className="mt-3 text-sm text-ink/75">You can choose more than one.</p>}
                  </fieldset>
                )}

                {step === 3 && (
                  <div className="space-y-5">
                    <label className="block max-w-xs">
                      <span className="mb-1.5 block text-sm font-semibold text-ink">Preferred date</span>
                      <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className={field} />
                    </label>
                    <fieldset>
                      <legend className="mb-1.5 block text-sm font-semibold text-ink">Preferred time (Melbourne)</legend>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(5.75rem,1fr))] gap-2">
                        {SUPPORT_TIMES.map((t) => (
                          <button key={t} type="button" aria-pressed={slot === t} onClick={() => setSlot(t)} className={chip(slot === t)}>
                            <span className="whitespace-nowrap">{timeLabel(t)}</span>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend className="mb-1.5 block text-sm font-semibold text-ink">Or ask for a call back</legend>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {CALLBACK_WINDOWS.map((w) => (
                          <button key={w} type="button" aria-pressed={slot === w} onClick={() => setSlot(w)} className={chip(slot === w)}>
                            {w}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend className="mb-1.5 block text-sm font-semibold text-ink">How would you like to meet?</legend>
                      <div role="radiogroup" aria-label="Meeting mode" className="grid grid-cols-3 gap-2">
                        {SUPPORT_MODES.map((m) => (
                          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={chip(mode === m)}>
                            {MODE_LABEL[m]}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-5">
                    <p className="rounded-xl bg-[var(--s-soft)] px-4 py-3 text-sm text-ink">
                      Booking for <span className="font-semibold">{me.name}</span> · {me.studentId}
                    </p>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-ink">Anything we should know? (optional)</span>
                      <textarea
                        rows={3}
                        maxLength={SUPPORT_NOTE_MAX}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full resize-none rounded-xl border border-[var(--s-line)] bg-[var(--s-card)] px-4 py-3 text-base text-ink outline-none transition focus:border-[var(--s-dark)] focus:ring-4 focus:ring-[var(--s-dark)]/15"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-ink">Best phone number or email to reach you</span>
                      <input
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        aria-invalid={!!contact && !contactOk}
                        className={`${field} ${contact && !contactOk ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/15" : ""}`}
                      />
                    </label>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--s-dark)]" />
                      <span className="text-sm font-semibold text-ink">I agree to share these details with the support officer</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--s-line)] pt-4">
                <button type="button" onClick={step === 2 ? onChangeTopic : () => go((step - 1) as Step)} className="px-1 text-base font-semibold text-ink underline underline-offset-4">
                  Back
                </button>
                <button
                  type="button"
                  onClick={next}
                  disabled={!canGo || busy}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--s-dark)] px-6 py-3 text-base font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busy ? "Sending…" : step === 4 ? "Book support" : "Continue"}
                  {!busy && <ArrowRightIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* beside it: what's chosen so far, and help choosing */}
        <aside className="space-y-4">
          <section aria-labelledby="your-booking-heading" className="support-rise s-card rounded-[1.5rem] p-5" style={{ animationDelay: "260ms" }}>
            <h2 id="your-booking-heading" className="text-xl font-bold text-ink">
              Your booking
            </h2>
            <dl className="mt-3 divide-y divide-[var(--s-line)]">
              <SummaryRow icon={<SupportIcon name={group.icon} className="h-5 w-5" />} tone={group.tone} term="Topic" value={group.title} />
              <SummaryRow
                icon={<ClipboardIcon className="h-5 w-5" />}
                tone="bg-emerald-500/15 text-emerald-700"
                term="Support"
                value={picked.length ? picked.map((o) => o.label).join(", ") : "Not selected"}
                muted={!picked.length}
              />
              <SummaryRow
                icon={<CalendarIcon className="h-5 w-5" />}
                tone="bg-[var(--s-soft)] text-ink"
                term="Time"
                value={whenText ? `${whenText}${mode ? ` · ${MODE_LABEL[mode]}` : ""}` : "Not selected"}
                muted={!whenText}
              />
            </dl>
          </section>

          <section aria-labelledby="start-heading" className="support-rise s-card rounded-[1.5rem] p-5" style={{ animationDelay: "340ms" }}>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 text-ink">
              <HeadsetIcon className="h-6 w-6" />
            </span>
            <h2 id="start-heading" className="mt-4 text-2xl font-bold leading-tight text-ink">
              Not sure where to start?
            </h2>
            <p className="mt-1.5 text-base text-ink/80">Speak with Student Services.</p>
            <button
              type="button"
              onClick={onHelpChoose}
              aria-haspopup="dialog"
              className="mt-5 w-full rounded-full bg-[var(--s-dark)] px-6 py-3 text-base font-semibold text-white transition hover:opacity-90"
            >
              Help me choose
            </button>
            <a href="tel:1800069877" className="mt-4 inline-flex items-center gap-3 px-2 text-lg text-ink hover:underline">
              <PhoneIcon className="h-5 w-5" />
              1800 069 877
            </a>
          </section>
        </aside>
      </div>

      <p className="support-rise flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-sm text-ink/80" style={{ animationDelay: "400ms" }}>
        <span>
          Feedback, complaints or appeals?{" "}
          <button type="button" onClick={onOpenForm} className="font-semibold text-ink underline underline-offset-4">
            Open form ↗
          </button>
        </span>
        <span aria-hidden className="hidden h-4 w-px bg-ink/20 sm:block" />
        <span>Support is free for enrolled students.</span>
      </p>
    </div>
  );
}

function Stepper({ step, onPick }: { step: Step; onPick: (s: number) => void }) {
  return (
    <ol className="flex items-center gap-2 border-b border-[var(--s-line)] px-4 py-3 sm:gap-3 sm:px-6">
      {STEPS.map((name, i) => {
        const n = i + 1;
        const done = n < step;
        const now = n === step;
        return (
          <li key={name} className={`flex items-center gap-2 sm:gap-3 ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
            <button
              type="button"
              onClick={() => onPick(n)}
              disabled={!done}
              aria-current={now ? "step" : undefined}
              className="flex items-center gap-2 disabled:cursor-default"
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors duration-300 ${
                  now ? "bg-[var(--s-dark)] text-white" : done ? "bg-emerald-500/15 text-emerald-700" : "bg-[var(--s-soft)] text-ink/70"
                }`}
              >
                {done ? <CheckIcon className="h-4 w-4" /> : n}
              </span>
              <span className={`text-sm ${now ? "font-semibold text-ink" : "text-ink/70"} ${now ? "" : "hidden md:inline"}`}>{name}</span>
            </button>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="relative h-px flex-1 overflow-hidden bg-[var(--s-line)]">
                <span className={`absolute inset-0 origin-left bg-emerald-500/60 transition-transform duration-500 ${done ? "scale-x-100" : "scale-x-0"}`} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function SummaryRow({ icon, tone, term, value, muted = false }: { icon: React.ReactNode; tone: string; term: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${tone}`}>{icon}</span>
      <span className="min-w-0">
        <dt className="text-sm text-ink/75">{term}</dt>
        <dd key={value} className={`support-rise text-base font-semibold ${muted ? "font-normal text-ink/70" : "text-ink"}`}>
          {value}
        </dd>
      </span>
    </div>
  );
}
