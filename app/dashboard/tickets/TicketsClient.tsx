"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import {
  ArrowRightIcon,
  ChatIcon,
  CheckIcon,
  ClockIcon,
  PlusIcon,
  TicketIcon,
} from "../_components/icons";
import { TICKET_TOPICS, type TicketDTO, type TicketStatus } from "@/lib/ticket-meta";
import { createTicketAction, replyAsStudentAction } from "./actions";

// Students see friendlier names for the same statuses admins use
const label: Record<TicketStatus, string> = {
  Open: "Waiting",
  "In progress": "In progress",
  Resolved: "Sorted",
};

const statusStyle: Record<TicketStatus, string> = {
  Open: "bg-lilac text-plum",
  "In progress": "bg-plum/15 text-plum",
  Resolved: "bg-emerald-100 text-emerald-700",
};

const statusActiveStyle: Record<TicketStatus, string> = {
  Open: "bg-white/20 text-white",
  "In progress": "bg-white/20 text-white",
  Resolved: "bg-emerald-400/25 text-emerald-100",
};

const replyHint = (t: TicketDTO) =>
  t.status === "Resolved"
    ? "This one is closed"
    : t.status === "In progress"
      ? t.assignee !== "Unassigned"
        ? `${t.assignee} is looking at this`
        : "The college is checking this"
      : "Usually replies within 1 business day";

