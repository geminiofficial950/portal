"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { ChatIcon, SearchIcon, TicketIcon } from "../../dashboard/_components/icons";
import TicketThreadModal from "../_components/TicketThreadModal";
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketDTO,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/ticket-meta";
import { assignTicketAction, replyTicketAction, setTicketPriorityAction, setTicketStatusAction } from "./actions";

const statusStyle: Record<TicketStatus, string> = {
  Open: "bg-amber-100 text-amber-700",
  "In progress": "bg-plum/15 text-plum",
  Resolved: "bg-emerald-100 text-emerald-700",
};

const priorityStyle: Record<TicketPriority, string> = {
  High: "bg-rose-100 text-rose-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-lilac text-plum",
};

type Res = { ok: true; ticket: TicketDTO } | { ok: false; error: string };

type Assignee = { trainerId: string; name: string };

export default function TicketsClient({ initialTickets, assignees }: { initialTickets: TicketDTO[]; assignees: Assignee[] }) {
  const [list, setList] = useState(initialTickets);
  const [filter, setFilter] = useState<"All" | TicketStatus>("All");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const replace = (t: TicketDTO) => setList((l) => l.map((x) => (x.ticketId === t.ticketId ? t : x)));

  const run = async (id: string, action: () => Promise<Res>, msg: string) => {
    setBusyId(id);
    try {
      const res = await action();
      if (!res.ok) return void toast.error(res.error);
      replace(res.ticket);
      toast.success(msg);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  const q = query.trim().toLowerCase();
  const visible = list.filter(
    (t) =>
      (filter === "All" || t.status === filter) &&
      (!q || t.subject.toLowerCase().includes(q) || t.studentName.toLowerCase().includes(q) || t.ticketId.toLowerCase().includes(q)),
  );
  const open = list.find((t) => t.ticketId === openId) ?? null;

  // Keep the current assignee selectable even if they were later switched off
  const optionsFor = (t: TicketDTO): Assignee[] =>
    t.assigneeId && !assignees.some((a) => a.trainerId === t.assigneeId)
      ? [...assignees, { trainerId: t.assigneeId, name: `${t.assignee} (off)` }]
      : assignees;

  return (
    <div className="animate-fade-up space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-ink sm:text-[1.65rem]">Support</h1>
        <p className="mt-1 text-sm text-ink">Every student request in one place. Assign it, reply, then move it to resolved.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {TICKET_STATUSES.map((s) => (
          <div key={s} className={`rounded-[1.5rem] px-5 py-4 ${s === "Resolved" ? "bg-emerald-50" : "bg-lilac"}`}>
            <p className="text-2xl font-medium text-ink">{list.filter((t) => t.status === s).length}</p>
            <p className="mt-1 text-xs text-ink">{s}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["All", ...TICKET_STATUSES] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                filter === f ? "bg-plum text-white" : "bg-lilac text-ink hover:bg-plum/10"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <label className="flex w-full items-center gap-2 rounded-full bg-lilac px-4 py-2.5 sm:w-72">
          <SearchIcon className="h-4 w-4 text-plum/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subject, student or ID…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35"
          />
        </label>
      </div>

      <ul className="space-y-3">
        {visible.map((t) => (
          <li
            key={t.ticketId}
            className={`grid gap-4 rounded-[1.5rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] transition lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center ${
              busyId === t.ticketId ? "opacity-60" : ""
            }`}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-plum">{t.ticketId}</span>
                <span className="text-[11px] text-ink">{t.topic}</span>
              </div>
              <p className="mt-1.5 font-medium text-ink">{t.subject}</p>
              <p className="mt-0.5 text-[11px] text-ink">
                {t.studentName} ({t.studentId}) · raised {t.created} · {t.messages.length} message{t.messages.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={t.priority}
                disabled={busyId === t.ticketId}
                onChange={(e) => {
                  const p = e.target.value as TicketPriority;
                  run(t.ticketId, () => setTicketPriorityAction(t.ticketId, p), `${t.ticketId} priority set to ${p}`);
                }}
                aria-label={`Priority of ${t.ticketId}`}
                className={`rounded-full px-3 py-2 text-[11px] font-medium outline-none ${priorityStyle[t.priority]}`}
              >
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <select
                value={t.assigneeId ?? ""}
                disabled={busyId === t.ticketId}
                onChange={(e) => {
                  const id = e.target.value || null;
                  const name = assignees.find((a) => a.trainerId === id)?.name;
                  run(t.ticketId, () => assignTicketAction(t.ticketId, id), name ? `${t.ticketId} assigned to ${name}` : `${t.ticketId} unassigned`);
                }}
                aria-label={`Assign ${t.ticketId}`}
                className="rounded-full bg-lilac px-3 py-2 text-[11px] font-medium text-ink outline-none"
              >
                <option value="">Unassigned</option>
                {optionsFor(t).map((a) => (
                  <option key={a.trainerId} value={a.trainerId}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select
                value={t.status}
                disabled={busyId === t.ticketId}
                onChange={(e) => {
                  const s = e.target.value as TicketStatus;
                  run(t.ticketId, () => setTicketStatusAction(t.ticketId, s), `${t.ticketId} marked ${s.toLowerCase()}`);
                }}
                aria-label={`Status of ${t.ticketId}`}
                className={`rounded-full px-3 py-2 text-[11px] font-medium outline-none ${statusStyle[t.status]}`}
              >
                {TICKET_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button
                onClick={() => setOpenId(t.ticketId)}
                className="inline-flex items-center gap-1.5 rounded-full bg-plum px-4 py-2 text-[11px] font-medium text-white transition hover:bg-plum-light"
              >
                <ChatIcon className="h-3.5 w-3.5" />
                View
              </button>
            </div>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="grid place-items-center rounded-[1.5rem] bg-lilac/70 px-5 py-12 text-center">
            <TicketIcon className="h-8 w-8 text-plum/40" />
            <p className="mt-3 text-sm text-ink">
              {list.length === 0 ? "No support requests yet — they appear here when students ask for help." : "No support requests match."}
            </p>
          </li>
        )}
      </ul>

      {open && (
        <TicketThreadModal ticket={open} onClose={() => setOpenId(null)} onUpdate={replace} onSend={replyTicketAction} />
      )}
    </div>
  );
}
