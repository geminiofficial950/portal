"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { ChatIcon, TicketIcon } from "../dashboard/_components/icons";
import TicketThreadModal from "../superadmin/_components/TicketThreadModal";
import { TICKET_STATUSES, type TicketDTO, type TicketPriority, type TicketStatus } from "@/lib/ticket-meta";
import { replyAsTrainerAction, setStatusAsTrainerAction } from "./actions";

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

export default function TrainerTicketsClient({
  name,
  initialTickets,
  canHandle,
}: {
  name: string;
  initialTickets: TicketDTO[];
  canHandle: boolean;
}) {
  const [list, setList] = useState(initialTickets);
  const [filter, setFilter] = useState<"Active" | "Resolved">("Active");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const replace = (t: TicketDTO) => setList((l) => l.map((x) => (x.ticketId === t.ticketId ? t : x)));
  const visible = list.filter((t) => (filter === "Resolved" ? t.status === "Resolved" : t.status !== "Resolved"));
  const open = list.find((t) => t.ticketId === openId) ?? null;

  const setStatus = async (t: TicketDTO, status: TicketStatus) => {
    setBusyId(t.ticketId);
    try {
      const res = await setStatusAsTrainerAction(t.ticketId, status);
      if (!res.ok) return void toast.error(res.error);
      replace(res.ticket);
      toast.success(`${t.ticketId} marked ${status.toLowerCase()}`);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="animate-fade-up space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-ink sm:text-[1.65rem]">Hi {name.split(" ")[0]} 👋</h1>
        <p className="mt-1 text-sm text-ink/55">These are the student support requests assigned to you.</p>
      </div>

      {!canHandle && (
        <p className="rounded-2xl bg-amber-50 px-5 py-3 text-sm text-amber-800">
          Super Admin has turned off support handling for trainers — you can read requests but not reply or change them.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {TICKET_STATUSES.map((s) => (
          <div key={s} className={`rounded-[1.5rem] px-5 py-4 ${s === "Resolved" ? "bg-emerald-50" : "bg-lilac"}`}>
            <p className="text-2xl font-medium text-ink">{list.filter((t) => t.status === s).length}</p>
            <p className="mt-1 text-xs text-ink/50">{s}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {(["Active", "Resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-xs font-medium transition ${
              filter === f ? "bg-plum text-white" : "bg-lilac text-ink/70 hover:bg-plum/10"
            }`}
          >
            {f}
          </button>
        ))}
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
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${priorityStyle[t.priority]}`}>{t.priority}</span>
                <span className="text-[11px] text-ink/40">{t.topic}</span>
              </div>
              <p className="mt-1.5 font-medium text-ink">{t.subject}</p>
              <p className="mt-0.5 text-[11px] text-ink/45">
                {t.studentName} ({t.studentId}) · raised {t.created} · {t.messages.length} message{t.messages.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canHandle ? (
                <select
                  value={t.status}
                  disabled={busyId === t.ticketId}
                  onChange={(e) => setStatus(t, e.target.value as TicketStatus)}
                  aria-label={`Status of ${t.ticketId}`}
                  className={`rounded-full px-3 py-2 text-[11px] font-medium outline-none ${statusStyle[t.status]}`}
                >
                  {TICKET_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <span className={`rounded-full px-3 py-2 text-[11px] font-medium ${statusStyle[t.status]}`}>{t.status}</span>
              )}
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
            <p className="mt-3 text-sm text-ink/45">
              {filter === "Active" ? "Nothing assigned to you right now." : "No resolved requests yet."}
            </p>
          </li>
        )}
      </ul>

      {open && (
        <TicketThreadModal
          ticket={open}
          onClose={() => setOpenId(null)}
          onUpdate={replace}
          onSend={canHandle ? replyAsTrainerAction : undefined}
          readOnlyNote="Support handling is turned off for trainers."
        />
      )}
    </div>
  );
}