export default function TicketsClient({ initialTickets }: { initialTickets: TicketDTO[] }) {
  const [requests, setRequests] = useState(initialTickets);
  const [selectedId, setSelectedId] = useState(initialTickets[0]?.ticketId ?? null);
  const [asking, setAsking] = useState(initialTickets.length === 0);
  const [topic, setTopic] = useState<string>(TICKET_TOPICS[0].id);
  const [about, setAbout] = useState("");
  const [details, setDetails] = useState("");
  const [reply, setReply] = useState("");
  const [sending, startSending] = useTransition();
  const [replying, startReplying] = useTransition();

  const selected = requests.find((r) => r.ticketId === selectedId) ?? requests[0] ?? null;
  const count = (s: TicketStatus) => requests.filter((r) => r.status === s).length;

  const sendAsk = (e: React.FormEvent) => {
    e.preventDefault();
    startSending(async () => {
      const res = await createTicketAction({ topicId: topic, subject: about, details });
      if (!res.ok) return void toast.error(res.error);
      setRequests((list) => [res.ticket, ...list]);
      setSelectedId(res.ticket.ticketId);
      setAsking(false);
      setAbout("");
      setDetails("");
      toast.success(`Request ${res.ticket.ticketId} sent`);
    });
  };

  const sendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    startReplying(async () => {
      const res = await replyAsStudentAction(selected.ticketId, reply);
      if (!res.ok) return void toast.error(res.error);
      setRequests((list) => list.map((r) => (r.ticketId === res.ticket.ticketId ? res.ticket : r)));
      setReply("");
    });
  };

  return (
    <div className="animate-fade-up space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-ink sm:text-[1.65rem]">Need help?</h1>
          <p className="mt-1 max-w-xl text-sm text-ink/55">
            Ask the college anything about your course, assessments, or portal — then track
            replies here.
          </p>
        </div>
        <button
          onClick={() => setAsking((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-plum px-5 py-3 text-sm font-medium text-white transition hover:bg-plum-light"
        >
          <PlusIcon className="h-4 w-4" />
          Ask for help
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Waiting on reply", value: count("Open"), tone: "bg-lilac" },
          { label: "Being looked at", value: count("In progress"), tone: "bg-lilac/70" },
          { label: "Sorted", value: count("Resolved"), tone: "bg-emerald-50" },
        ].map((s) => (
          <div key={s.label} className={`rounded-[1.5rem] px-5 py-4 ${s.tone}`}>
            <p className="text-2xl font-medium text-ink">{s.value}</p>
            <p className="mt-1 text-xs text-ink/50">{s.label}</p>
          </div>
        ))}
      </div>

      {asking && (
        <form onSubmit={sendAsk} className="rounded-[1.75rem] bg-lilac/80 p-5 sm:p-6">
          <h2 className="text-base font-medium text-ink">What do you need help with?</h2>
          <p className="mt-1 text-xs text-ink/55">Pick a topic so we send it to the right team.</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {TICKET_TOPICS.map((t) => {
              const active = topic === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTopic(t.id)}
                  className={`rounded-2xl px-4 py-3 text-left transition ${
                    active ? "bg-plum text-white shadow-md shadow-plum/20" : "bg-white/80 text-ink hover:bg-white"
                  }`}
                >
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className={`mt-0.5 text-[11px] ${active ? "text-white/70" : "text-ink/45"}`}>{t.hint}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3">
            <input
              required
              maxLength={140}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Short title — e.g. Can’t upload assessment PDF"
              className="w-full rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/5 placeholder:text-ink/35 focus:ring-plum/30"
            />
            <textarea
              required
              rows={4}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Tell us what’s going on. Include unit codes or dates if you can."
              className="w-full resize-none rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/5 placeholder:text-ink/35 focus:ring-plum/30"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition hover:bg-plum-light disabled:cursor-wait disabled:opacity-60"
            >
              {sending ? "Sending…" : "Send request"}
              <ArrowRightIcon className="h-4 w-4" />
            </button>
            {requests.length > 0 && (
              <button
                type="button"
                onClick={() => setAsking(false)}
                className="rounded-full px-5 py-2.5 text-sm font-medium text-ink/60 transition hover:bg-white/60"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {requests.length > 0 && (
        <div className="grid gap-8 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] lg:gap-10">
          <section>
            <h2 className="text-lg font-medium text-ink">Your requests</h2>
            <ul className="mt-4 space-y-2 rounded-[2rem] bg-lilac/70 p-3 sm:p-4">
              {requests.map((item) => {
                const active = selected?.ticketId === item.ticketId;
                return (
                  <li key={item.ticketId}>
                    <button
                      onClick={() => setSelectedId(item.ticketId)}
                      className={`flex w-full flex-col gap-2 rounded-2xl px-4 py-4 text-left transition ${
                        active ? "bg-plum text-white shadow-lg shadow-plum/25" : "bg-white/70 text-ink hover:bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-[10px] font-medium ${active ? "text-white/60" : "text-ink/40"}`}>
                          {item.ticketId} · {item.topic}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                            active ? statusActiveStyle[item.status] : statusStyle[item.status]
                          }`}
                        >
                          {label[item.status]}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-snug">{item.subject}</p>
                      <p className={`text-[11px] ${active ? "text-white/65" : "text-ink/45"}`}>Asked {item.created}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="min-w-0">
            {selected ? (
              <div className="overflow-hidden rounded-[1.75rem] border border-ink/5 bg-white shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)]">
                <div className="border-b border-ink/5 bg-lilac/50 px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-ink/45">
                        {selected.ticketId} · {selected.topic}
                      </p>
                      <h2 className="mt-1 text-lg font-medium text-ink">{selected.subject}</h2>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink/50">
                        <ClockIcon className="h-3.5 w-3.5" />
                        {replyHint(selected)}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${statusStyle[selected.status]}`}>
                      {label[selected.status]}
                    </span>
                  </div>
                </div>

                <div className="soft-scroll max-h-[22rem] space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
                  {selected.messages.map((msg, i) => {
                    const mine = msg.from === "student";
                    return (
                      <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${mine ? "bg-plum text-white" : "bg-lilac text-ink"}`}>
                          <p className={`text-[10px] font-medium ${mine ? "text-white/70" : "text-ink/45"}`}>
                            {mine ? "You" : msg.name}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                          <p className={`mt-2 text-[10px] ${mine ? "text-white/55" : "text-ink/40"}`}>{msg.time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selected.status !== "Resolved" ? (
                  <form onSubmit={sendReply} className="flex items-center gap-3 border-t border-ink/5 bg-[#faf9fd] px-4 py-3 sm:px-5">
                    <ChatIcon className="h-4 w-4 shrink-0 text-plum/50" />
                    <input
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Write a follow-up message…"
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35"
                    />
                    <button
                      type="submit"
                      disabled={replying || !reply.trim()}
                      className="rounded-full bg-plum px-4 py-2 text-[11px] font-medium text-white transition hover:bg-plum-light disabled:opacity-50"
                    >
                      {replying ? "Sending…" : "Send"}
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 border-t border-ink/5 bg-emerald-50 px-5 py-3 text-xs text-emerald-700">
                    <CheckIcon className="h-4 w-4" />
                    This request is sorted. Ask for help again if you need anything else.
                  </div>
                )}
              </div>
            ) : (
              <div className="grid place-items-center rounded-[1.75rem] bg-lilac/70 px-6 py-16 text-center">
                <TicketIcon className="h-8 w-8 text-plum/40" />
                <p className="mt-3 text-sm text-ink/55">No requests yet — tap Ask for help to start.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
