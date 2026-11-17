import type { TicketDTO } from "@/lib/ticket-meta";

// Where a support request has got to: Submitted → Assigned → In progress → Done, the latest update (who and when),
// and the full history on demand. Shown to Super Admin / Admin (and to the assigned trainer).
export default function TicketProgress({ ticket }: { ticket: TicketDTO }) {
  const assigned = !!ticket.assigneeId || ticket.events.some((e) => e.text.startsWith("Assigned to"));
  const steps = [
    { label: "Submitted", done: true },
    { label: ticket.assigneeId ? `Assigned · ${ticket.assignee}` : "Assigned", done: assigned },
    { label: "In progress", done: ticket.status !== "Open" },
    { label: "Done", done: ticket.status === "Resolved" },
  ];
  const last = ticket.events[ticket.events.length - 1];

  return (
    <div className="mt-3 space-y-2">
      <ol className="flex flex-wrap items-center gap-1.5" aria-label={`Progress of ${ticket.ticketId}`}>
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className={`h-0.5 w-4 rounded ${s.done ? "bg-emerald-500" : "bg-ink/15"}`} />}
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.done ? "bg-emerald-100 text-emerald-800" : "bg-[#efedf4] text-ink"}`}>
              {s.done ? "✓ " : ""}
              {s.label}
            </span>
          </li>
        ))}
      </ol>
      {last && (
        <p className="text-sm text-ink">
          <span className="font-semibold">Last update:</span> {last.text} — {last.by} · {last.time}
        </p>
      )}
      {ticket.events.length > 1 && (
        <details className="text-sm text-ink">
          <summary className="cursor-pointer font-semibold text-plum">History ({ticket.events.length})</summary>
          <ul className="mt-2 space-y-1 border-l-2 border-ink/10 pl-3">
            {ticket.events.map((e, i) => (
              <li key={i}>
                <span className="font-semibold">{e.text}</span> — {e.by} · {e.time}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
