"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { CheckIcon, CloseIcon } from "../_components/icons";
import { replyAsStudentAction } from "./actions";
import type { TicketDTO, TicketStatus } from "@/lib/ticket-meta";

// After a student books support: one simple card per booking — that it was submitted, what they asked for, and the
// status. View opens the booking with the college's responses (read only).
const STATUS: Record<TicketStatus, { text: string; tone: string }> = {
  Open: { text: "Waiting", tone: "bg-amber-100 text-amber-900" },
  "In progress": { text: "Being arranged", tone: "bg-sky-100 text-sky-900" },
  Resolved: { text: "Done", tone: "bg-emerald-100 text-emerald-800" },
};

const responsesOf = (t: TicketDTO) => t.messages.filter((m) => m.from === "college");

export default function BookingResults({ tickets, onUpdate }: { tickets: TicketDTO[]; onUpdate: (t: TicketDTO) => void }) {
  const [viewing, setViewing] = useState<TicketDTO | null>(null);
  if (!tickets.length) return null;
  return (
    <section aria-labelledby="my-bookings-heading" className="space-y-3">
      <h2 id="my-bookings-heading" className="text-xl font-semibold text-ink">
        Your bookings
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tickets.map((t) => {
          const st = STATUS[t.status];
          const n = responsesOf(t).length;
          return (
            <li key={t.ticketId} aria-label={`Booking ${t.ticketId}`} className="flex flex-col rounded-2xl border border-ink/10 bg-white p-4 shadow-[0_8px_24px_-16px_rgba(31,27,46,0.3)]">
              <div className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                    <CheckIcon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">Booking submitted</span>
                    <span className="block text-xs text-ink">
                      {t.ticketId} · {t.created}
                    </span>
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.tone}`}>{st.text}</span>
              </div>

              <p className="mt-3 text-base font-semibold text-ink">{t.booking?.group ?? t.subject}</p>
              {t.booking && (
                <>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.booking.services.map((s) => (
                      <span key={s} className="rounded-full bg-lilac px-2.5 py-1 text-xs font-medium text-ink">
                        {s}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-ink">{t.booking.when}</p>
                  <p className="text-sm text-ink">{t.booking.mode}</p>
                </>
              )}

              <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                <span className="text-sm font-semibold text-ink">{n ? `${n} response${n === 1 ? "" : "s"}` : "No response yet"}</span>
                <button
                  type="button"
                  onClick={() => setViewing(t)}
                  aria-label={`View ${t.ticketId}`}
                  className="rounded-full bg-plum px-4 py-2 text-sm font-semibold text-white transition hover:bg-plum-light"
                >
                  View
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {viewing && <BookingView ticket={tickets.find((t) => t.ticketId === viewing.ticketId) ?? viewing} onClose={() => setViewing(null)} onUpdate={onUpdate} />}
    </section>
  );
}

function BookingView({ ticket: t, onClose, onUpdate }: { ticket: TicketDTO; onClose: () => void; onUpdate: (t: TicketDTO) => void }) {
  const [reply, setReply] = useState("");
  const [sending, start] = useTransition();
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    start(async () => {
      const res = await replyAsStudentAction(t.ticketId, reply);
      if (!res.ok) return void toast.error(res.error);
      onUpdate(res.ticket);
      setReply("");
      toast.success("Reply sent");
    });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // the conversation after the booking itself: the college's responses and the student's replies
  const responses = t.messages.slice(1);
  const st = STATUS[t.status];

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Booking ${t.ticketId}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
          <span>
            <span className="block text-lg font-semibold text-ink">{t.booking?.group ?? t.subject}</span>
            <span className="block text-sm text-ink">
              {t.ticketId} · {t.created}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.tone}`}>{st.text}</span>
            <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-ink hover:bg-lilac">
              <CloseIcon className="h-5 w-5" />
            </button>
          </span>
        </div>

        <div className="space-y-4 px-5 py-4">
          {t.booking && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm text-ink">
              <dt className="font-semibold">Services</dt>
              <dd>{t.booking.services.join(", ")}</dd>
              <dt className="font-semibold">When</dt>
              <dd>{t.booking.when}</dd>
              <dt className="font-semibold">Mode</dt>
              <dd>{t.booking.mode}</dd>
              <dt className="font-semibold">Contact</dt>
              <dd className="break-all">{t.booking.contact}</dd>
            </dl>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Response</h3>
            {responses.length ? (
              <ul className="space-y-2">
                {responses.map((m, i) => (
                  <li key={i} className={`rounded-xl px-4 py-3 ${m.from === "student" ? "ml-8 bg-lilac" : "mr-8 bg-[#f5f3fa]"}`}>
                    <p className="whitespace-pre-wrap text-sm text-ink">{m.text}</p>
                    <p className="mt-1.5 text-xs text-ink">
                      {m.from === "student" ? "You" : m.name} · {m.time}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-[#f5f3fa] px-4 py-3 text-sm text-ink">No response yet. The college will reply here.</p>
            )}
          </div>

          {t.status !== "Resolved" && (
            <form onSubmit={send} className="flex items-end gap-2">
              <textarea
                rows={2}
                maxLength={4000}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply…"
                aria-label="Your reply"
                className="min-w-0 flex-1 resize-none rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-plum focus:ring-4 focus:ring-plum/15"
              />
              <button type="submit" disabled={sending || !reply.trim()} className="rounded-xl bg-plum px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-plum-light disabled:cursor-not-allowed disabled:bg-plum/50">
                {sending ? "Sending…" : "Send"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.getElementById("portal-root") ?? document.body,
  );
}
