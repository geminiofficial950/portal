"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { addSessionAction, cancelSessionAction, updateSessionAction } from "./actions";
import { TIMEZONES } from "@/lib/batch-meta";
import { zonedParts } from "@/lib/meetings-meta";
import { sessionState, sessionWhen, type ClassSessionDTO, type SessionInput } from "@/lib/session-meta";

const field = "w-full rounded-xl bg-white px-3 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/15 placeholder:text-ink/60 focus:ring-plum/40";
const btn = "rounded-full px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const stateStyle = { upcoming: "bg-sky-100 text-sky-800", live: "bg-emerald-100 text-emerald-800", ended: "bg-slate-200 text-slate-800", cancelled: "bg-rose-100 text-rose-800" } as const;
const stateLabel = { upcoming: "Upcoming", live: "Live now", ended: "Ended", cancelled: "Cancelled" } as const;

// Class sessions of a batch: title, unit, trainer, date, start/end time in a named timezone, Google Meet link and
// preparation instructions. Admin adds, edits and cancels them (students are notified); trainers see them read-only.
export default function SessionsSection({
  batchId,
  timezone,
  units,
  trainers,
  initial,
  admin,
}: {
  batchId: string;
  timezone: string;
  units: { code: string; title: string }[];
  trainers: { trainerId: string; name: string }[];
  initial: ClassSessionDTO[];
  admin: boolean;
}) {
  const blank: SessionInput = { title: "", unitCode: "", trainerId: "", date: "", start: "", end: "", timezone, link: "", instructions: "" };
  const [list, setList] = useState(initial);
  const [form, setForm] = useState<SessionInput>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = editing ? await updateSessionAction(batchId, editing, form) : await addSessionAction(batchId, form);
      if (!res.ok) return void toast.error(res.error);
      setList((l) => [...l.filter((x) => x.sessionId !== res.session.sessionId), res.session].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      setForm(blank);
      setEditing(null);
      toast.success(editing ? "Class updated — students were notified" : "Class added — students were notified");
    });
  };

  const edit = (s: ClassSessionDTO) => {
    const a = zonedParts(s.startsAt, s.timezone);
    const b = zonedParts(s.endsAt, s.timezone);
    setForm({ title: s.title, unitCode: s.unitCode ?? "", trainerId: s.trainerId ?? "", date: a.date, start: a.time, end: b.time, timezone: s.timezone, link: s.link ?? "", instructions: s.instructions });
    setEditing(s.sessionId);
  };

  const cancel = (s: ClassSessionDTO) => {
    if (!window.confirm(`Cancel “${s.title}” (${sessionWhen(s)})? Students are notified and Join is removed.`)) return;
    start(async () => {
      const res = await cancelSessionAction(batchId, s.sessionId);
      if (!res.ok) return void toast.error(res.error);
      setList((l) => l.map((x) => (x.sessionId === s.sessionId ? res.session : x)));
      toast.success("Class cancelled — students were notified");
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-ink">Class sessions</h3>
      {list.length ? (
        <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10">
          {list.map((s) => {
            const st = sessionState(s);
            return (
              <li key={s.sessionId} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{s.title}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${stateStyle[st]}`}>{stateLabel[st]}</span>
                  </span>
                  <span className="block text-sm text-ink">{sessionWhen(s)}</span>
                  <span className="block text-sm text-ink">
                    {s.unitCode ?? "All units"} · Trainer: {s.trainerName ?? "to be confirmed"} · {s.link ? s.link.replace("https://", "") : "Meeting link coming soon"}
                  </span>
                  {s.instructions && <span className="block whitespace-pre-wrap text-sm text-ink">{s.instructions}</span>}
                </span>
                {admin && !s.cancelled && st !== "ended" && (
                  <span className="flex gap-2">
                    <button onClick={() => edit(s)} disabled={busy} className={`${btn} border border-ink/15 text-ink hover:bg-lilac`}>
                      Edit
                    </button>
                    <button onClick={() => cancel(s)} disabled={busy} className={`${btn} border border-rose-200 text-rose-800 hover:bg-rose-50`}>
                      Cancel class
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl bg-lilac px-4 py-3 text-sm text-ink">No class sessions yet.</p>
      )}

      {admin && (
        <form onSubmit={save} className="grid gap-2 rounded-xl border border-ink/10 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <p className="text-sm font-semibold text-ink sm:col-span-2 lg:col-span-4">{editing ? "Edit class session" : "Add a class session"}</p>
          <input required value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Session title" aria-label="Session title" className={`${field} lg:col-span-2`} />
          <select value={form.unitCode} onChange={(e) => setForm({ ...form, unitCode: e.target.value })} aria-label="Unit" className={field}>
            <option value="">All units</option>
            {units.map((u) => (
              <option key={u.code} value={u.code}>
                {u.code} – {u.title}
              </option>
            ))}
          </select>
          <select value={form.trainerId} onChange={(e) => setForm({ ...form, trainerId: e.target.value })} aria-label="Trainer" className={field}>
            <option value="">Trainer (to be confirmed)</option>
            {trainers.map((t) => (
              <option key={t.trainerId} value={t.trainerId}>
                {t.name}
              </option>
            ))}
          </select>
          <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label="Date" className={field} />
          <label className="flex items-center gap-2 text-sm text-ink">
            Start
            <input required type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} aria-label="Start time" className={field} />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            End
            <input required type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} aria-label="End time" className={field} />
          </label>
          <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} aria-label="Time zone" className={field}>
            {TIMEZONES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Google Meet link (optional — “coming soon” if empty)" aria-label="Google Meet link" className={`${field} lg:col-span-2`} />
          <textarea value={form.instructions} maxLength={1000} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Preparation instructions for students" aria-label="Student instructions" rows={2} className={`${field} resize-y lg:col-span-2`} />
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <button type="submit" disabled={busy} className={`${btn} bg-plum py-2.5 text-white hover:bg-plum-light`}>
              {busy ? "Saving…" : editing ? "Save changes" : "Add session"}
            </button>
            {editing && (
              <button type="button" onClick={() => (setEditing(null), setForm(blank))} className={`${btn} text-ink hover:bg-lilac`}>
                Cancel editing
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
