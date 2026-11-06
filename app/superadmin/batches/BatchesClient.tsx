"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ArrowRightIcon, PlusIcon } from "../../dashboard/_components/icons";
import { createBatchAction } from "./actions";
import { BATCH_CODE_MAX, BATCH_NAME_MAX, DEFAULT_TZ, formatClassTime, TIMEZONES, type BatchDTO } from "@/lib/batch-meta";

const field = "rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/10 placeholder:text-ink/60 focus:ring-plum/30";

// Batches: pick a course, name the batch and give it a trainer; then open it to add students and the class times
export default function BatchesClient({
  initial,
  courses,
  trainers,
  base,
}: {
  initial: BatchDTO[];
  courses: { code: string; name: string }[];
  trainers: { trainerId: string; name: string }[];
  base: string; // /superadmin/batches or /admin/batches
}) {
  const [batches, setBatches] = useState(initial);
  const [course, setCourse] = useState("All");
  const [adding, setAdding] = useState(false);
  const emptyForm = { name: "", code: "", courseCode: courses[0]?.code ?? "", trainerId: "", startDate: "", endDate: "", timezone: DEFAULT_TZ };
  const [form, setForm] = useState(emptyForm);
  const [saving, startSaving] = useTransition();
  const trainerNames = (b: BatchDTO) => b.trainers.map((t) => trainers.find((x) => x.trainerId === t.trainerId)?.name ?? t.trainerId).join(", ");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    startSaving(async () => {
      const res = await createBatchAction(form);
      if (!res.ok) return void toast.error(res.error);
      setBatches((b) => [...b, res.batch].sort((a, c) => a.name.localeCompare(c.name)));
      setForm({ ...emptyForm, courseCode: form.courseCode });
      setAdding(false);
      toast.success(`${res.batch.name} created — open it to add students and class times`);
    });
  };

  const shown = batches.filter((b) => course === "All" || b.courseCode === course);

  return (
    <div className="animate-fade-up space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-ink sm:text-[1.65rem]">Batches</h1>
          <p className="mt-1 text-sm text-ink">
            Each batch belongs to one course, with its students, assigned units and trainers (each trainer covers specific units). Open a batch to plan and open units.
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          disabled={!courses.length}
          className="inline-flex items-center gap-2 rounded-full bg-plum px-5 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:opacity-50"
        >
          <PlusIcon className="h-4 w-4" />
          Add batch
        </button>
      </div>

      {adding && (
        <form onSubmit={add} className="grid gap-3 rounded-[1.75rem] bg-lilac/80 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          <select required value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} aria-label="Course" className={field}>
            {courses.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} – {c.name}
              </option>
            ))}
          </select>
          <input
            required
            value={form.name}
            maxLength={BATCH_NAME_MAX}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Batch name, e.g. CHC33021 – Nov 2026 Evening"
            aria-label="Batch name"
            className={field}
          />
          <input
            value={form.code}
            maxLength={BATCH_CODE_MAX}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="Batch code, e.g. IS-2027-01"
            aria-label="Batch code"
            className={`${field} font-mono placeholder:font-sans`}
          />
          <label className="flex items-center gap-2 text-sm text-ink">
            Start
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} aria-label="Planned start date" className={`${field} flex-1`} />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            End
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} aria-label="Planned end date" className={`${field} flex-1`} />
          </label>
          <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} aria-label="Timezone" className={field}>
            {TIMEZONES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select value={form.trainerId} onChange={(e) => setForm({ ...form, trainerId: e.target.value })} aria-label="Trainer" className={field}>
            <option value="">First trainer, for every unit (optional)</option>
            {trainers.map((t) => (
              <option key={t.trainerId} value={t.trainerId}>
                {t.name} ({t.trainerId})
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-plum px-6 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Saving…" : "Create batch"}
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by course">
        {["All", ...courses.map((c) => c.code)].map((c) => (
          <button
            key={c}
            onClick={() => setCourse(c)}
            className={`rounded-full px-4 py-2 text-xs font-medium transition ${course === c ? "bg-plum text-white" : "bg-lilac text-ink hover:bg-plum/10"}`}
          >
            {c === "All" ? "All courses" : c} ({c === "All" ? batches.length : batches.filter((b) => b.courseCode === c).length})
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-ink/10 bg-white shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-ink text-[11px] uppercase tracking-wide text-white">
              <tr>
                <th className="px-5 py-3 font-medium">Batch</th>
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium">Course</th>
                <th className="px-5 py-3 font-medium">Trainers</th>
                <th className="px-5 py-3 font-medium">Students</th>
                <th className="px-5 py-3 font-medium">Classes</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {shown.map((b) => (
                <tr key={b.batchId} className="transition hover:bg-lilac/30">
                  <td className="px-5 py-3.5 font-medium text-ink">{b.name}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-ink">{b.code || "—"}</td>
                  <td className="px-5 py-3.5 text-xs font-semibold text-plum">{b.courseCode ?? <span className="text-amber-800">No course</span>}</td>
                  <td className="px-5 py-3.5 text-ink">{trainerNames(b) || <span className="text-amber-800">Not assigned</span>}</td>
                  <td className="px-5 py-3.5 text-ink">{b.students}</td>
                  <td className="px-5 py-3.5 text-xs text-ink">
                    {b.classes.length ? b.classes.map((c) => <span key={c.id} className="block">{`${c.day} ${formatClassTime(c.time)}`}</span>) : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`${base}/${b.batchId}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-plum px-4 py-2 text-xs font-medium text-white transition hover:bg-plum-light"
                    >
                      Open
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length === 0 && <p className="px-5 py-12 text-center text-sm text-ink">No batches yet — click Add batch to make the first one.</p>}
      </div>
    </div>
  );
}
