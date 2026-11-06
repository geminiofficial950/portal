"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { changeDeadlineAction, previewDeadlineAction } from "../../actions/deadlines";

type ModuleRow = { id: string; title: string; dueAt: string | null };
type Preview = { module: string; rows: { studentId: string; name: string; currentDue: string | null; newDue: string; changes: boolean }[] };

const field = "w-full rounded-xl bg-white px-3 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/15 placeholder:text-ink/60 focus:ring-plum/40";
const btn = "rounded-full px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const fmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "No date";

// Module deadlines for one student, a selected group or the whole batch (LMS guide: show old and new dates, the module,
// student names and count, and a reason before saving). Only those students get their own date; students who join
// later keep the module's default. Admin: any unit of the batch; a trainer: only their assigned units.
export default function DeadlinesTab({
  courseCode,
  units,
  modules,
  members,
}: {
  courseCode: string;
  units: { code: string; title: string }[];
  modules: Record<string, ModuleRow[]>;
  members: { studentId: string; name: string }[];
}) {
  const [unitCode, setUnitCode] = useState(units[0]?.code ?? "");
  const [moduleId, setModuleId] = useState("");
  const [scope, setScope] = useState<"batch" | "some">("batch");
  const [picked, setPicked] = useState<string[]>([]);
  const [dueAt, setDueAt] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, start] = useTransition();
  const mods = modules[unitCode] ?? [];
  const mod = mods.find((m) => m.id === moduleId) ?? mods[0];
  const studentIds = scope === "batch" ? members.map((m) => m.studentId) : picked;

  const check = () => {
    if (!mod) return void toast.error("This unit has no marked modules.");
    if (!studentIds.length) return void toast.error("Choose the students first.");
    if (!dueAt) return void toast.error("Choose the new due date and time.");
    if (!reason.trim()) return void toast.error("Write the reason for the change (it goes in the log).");
    start(async () => {
      const res = await previewDeadlineAction({ courseCode, unitCode, moduleId: mod.id, studentIds, dueAt: new Date(dueAt).toISOString() });
      if (!res.ok) return void toast.error(res.error);
      setPreview({ module: res.module, rows: res.rows });
    });
  };

  const save = () =>
    start(async () => {
      if (!mod) return;
      const res = await changeDeadlineAction({ courseCode, unitCode, moduleId: mod.id, studentIds, dueAt: new Date(dueAt).toISOString(), reason });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Due date changed for ${res.changed} student(s) — they were notified`);
      setPreview(null);
      setReason("");
    });

  if (!units.length) return <p className="rounded-xl bg-lilac px-4 py-3 text-sm text-ink">No units you can change deadlines for in this batch.</p>;

  return (
    <section className="space-y-4 rounded-[1.5rem] border border-ink/10 bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Module deadlines</h2>
        <p className="text-sm text-ink">Change a module’s due date for the whole batch, selected students or one student. Results never change; a unit that isn’t Active and open stays closed.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-semibold text-ink">
          Unit
          <select value={unitCode} onChange={(e) => (setUnitCode(e.target.value), setModuleId(""), setPreview(null))} className={`${field} font-normal`}>
            {units.map((u) => (
              <option key={u.code} value={u.code}>
                {u.code} – {u.title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold text-ink">
          Module
          <select value={mod?.id ?? ""} onChange={(e) => (setModuleId(e.target.value), setPreview(null))} className={`${field} font-normal`} disabled={!mods.length}>
            {mods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} (default: {fmt(m.dueAt)})
              </option>
            ))}
            {!mods.length && <option>No marked modules</option>}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm text-ink">
        <label className="flex items-center gap-2">
          <input type="radio" checked={scope === "batch"} onChange={() => (setScope("batch"), setPreview(null))} className="accent-plum" />
          Whole batch ({members.length})
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={scope === "some"} onChange={() => (setScope("some"), setPreview(null))} className="accent-plum" />
          Selected students (or one)
        </label>
      </div>
      {scope === "some" && (
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <label key={m.studentId} className={`flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${picked.includes(m.studentId) ? "bg-plum text-white" : "bg-lilac text-ink"}`}>
              <input
                type="checkbox"
                className="sr-only"
                checked={picked.includes(m.studentId)}
                onChange={(e) => (setPicked((p) => (e.target.checked ? [...p, m.studentId] : p.filter((x) => x !== m.studentId))), setPreview(null))}
              />
              {m.name}
            </label>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-semibold text-ink">
          New due date and time
          <input type="datetime-local" value={dueAt} onChange={(e) => (setDueAt(e.target.value), setPreview(null))} className={`${field} font-normal`} />
        </label>
        <label className="space-y-1 text-sm font-semibold text-ink">
          Reason (goes in the log)
          <input value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Public holiday" className={`${field} font-normal`} />
        </label>
      </div>
      <button onClick={check} disabled={busy} className={`${btn} bg-plum py-2.5 text-white hover:bg-plum-light`}>
        {busy && !preview ? "Checking…" : "Preview change"}
      </button>

      {preview && (
        <div className="space-y-3 rounded-xl border border-plum/40 bg-lilac/40 p-4">
          <p className="text-sm font-semibold text-ink">
            {preview.module} · {preview.rows.length} student(s) · reason: “{reason}”
          </p>
          <div className="overflow-x-auto rounded-lg bg-white">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-ink text-xs uppercase tracking-wide text-white">
                <tr>
                  <th className="px-3 py-2 font-medium">Student</th>
                  <th className="px-3 py-2 font-medium">Old date</th>
                  <th className="px-3 py-2 font-medium">New date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {preview.rows.map((r) => (
                  <tr key={r.studentId}>
                    <td className="px-3 py-2 text-ink">{r.name}</td>
                    <td className="px-3 py-2 text-ink">{fmt(r.currentDue)}</td>
                    <td className="px-3 py-2 font-semibold text-ink">{r.changes ? fmt(r.newDue) : "No change"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className={`${btn} bg-plum text-white hover:bg-plum-light`}>
              {busy ? "Saving…" : "Confirm and save"}
            </button>
            <button onClick={() => setPreview(null)} className={`${btn} text-ink hover:bg-white`}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
