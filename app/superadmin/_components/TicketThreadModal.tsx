"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { CloseIcon } from "../../dashboard/_components/icons";
import type { TicketDTO } from "@/lib/ticket-meta";

type SendResult = { ok: true; ticket: TicketDTO } | { ok: false; error: string };

// Ticket conversation in a dialog. `onSend` is the role-specific server action (admin or trainer);
// leave it out for a read-only view.
export default function TicketThreadModal({
  ticket,
  onClose,
  onUpdate,
  onSend,
  readOnlyNote,
}: {
  ticket: TicketDTO;
  onClose: () => void;
  onUpdate: (t: TicketDTO) => void;
  onSend?: (ticketId: string, text: string) => Promise<SendResult>;
  readOnlyNote?: string;
}) {
  const [reply, setReply] = useState("");
  const [sending, startSending] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    startSending(async () => {
      const res = await onSend!(ticket.ticketId, reply);
      if (!res.ok) return void toast.error(res.error);
      onUpdate(res.ticket);
      setReply("");
      toast.success("Reply sent");
    });
  };

  // Portal into the layout root so `fixed` isn't trapped by the page's transform animation
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 font-dm text-ink backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="thread-title"
        className="animate-fade-up flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl sm:max-h-[85dvh] sm:rounded-[1.75rem]"
      >
        <div className="relative bg-plum px-5 pb-5 pt-6 text-white sm:px-7">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full p-1.5 text-white transition hover:bg-white/10 hover:text-white"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
          <p className="text-[11px] font-medium uppercase tracking-wide text-peach">
            {ticket.ticketId} · {ticket.topic}
          </p>
          <h2 id="thread-title" className="mt-1 pr-8 text-lg font-medium leading-snug">
            {ticket.subject}
          </h2>
          <p className="mt-1 text-xs text-white">
            {ticket.studentName} ({ticket.studentId}) · {ticket.status} · {ticket.assignee}
          </p>
        </div>

        <div className="soft-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-7">
          {ticket.messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === "college" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.from === "college" ? "bg-plum text-white" : "bg-lilac text-ink"}`}>
                <p className={`text-[10px] font-medium ${m.from === "college" ? "text-white" : "text-ink"}`}>{m.name}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>
                <p className={`mt-2 text-[10px] ${m.from === "college" ? "text-white" : "text-ink"}`}>{m.time}</p>
              </div>
            </div>
          ))}
        </div>

        {onSend ? (
          <form onSubmit={send} className="flex items-end gap-3 border-t border-ink/5 bg-[#faf9fd] px-5 py-4 sm:px-7">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              placeholder={`Reply to ${ticket.studentName}…`}
              aria-label="Reply"
              className="min-w-0 flex-1 resize-none rounded-xl bg-white px-4 py-3 text-sm outline-none ring-1 ring-ink/5 placeholder:text-ink/35 focus:ring-plum/30"
            />
            <button
              type="submit"
              disabled={sending || !reply.trim()}
              className="rounded-full bg-plum px-5 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </form>
        ) : (
          <p className="border-t border-ink/5 bg-[#faf9fd] px-5 py-4 text-xs text-ink sm:px-7">{readOnlyNote}</p>
        )}
      </div>
    </div>,
    document.getElementById("portal-root") ?? document.body,
  );
}
