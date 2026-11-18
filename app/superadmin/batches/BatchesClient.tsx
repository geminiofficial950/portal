"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ArrowRightIcon, PlusIcon } from "../../dashboard/_components/icons";
import { useTableColumns } from "../_components/useTableColumns";
import { createBatchAction } from "./actions";
import { BATCH_CODE_MAX, BATCH_NAME_MAX, DEFAULT_TZ, formatClassTime, TIMEZONES, type BatchDTO } from "@/lib/batch-meta";

const field = "rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/10 placeholder:text-ink/60 focus:ring-plum/30";

// Batches: pick a course, name the batch and tick its trainers; then open it to add students and the class times
export default function BatchesClient({
  initial,
  courses,
  trainers,
  base,
  showDates = false,
}: {
  showDates?: boolean; // Super Admin only: a batch's planned start / end dates (hidden from Admin accounts and trainers)
  initial: BatchDTO[];
  courses: { code: string; name: string }[];
  trainers: { trainerId: string; name: string }[];
  base: string; // /superadmin/batches or /admin/batches
}) {
  const [batches, setBatches] = useState(initial);
  const [course, setCourse] = useState("All");
  const [adding, setAdding] = useState(false);
  const emptyForm = { name: "", code: "", courseCode: courses[0]?.code ?? "", trainerIds: [] as string[], startDate: "", endDate: "", timezone: DEFAULT_TZ };
  const [form, setForm] = useState(emptyForm);
  const [saving, startSaving] = useTransition();
  const trainerNames = (b: BatchDTO) => b.trainers.map((t) => trainers.find((x) => x.trainerId === t.trainerId)?.name ?? t.trainerId).join(", ");
  // resizable, movable columns (remembered in this browser), like the Students table
  const table = useTableColumns("stella.batches.columns", [
    { key: "name", label: "Batch", width: 280, min: 140 },
    { key: "code", label: "Code", width: 180, min: 100 },
    { key: "course", label: "Course", width: 130, min: 100 },
    { key: "trainers", label: "Trainers", width: 260, min: 120 },
    { key: "students", label: "Students", width: 110, min: 90 },
    { key: "classes", label: "Classes", width: 170, min: 110 },
    { key: "open", label: "", width: 130, min: 110 },
  ]);

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
          {showDates && (
            <>
              <label className="flex items-center gap-2 text-sm text-ink">
                Start
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} aria-label="Planned start date" className={`${field} flex-1`} />
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                End
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} aria-label="Planned end date" className={`${field} flex-1`} />
              </label>
            </>
          )}
          <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} aria-label="Timezone" className={field}>
            {TIMEZONES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          {/* one or more trainers; each starts with every unit (change units per trainer inside the batch) */}
          <fieldset className="rounded-xl bg-white p-3 ring-1 ring-ink/10 sm:col-span-2 lg:col-span-4">
            <legend className="sr-only">Trainers</legend>
            <p className="px-1 pb-2 text-sm font-semibold text-ink">Trainers (optional — tick one or more)</p>
            {trainers.length ? (
              <div className="flex flex-wrap gap-2">
                {trainers.map((t) => {
                  const on = form.trainerIds.includes(t.trainerId);
                  return (
                    <label
                      key={t.trainerId}
                      className={`flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-2 text-sm text-ink transition ${on ? "bg-plum/10 ring-2 ring-plum" : "bg-lilac/50 ring-1 ring-ink/15 hover:bg-lilac"}`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => setForm({ ...form, trainerIds: e.target.checked ? [...form.trainerIds, t.trainerId] : form.trainerIds.filter((x) => x !== t.trainerId) })}
                        aria-label={`Trainer ${t.name}`}
                        className="h-4 w-4 accent-plum"
                      />
                      {t.name} ({t.trainerId})
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="px-1 text-sm text-ink">No active trainers yet.</p>
            )}
            <p className="px-1 pt-2 text-xs text-ink">Each ticked trainer covers every unit to start with. You can change which units each trainer teaches inside the batch.</p>
          </fieldset>
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
          <table className="table-fixed border-collapse text-left text-sm" style={{ width: table.totalWidth, minWidth: "100%" }}>
            <colgroup>
              {table.cols.map((col) => (
                <col key={col.key} style={{ width: col.width }} />
              ))}
            </colgroup>
            <thead className="bg-ink text-[11px] uppercase tracking-wide text-white">
              <tr>
                {table.cols.map((col) => (
                  <th
                    key={col.key}
                    {...table.dragProps(col.key)}
                    title="Drag to move this column · drag the right edge to resize"
                    className={`group relative cursor-grab select-none border-r border-white/15 px-5 py-3 font-medium last:border-r-0 active:cursor-grabbing ${table.dragKey === col.key ? "bg-white/15" : ""} ${table.overKey === col.key && table.dragKey !== col.key ? "bg-plum shadow-[inset_3px_0_0_white]" : ""}`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span aria-hidden className="opacity-0 transition group-hover:opacity-100">⋮⋮</span>
                      {col.label}
                    </span>
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${col.label || "Open"} column`}
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      onPointerDown={(e) => table.startResize(col.key, e)}
                      className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize after:absolute after:inset-y-2 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded after:bg-transparent hover:after:bg-white"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {shown.map((b) => {
                const cell = {
                  name: <span className="block truncate font-medium text-ink">{b.name}</span>,
                  code: <span className="block truncate font-mono text-xs text-ink">{b.code || "—"}</span>,
                  course: <span className="text-xs font-semibold text-plum">{b.courseCode ?? <span className="text-amber-800">No course</span>}</span>,
                  trainers: <span className="text-ink">{trainerNames(b) || <span className="text-amber-800">Not assigned</span>}</span>,
                  students: <span className="text-ink">{b.students}</span>,
                  classes: (
                    <span className="block text-xs text-ink">
                      {b.classes.length ? b.classes.map((c) => <span key={c.id} className="block">{`${c.day} ${formatClassTime(c.time)}`}</span>) : "—"}
                    </span>
                  ),
                  open: (
                    <Link
                      href={`${base}/${b.batchId}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-plum px-4 py-2 text-xs font-medium text-white transition hover:bg-plum-light"
                    >
                      Open
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Link>
                  ),
                };
                return (
                  <tr key={b.batchId} className="transition hover:bg-lilac/30">
                    {table.cols.map((col) => (
                      <td key={col.key} className={`overflow-hidden border-r border-ink/5 px-5 py-3.5 last:border-r-0 ${col.key === "open" ? "text-right" : ""}`}>
                        {cell[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {shown.length === 0 && <p className="px-5 py-12 text-center text-sm text-ink">No batches yet — click Add batch to make the first one.</p>}
      </div>
    </div>
  );
}
