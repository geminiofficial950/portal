"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { decideExtensionAction } from "../../actions/deadlines";
import LocalTime from "../../dashboard/assessment/_components/LocalTime";
import type { ExtensionRequestDTO } from "@/lib/deadline-meta";

const field = "rounded-xl bg-white px-3 py-2 text-sm text-ink outline-none ring-1 ring-ink/15 placeholder:text-ink/60 focus:ring-plum/40";
const tone = { Pending: "bg-amber-100 text-amber-900", Approved: "bg-emerald-100 text-emerald-800", Declined: "bg-rose-100 text-rose-800" } as const;

// Extension requests for staff to decide: approve with a new deadline (only that student and module), or decline with a reason.
// A decision never changes a result or opens a unit that isn't Active and opened.
export default function ExtensionInbox({ initial }: { initial: ExtensionRequestDTO[] }) {
  const [list, setList] = useState(initial);
  const [show, setShow] = useState<"Pending" | "All">("Pending");
  const shown = list.filter((r) => show === "All" || r.status === "Pending");
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["Pending", "All"] as const).map((k) => (
          <button key={k} onClick={() => setShow(k)} className={`rounded-full px-4 py-2 text-xs font-semibold ${show === k ? "bg-plum text-white" : "bg-lilac text-ink"}`}>
            {k === "Pending" ? `Waiting (${list.filter((r) => r.status === "Pending").length})` : `All (${list.length})`}
          </button>
        ))}
      </div>
      <ul className="space-y-3">
        {shown.map((r) => (
          <Row key={r.requestId} r={r} onDone={(n) => setList((l) => l.map((x) => (x.requestId === n.requestId ? n : x)))} />
        ))}
        {!shown.length && <li className="rounded-[1.5rem] bg-lilac/70 px-5 py-10 text-center text-sm text-ink">No extension requests waiting.</li>}
      </ul>
    </div>
  );
}

function Row({ r, onDone }: { r: ExtensionRequestDTO; onDone: (r: ExtensionRequestDTO) => void }) {
  const [newDue, setNewDue] = useState(r.proposedDue.slice(0, 16));
  const [reason, setReason] = useState("");
  const [busy, start] = useTransition();
  const decide = (approve: boolean) =>
    start(async () => {
      const res = await decideExtensionAction(r.requestId, { approve, newDue: approve ? new Date(newDue).toISOString() : undefined, reason });
      if (!res.ok) return void toast.error(res.error);
      onDone(res.request);
      toast.success(approve ? "Approved — the new deadline applies to this student only" : "Declined — the student sees your reason");
    });
  return (
    <li className="space-y-3 rounded-[1.5rem] border border-ink/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-ink">
            {r.studentName} ({r.studentId}) · {r.moduleTitle}
          </p>
          <p className="text-sm text-ink">
            {r.courseCode} / {r.unitCode} · asked <LocalTime iso={r.createdAt} /> for <LocalTime iso={r.proposedDue} />
          </p>
          <p className="mt-2 whitespace-pre-wrap rounded-xl bg-lilac/50 px-4 py-2 text-sm text-ink">“{r.reason}”</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone[r.status]}`}>{r.status}</span>
      </div>
      {r.status === "Pending" ? (
        <div className="flex flex-wrap items-center gap-2">
          <input type="datetime-local" value={newDue} onChange={(e) => setNewDue(e.target.value)} aria-label="New deadline" className={field} />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Note / reason for declining" aria-label="Reason" className={`${field} min-w-56 flex-1`} />
          <button onClick={() => decide(true)} disabled={busy || !newDue} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Approve
          </button>
          <button onClick={() => decide(false)} disabled={busy || !reason.trim()} className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-800 disabled:opacity-50">
            Decline
          </button>
        </div>
      ) : (
        <p className="text-sm text-ink">
          {r.status} by {r.decidedBy}
          {r.newDue && (
            <>
              {" "}· new deadline <LocalTime iso={r.newDue} />
            </>
          )}
          {r.decisionReason && ` · “${r.decisionReason}”`}
        </p>
      )}
    </li>
  );
}
