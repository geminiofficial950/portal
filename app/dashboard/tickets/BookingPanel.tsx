"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { CheckIcon, CloseIcon } from "../_components/icons";
import { bookSupportAction } from "./actions";
import SupportIcon from "./SupportIcons";
import { CALLBACK_WINDOWS, SUPPORT_MODES, SUPPORT_NOTE_MAX, SUPPORT_TIMES, isEmail, isPhone, timeLabel, type SupportGroup } from "@/lib/support-booking-meta";
import type { TicketDTO } from "@/lib/ticket-meta";

type Me = { name: string; studentId: string; email: string };

const control = "h-12 w-full rounded-xl border border-ink/15 bg-white px-4 text-base text-ink outline-none transition focus:border-plum focus:ring-4 focus:ring-plum/15";
const label = "mb-1.5 block text-sm font-semibold text-ink";

// The booking form slides in from the right. It has exactly the fields from the LMS guide, nothing else:
// 1 name and student ID (from the login) · 2 services ticked · 3 preferred date and time, or call-back window ·
// 4 meeting mode · 5 short description (optional) · 6 consent · 7 preferred contact number or email
export default function BookingPanel({
  group,
  me,
  ticked: initialTicked,
  onClose,
  onDone,
}: {
  group: SupportGroup;
  me: Me;
  ticked: string[]; // what was ticked on the card when the form opened — the form keeps its own copy

  onClose: () => void;
  onDone: (t: TicketDTO) => void;
}) {
  const [shown, setShown] = useState(false);
  // the form's own selection: ticking here doesn't change the card
  const [ticked, setTicked] = useState<string[]>(initialTicked);
  const onTick = (id: string) => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [mode, setMode] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [contact, setContact] = useState(me.email);
  const [busy, start] = useTransition();
  const closeBtn = useRef<HTMLButtonElement>(null);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    closeBtn.current?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = overflow;
    };
  }, []);

  const close = useCallback(() => {
    setShown(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const contactOk = isEmail(contact) || isPhone(contact);
  const ready = ticked.length > 0 && !!date && !!slot && !!mode && consent && contactOk;

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    start(async () => {
      const res = await bookSupportAction({ groupId: group.id, optionIds: ticked, date, slot, mode, note, consent, contact });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Booking sent (${res.ticket.ticketId})`);
      setShown(false);
      setTimeout(() => onDone(res.ticket), 280);
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="presentation">
      <div onClick={close} className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`} />

      <form
        role="dialog"
        aria-modal="true"
        aria-label={`Book support — ${group.title}`}
        onSubmit={send}
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-[-24px_0_60px_-20px_rgba(31,27,46,0.35)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* header */}
        <div className="flex items-center gap-3 border-b border-ink/10 px-6 py-5">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${group.tone}`}>
            <SupportIcon name={group.icon} className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold leading-tight text-ink">Book support</span>
            <span className="block text-sm text-ink">{group.title}</span>
          </span>
          <button ref={closeBtn} type="button" onClick={close} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-ink transition hover:bg-lilac">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* exactly the seven fields */}
        <div className="soft-scroll flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {/* 1. Name and student ID */}
          <label className="block">
            <span className={label}>Name and student ID</span>
            <input readOnly value={`${me.name} · ${me.studentId}`} aria-label="Name and student ID" className={`${control} cursor-default bg-[#f5f3fa]`} />
          </label>

          {/* 2. Services ticked */}
          <fieldset>
            <legend className={label}>Services ticked</legend>
            <div className="flex flex-wrap gap-2">
              {group.options.map((o) => {
                const on = ticked.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    title={o.detail}
                    onClick={() => onTick(o.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
                      on ? "border-plum bg-plum text-white" : "border-ink/15 bg-white text-ink hover:border-plum/50"
                    }`}
                  >
                    {on && <CheckIcon className="h-4 w-4" />}
                    {o.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* 3. Preferred date and time, or call-back window */}
          <fieldset>
            <legend className={label}>Preferred date and time, or call-back window</legend>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Preferred date" className={control} />
              <select value={slot} onChange={(e) => setSlot(e.target.value)} aria-label="Preferred time or call-back window" className={control}>
                <option value="">Time or call-back</option>
                <optgroup label="Preferred time">
                  {SUPPORT_TIMES.map((t) => (
                    <option key={t} value={t}>
                      {timeLabel(t)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Call-back window">
                  {CALLBACK_WINDOWS.map((w) => (
                    <option key={w} value={w}>
                      Call back: {w}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </fieldset>

          {/* 4. Meeting mode */}
          <fieldset>
            <legend className={label}>Meeting mode: video, phone or in person</legend>
            <div role="radiogroup" aria-label="Meeting mode" className="grid grid-cols-3 gap-1 rounded-xl bg-[#f0eef6] p-1">
              {SUPPORT_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={`h-10 rounded-lg text-sm font-semibold transition ${mode === m ? "bg-plum text-white shadow-sm" : "text-ink hover:bg-lilac"}`}
                >
                  {m === "Video call" ? "Video" : m === "Phone call" ? "Phone" : "In person"}
                </button>
              ))}
            </div>
          </fieldset>

          {/* 5. Short description */}
          <label className="block">
            <span className={label}>Short description (optional)</span>
            <textarea
              rows={3}
              maxLength={SUPPORT_NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Short description"
              className="w-full resize-none rounded-xl border border-ink/15 bg-white px-4 py-3 text-base text-ink outline-none transition focus:border-plum focus:ring-4 focus:ring-plum/15"
            />
          </label>

          {/* 6. Consent */}
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-plum" />
            <span className="text-sm font-semibold text-ink">Consent to share these details with the support officer</span>
          </label>

          {/* 7. Preferred contact number or email */}
          <label className="block">
            <span className={label}>Preferred contact number or email</span>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              aria-label="Preferred contact number or email"
              className={`${control} ${contact && !contactOk ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/15" : ""}`}
            />
          </label>
        </div>

        {/* actions */}
        <div className="flex gap-3 border-t border-ink/10 px-6 py-4">
          <button type="button" onClick={close} className="h-12 flex-1 rounded-xl border border-ink/15 text-base font-semibold text-ink transition hover:bg-lilac">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !ready}
            className="h-12 flex-[2] rounded-xl bg-plum text-base font-semibold text-white transition hover:bg-plum-light disabled:cursor-not-allowed disabled:bg-plum/50"
          >
            {busy ? "Sending…" : "Book support"}
          </button>
        </div>
      </form>
    </div>,
    document.getElementById("portal-root") ?? document.body,
  );
}
