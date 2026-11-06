"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { BackIcon, CalendarIcon, ClockIcon, TrashIcon, UsersIcon, VideoIcon } from "../../dashboard/_components/icons";
import {
  addBatchClassAction,
  deleteBatchAction,
  moveStudentAction,
  openUnitsAction,
  previewOpeningAction,
  removeBatchClassAction,
  setBatchCourseAction,
  setBatchPlanAction,
  updateBatchDetailsAction,
  type OpeningPreview,
} from "./actions";
import { BATCH_CODE_MAX, BATCH_NAME_MAX, CLASS_DAYS, CLASSES_MAX, formatClassTime, sortClasses, TIMEZONES, type BatchDTO, type ClassSession } from "@/lib/batch-meta";
import type { ClassSessionDTO } from "@/lib/session-meta";
import DeadlinesTab from "./DeadlinesTab";
import { transferWithChecks } from "./transfer-flow";
import SessionsSection from "./SessionsSection";
import { accountLabel, courseStatusStyle, type CourseStatus } from "@/lib/course-status";

type Row = { studentId: string; name: string; email: string; account: "Active" | "Pending" | "Suspended"; courseStatus: CourseStatus; enrolled: boolean; currentBatch: string | null };
type PlanRow = { n: number; code: string; title: string; assigned: boolean; trainers: string[]; open: number; scheduled: string | null; nonActive: number };

export type BatchDetailData = {
  batch: BatchDTO;
  courseName: string | null;
  plan: PlanRow[];
  trainers: { trainerId: string; name: string }[];
  members: Row[];
  candidates: Row[];
  otherBatches: { batchId: string; name: string }[];
  courses: { code: string; name: string }[];
  sessions: ClassSessionDTO[];
  modules: Record<string, { id: string; title: string; dueAt: string | null }[]>;
};

const card = "rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] sm:p-6";
const field = "rounded-xl bg-white px-3 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/15 placeholder:text-ink/60 focus:ring-plum/40";
const btn = "rounded-full px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const th = "px-4 py-2.5 font-medium";
const fmtDate = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—");
const fmtStamp = (iso: string) => new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

const TABS = [
  { key: "plan", label: "Training plan" },
  { key: "students", label: "Students" },
  { key: "classes", label: "Classes" },
  { key: "deadlines", label: "Deadlines" },
  { key: "details", label: "Details" },
] as const;

// One batch. Admin manages everything here; a trainer sees the same page read-only (LMS guide: only admin assigns,
// opens units, reassigns students or trainers).
// `viewerTrainerId`: the signed-in trainer (their Deadlines tab only offers the units assigned to them)
export default function BatchDetail({
  data,
  role,
  canDelete,
  backHref,
  initialTab,
  viewerTrainerId,
}: {
  data: BatchDetailData;
  role: "admin" | "trainer";
  canDelete: boolean;
  backHref: string;
  initialTab?: string;
  viewerTrainerId?: string;
}) {
  const router = useRouter();
  const admin = role === "admin";
  // ?tab=classes etc. opens that tab (links from elsewhere, and tests)
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>(TABS.find((t) => t.key === initialTab)?.key ?? "plan");
  const [batch, setBatch] = useState(data.batch);
  const [members, setMembers] = useState(data.members);
  const [candidates, setCandidates] = useState(data.candidates);
  const [busy, startBusy] = useTransition();
  const trainerName = (id: string) => data.trainers.find((t) => t.trainerId === id)?.name ?? id;

  return (
    <div className="animate-fade-up space-y-6">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-medium text-ink transition hover:text-plum">
        <BackIcon className="h-4 w-4" />
        All batches
      </Link>

      <header className="space-y-3">
        <p className="text-sm font-semibold text-plum">
          {batch.courseCode ? `${batch.courseCode}${data.courseName ? ` · ${data.courseName}` : ""}` : "No course yet"}
        </p>
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold text-ink sm:text-3xl">
          {batch.name}
          {batch.code && <span className="rounded-lg bg-plum px-2.5 py-1 text-sm font-semibold text-white">{batch.code}</span>}
        </h1>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 rounded-2xl border border-ink/10 bg-white px-5 py-3 text-sm text-ink">
          <div className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-plum" />
            <dt className="sr-only">Students</dt>
            <dd className="font-semibold">{members.length} students</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Units</dt>
            <dd className="font-semibold">{batch.units.length} assigned units</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Trainers</dt>
            <dd>
              Trainers: <span className="font-semibold">{batch.trainers.length ? batch.trainers.map((t) => trainerName(t.trainerId)).join(", ") : "none yet"}</span>
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-plum" />
            <dd>
              {fmtDate(batch.startDate)} – {fmtDate(batch.endDate)}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <ClockIcon className="h-4 w-4 text-plum" />
            <dd>{batch.timezone}</dd>
          </div>
        </dl>
      </header>

      {!batch.courseCode && admin && <CoursePicker batchId={batch.batchId} courses={data.courses} onDone={() => router.refresh()} />}

      <div role="tablist" aria-label="Batch sections" className="flex flex-wrap gap-1 border-b border-ink/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === t.key ? "border-plum text-plum" : "border-transparent text-ink hover:text-plum"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "plan" && <TrainingPlan data={data} batch={batch} members={members} admin={admin} onBatch={setBatch} onChanged={() => router.refresh()} />}

      {tab === "students" && (
        <StudentsTab
          batch={batch}
          members={members}
          candidates={candidates}
          otherBatches={data.otherBatches}
          admin={admin}
          busy={busy}
          run={(fn) => startBusy(fn)}
          onMoved={(s, to) => {
            setMembers((m) => m.filter((x) => x.studentId !== s.studentId));
            setCandidates((c) => [...c, { ...s, currentBatch: to }].sort((a, b) => a.name.localeCompare(b.name)));
          }}
          onAdded={(s) => {
            setCandidates((c) => c.filter((x) => x.studentId !== s.studentId));
            setMembers((m) => [...m, { ...s, currentBatch: null }].sort((a, b) => a.name.localeCompare(b.name)));
          }}
        />
      )}

      {tab === "classes" && (
        <div className="space-y-6">
          <section className="rounded-[1.5rem] border border-ink/10 bg-white p-5 sm:p-6">
            <SessionsSection
              batchId={batch.batchId}
              timezone={batch.timezone}
              units={data.plan.filter((u) => u.assigned).map((u) => ({ code: u.code, title: u.title }))}
              trainers={data.trainers}
              initial={data.sessions}
              admin={admin}
            />
          </section>
          <ClassesTab batch={batch} admin={admin} onChange={(classes) => setBatch((b) => ({ ...b, classes }))} />
        </div>
      )}

      {tab === "deadlines" && batch.courseCode && (
        <DeadlinesTab
          courseCode={batch.courseCode}
          units={data.plan
            .filter((u) => u.assigned && (admin || batch.trainers.some((t) => t.trainerId === viewerTrainerId && t.unitCodes.includes(u.code))))
            .map((u) => ({ code: u.code, title: u.title }))}
          modules={data.modules}
          members={members.map((m) => ({ studentId: m.studentId, name: m.name }))}
        />
      )}

      {tab === "details" && (
        <DetailsTab
          batch={batch}
          admin={admin}
          canDelete={canDelete}
          members={members.length}
          onSaved={setBatch}
          onDeleted={() => router.push(backHref)}
        />
      )}
    </div>
  );
}

function CoursePicker({ batchId, courses, onDone }: { batchId: string; courses: { code: string; name: string }[]; onDone: () => void }) {
  const [busy, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
      This batch was made before batches had a course. Choose its course:
      <select
        defaultValue=""
        disabled={busy}
        onChange={(e) =>
          e.target.value &&
          start(async () => {
            const res = await setBatchCourseAction(batchId, e.target.value);
            if (!res.ok) return void toast.error(res.error);
            onDone();
          })
        }
        aria-label="Course"
        className={field}
      >
        <option value="">Choose…</option>
        {courses.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} – {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------- Training plan ----------

function TrainingPlan({
  data,
  batch,
  members,
  admin,
  onBatch,
  onChanged,
}: {
  data: BatchDetailData;
  batch: BatchDTO;
  members: Row[];
  admin: boolean;
  onBatch: (b: BatchDTO) => void;
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [scope, setScope] = useState<"batch" | "some">("batch");
  const [picked, setPicked] = useState<string[]>([]);
  const [releaseAt, setReleaseAt] = useState("");
  const [reset, setReset] = useState(false);
  const [preview, setPreview] = useState<{ mode: "now" | "schedule" | "close"; rows: OpeningPreview } | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, start] = useTransition();
  const assigned = data.plan.filter((u) => u.assigned);
  const all = selected.length === assigned.length && assigned.length > 0;
  const studentScope = scope === "some" ? { studentIds: picked } : { studentIds: null };

  const ask = (mode: "now" | "schedule" | "close") => {
    if (!selected.length) return void toast.error("Tick the units first.");
    if (scope === "some" && !picked.length) return void toast.error("Tick the students first.");
    if (mode === "schedule" && !releaseAt) return void toast.error("Choose the release date and time.");
    start(async () => {
      const res = await previewOpeningAction(batch.batchId, selected, studentScope, reset);
      if (!res.ok) return void toast.error(res.error);
      setPreview({ mode, rows: res.preview });
    });
  };

  const confirm = () =>
    start(async () => {
      if (!preview) return;
      const when = preview.mode === "schedule" ? { mode: "schedule" as const, releaseAt: new Date(releaseAt).toISOString() } : { mode: preview.mode };
      const res = await openUnitsAction(batch.batchId, selected, studentScope, when, reset);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${res.changed} student-unit record(s) updated`);
      setPreview(null);
      setSelected([]);
      onChanged();
    });

  if (editing) return <PlanEditor data={data} batch={batch} onCancel={() => setEditing(false)} onSaved={(b) => (onBatch(b), setEditing(false), onChanged())} />;

  return (
    <section className="space-y-4">
      <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
        Units open only when admin opens them (now, or on a scheduled date). Opening a unit never changes results, and a unit with any
        non-active status stays hidden.
      </p>

      {admin && (
        <div className={`${card} space-y-3 p-4`}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-ink">{selected.length} unit(s) selected</span>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" checked={scope === "batch"} onChange={() => setScope("batch")} className="accent-plum" />
              Whole batch ({members.length})
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" checked={scope === "some"} onChange={() => setScope("some")} className="accent-plum" />
              Selected students
            </label>
            <span className="flex-1" />
            <button onClick={() => setEditing(true)} className={`${btn} border border-ink/15 text-ink hover:bg-lilac`}>
              Edit units &amp; trainers
            </button>
          </div>
          {scope === "some" && (
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <label key={m.studentId} className={`flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${picked.includes(m.studentId) ? "bg-plum text-white" : "bg-lilac text-ink"}`}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={picked.includes(m.studentId)}
                    onChange={(e) => setPicked((p) => (e.target.checked ? [...p, m.studentId] : p.filter((x) => x !== m.studentId)))}
                  />
                  {m.name}
                </label>
              ))}
              {!members.length && <span className="text-sm text-ink">No students in this batch yet.</span>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => ask("now")} disabled={busy} className={`${btn} bg-plum text-white hover:bg-plum-light`}>
              Open now
            </button>
            <input type="datetime-local" value={releaseAt} onChange={(e) => setReleaseAt(e.target.value)} aria-label="Release date and time" className={`${field} py-1.5`} />
            <button onClick={() => ask("schedule")} disabled={busy} className={`${btn} border border-plum text-plum hover:bg-lilac`}>
              Schedule release
            </button>
            <button onClick={() => ask("close")} disabled={busy} className={`${btn} border border-ink/15 text-ink hover:bg-lilac`}>
              Close again
            </button>
            <label className="ml-2 flex items-center gap-2 text-xs text-ink">
              <input type="checkbox" checked={reset} onChange={(e) => setReset(e.target.checked)} className="accent-plum" />
              Include students with a non-active status (reset exceptions)
            </label>
          </div>
        </div>
      )}

      {preview && (
        <div className={`${card} space-y-3 border-plum`}>
          <h3 className="text-base font-semibold text-ink">
            Check before saving — {preview.mode === "now" ? "open now" : preview.mode === "close" ? "close" : `release on ${fmtStamp(new Date(releaseAt).toISOString())}`}
          </h3>
          <ul className="space-y-2 text-sm text-ink">
            {preview.rows.map((r) => (
              <li key={r.unitCode} className="rounded-xl bg-lilac/50 px-4 py-2.5">
                <span className="font-semibold">{r.unitCode}</span>: {r.affected.length} student(s) change
                {r.affected.length > 0 && ` — ${r.affected.map((a) => a.name).join(", ")}`}
                {r.skipped.length > 0 && (
                  <span className="block text-amber-900">
                    Kept as they are (exceptions): {r.skipped.map((s) => `${s.name} (${s.reason})`).join("; ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button onClick={confirm} disabled={busy} className={`${btn} bg-plum text-white hover:bg-plum-light`}>
              {busy ? "Saving…" : "Confirm"}
            </button>
            <button onClick={() => setPreview(null)} className={`${btn} text-ink hover:bg-lilac`}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-ink text-xs uppercase tracking-wide text-white">
              <tr>
                {admin && (
                  <th className={th}>
                    <input type="checkbox" checked={all} onChange={(e) => setSelected(e.target.checked ? assigned.map((u) => u.code) : [])} aria-label="Select every unit" className="accent-peach" />
                  </th>
                )}
                <th className={th}>Unit</th>
                <th className={th}>Trainer(s)</th>
                <th className={th}>Access</th>
                <th className={th}>Students</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {data.plan.map((u) => (
                <tr key={u.code} className={u.assigned ? "" : "bg-slate-50"}>
                  {admin && (
                    <td className="px-4 py-3">
                      {u.assigned && (
                        <input
                          type="checkbox"
                          checked={selected.includes(u.code)}
                          onChange={(e) => setSelected((s) => (e.target.checked ? [...s, u.code] : s.filter((x) => x !== u.code)))}
                          aria-label={`Select ${u.code}`}
                          className="accent-plum"
                        />
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className="font-semibold text-ink">
                      {String(u.n).padStart(2, "0")} {u.code}
                    </span>{" "}
                    <span className="text-ink">{u.title}</span>
                    {!u.assigned && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-800">Not in this batch</span>}
                  </td>
                  <td className="px-4 py-3 text-ink">{u.assigned ? u.trainers.join(", ") || <span className="text-amber-800">No trainer</span> : "—"}</td>
                  <td className="px-4 py-3">
                    {!u.assigned ? (
                      "—"
                    ) : u.open === members.length && members.length > 0 ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Open</span>
                    ) : u.scheduled ? (
                      <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">Scheduled · {fmtStamp(u.scheduled)}</span>
                    ) : u.open > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">Open for some</span>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-800">Not opened</span>
                    )}
                    {u.nonActive > 0 && <span className="ml-2 text-xs text-ink">{u.nonActive} non-active</span>}
                  </td>
                  <td className="px-4 py-3 text-ink">{u.assigned ? `${u.open} / ${members.length} open` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.plan.length && <p className="px-5 py-8 text-center text-sm text-ink">This course has no units yet.</p>}
        <p className="border-t border-ink/10 px-5 py-3 text-xs text-ink">Access does not change assessment results. Open a missed unit for one student from their Progress page.</p>
      </div>
    </section>
  );
}

// Which units the batch takes, and which trainer covers each unit (several trainers per batch)
function PlanEditor({ data, batch, onCancel, onSaved }: { data: BatchDetailData; batch: BatchDTO; onCancel: () => void; onSaved: (b: BatchDTO) => void }) {
  const [units, setUnits] = useState<string[]>(batch.units);
  const [cover, setCover] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(data.plan.map((u) => [u.code, batch.trainers.filter((t) => t.unitCodes.includes(u.code)).map((t) => t.trainerId)])),
  );
  const [busy, start] = useTransition();

  const save = () =>
    start(async () => {
      const assignments = data.trainers.map((t) => ({ trainerId: t.trainerId, unitCodes: units.filter((u) => cover[u]?.includes(t.trainerId)) }));
      const res = await setBatchPlanAction(batch.batchId, units, assignments);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Units and trainers saved");
      onSaved(res.batch);
    });

  return (
    <section className={`${card} space-y-4`}>
      <div>
        <h3 className="text-base font-semibold text-ink">Units &amp; trainers</h3>
        <p className="text-sm text-ink">Tick the units this batch takes, then the trainer(s) for each. A trainer sees only students of this batch, and only in the units ticked for them.</p>
      </div>
      <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10">
        {data.plan.map((u) => {
          const on = units.includes(u.code);
          return (
            <li key={u.code} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <label className="flex min-w-64 flex-1 cursor-pointer items-center gap-3 text-sm text-ink">
                <input type="checkbox" checked={on} onChange={(e) => setUnits((l) => (e.target.checked ? data.plan.map((p) => p.code).filter((c) => c === u.code || l.includes(c)) : l.filter((c) => c !== u.code)))} className="h-4 w-4 accent-plum" />
                <span>
                  <span className="font-semibold">{u.code}</span> {u.title}
                </span>
              </label>
              {on && (
                <span className="flex flex-wrap gap-1.5">
                  {data.trainers.map((t) => {
                    const sel = cover[u.code]?.includes(t.trainerId);
                    return (
                      <button
                        key={t.trainerId}
                        type="button"
                        aria-pressed={sel}
                        onClick={() => setCover((c) => ({ ...c, [u.code]: sel ? c[u.code].filter((x) => x !== t.trainerId) : [...(c[u.code] ?? []), t.trainerId] }))}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${sel ? "bg-plum text-white" : "bg-lilac text-ink hover:bg-plum/10"}`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                  {!data.trainers.length && <span className="text-xs text-amber-800">No active trainers</span>}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className={`${btn} bg-plum text-white hover:bg-plum-light`}>
          {busy ? "Saving…" : "Save units & trainers"}
        </button>
        <button onClick={onCancel} className={`${btn} text-ink hover:bg-lilac`}>
          Cancel
        </button>
      </div>
    </section>
  );
}

// ---------- Students ----------

function StudentsTab({
  batch,
  members,
  candidates,
  otherBatches,
  admin,
  busy,
  run,
  onMoved,
  onAdded,
}: {
  batch: BatchDTO;
  members: Row[];
  candidates: Row[];
  otherBatches: { batchId: string; name: string }[];
  admin: boolean;
  busy: boolean;
  run: (fn: () => Promise<void>) => void;
  onMoved: (s: Row, to: string | null) => void;
  onAdded: (s: Row) => void;
}) {
  const [adding, setAdding] = useState("");
  // Transfer preview first: destination, trainer coverage per unit, and conflicts with the destination plan
  const move = (s: Row, to: string | null) =>
    run(async () => {
      const target = otherBatches.find((b) => b.batchId === to);
      const res = await transferWithChecks({ studentId: s.studentId, studentName: s.name, courseCode: batch.courseCode!, fromName: batch.name, to: target ? { batchId: target.batchId, name: target.name } : null });
      if (!res.ok) return void (res.error && toast.error(res.error));
      onMoved(s, target?.name ?? null);
      toast.success(to ? `${s.name} transferred to ${target?.name}` : `${s.name} taken out of the batch`);
    });
  const add = () => {
    const s = candidates.find((x) => x.studentId === adding);
    if (!s || !batch.courseCode) return;
    if (s.currentBatch && !window.confirm(`${s.name} is in ${s.currentBatch}. Transfer them to ${batch.name}? Their work stays with them.`)) return;
    run(async () => {
      const res = await moveStudentAction(s.studentId, batch.courseCode!, batch.batchId);
      if (!res.ok) return void toast.error(res.error);
      onAdded(s);
      setAdding("");
      toast.success(`${s.name} added to ${batch.name}`);
    });
  };

  return (
    <section className={`${card} space-y-4`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Students ({members.length})</h2>
        {admin && batch.courseCode && candidates.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Student to add" className={field}>
              <option value="">Add a student of {batch.courseCode}…</option>
              {candidates.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {s.name} ({s.studentId}){s.currentBatch ? ` — in ${s.currentBatch}` : ""}
                </option>
              ))}
            </select>
            <button onClick={add} disabled={busy || !adding} className={`${btn} bg-plum text-white hover:bg-plum-light`}>
              Add
            </button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-ink/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-ink text-xs uppercase tracking-wide text-white">
            <tr>
              <th className={th}>Student</th>
              <th className={th}>Email</th>
              <th className={th}>Course status</th>
              <th className={th}>Account</th>
              {admin && <th className={th}>Transfer</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {members.map((s) => (
              <tr key={s.studentId}>
                <td className="px-4 py-2.5">
                  <span className="block font-medium text-ink">{s.name}</span>
                  <span className="block text-xs text-ink">{s.studentId}</span>
                </td>
                <td className="px-4 py-2.5 text-ink">{s.email}</td>
                <td className="px-4 py-2.5">
                  {s.enrolled ? (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${courseStatusStyle[s.courseStatus]}`}>{s.courseStatus}</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900" title="Add this course on the student’s profile, or take them out of this batch">
                      Not enrolled in this course
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-ink">{accountLabel(s.account)}</td>
                {admin && (
                  <td className="px-4 py-2.5">
                    <select value="" disabled={busy} onChange={(e) => e.target.value && move(s, e.target.value === "__out" ? null : e.target.value)} aria-label={`Transfer ${s.name}`} className={`${field} py-1.5 text-xs`}>
                      <option value="">Choose…</option>
                      {otherBatches.map((b) => (
                        <option key={b.batchId} value={b.batchId}>
                          {b.name}
                        </option>
                      ))}
                      <option value="__out">Take out of this batch</option>
                    </select>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink">No students in this batch yet.</p>}
      </div>
    </section>
  );
}

// ---------- Classes ----------

function ClassesTab({ batch, admin, onChange }: { batch: BatchDTO; admin: boolean; onChange: (c: ClassSession[]) => void }) {
  const [cls, setCls] = useState({ day: "Monday", time: "", link: "" });
  const [busy, start] = useTransition();
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await addBatchClassAction(batch.batchId, cls);
      if (!res.ok) return void toast.error(res.error);
      onChange(sortClasses([...batch.classes, res.session]));
      setCls({ day: cls.day, time: "", link: "" });
      toast.success("Class added — students of this batch can see it");
    });
  };
  const remove = (c: ClassSession) => {
    if (!window.confirm(`Remove the ${c.day} ${formatClassTime(c.time)} class?`)) return;
    start(async () => {
      const res = await removeBatchClassAction(batch.batchId, c.id);
      if (!res.ok) return void toast.error(res.error);
      onChange(batch.classes.filter((x) => x.id !== c.id));
    });
  };
  return (
    <section className={`${card} space-y-4`}>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
        <VideoIcon className="h-5 w-5 text-plum" />
        Weekly classes
      </h2>
      <p className="text-sm text-ink">Day, time ({batch.timezone}) and link of each class. Students of this batch see these read-only.</p>
      {batch.classes.length ? (
        <div className="overflow-x-auto rounded-xl border border-ink/10">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-ink text-xs uppercase tracking-wide text-white">
              <tr>
                <th className={th}>Day</th>
                <th className={th}>Time</th>
                <th className={th}>Class link</th>
                {admin && <th className={th} />}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {batch.classes.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5 font-medium text-ink">{c.day}</td>
                  <td className="px-4 py-2.5 text-ink">{formatClassTime(c.time)}</td>
                  <td className="max-w-xs truncate px-4 py-2.5">
                    <a href={c.link} target="_blank" rel="noopener noreferrer" className="text-plum underline">
                      {c.link.replace(/^https?:\/\//, "")}
                    </a>
                  </td>
                  {admin && (
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => remove(c)} disabled={busy} className={`${btn} text-ink hover:bg-rose-50 hover:text-rose-700`}>
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl bg-lilac px-4 py-3 text-sm text-ink">No classes yet.</p>
      )}
      {admin && batch.classes.length < CLASSES_MAX && (
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-[10rem_8rem_minmax(0,1fr)_auto]">
          <select value={cls.day} onChange={(e) => setCls({ ...cls, day: e.target.value })} aria-label="Day of class" className={field}>
            {CLASS_DAYS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <input type="time" required value={cls.time} onChange={(e) => setCls({ ...cls, time: e.target.value })} aria-label="Time of class" className={field} />
          <input required value={cls.link} onChange={(e) => setCls({ ...cls, link: e.target.value })} placeholder="Class link (https://…)" inputMode="url" aria-label="Class link" className={field} />
          <button type="submit" disabled={busy} className={`${btn} bg-plum py-2.5 text-white hover:bg-plum-light`}>
            Add class
          </button>
        </form>
      )}
    </section>
  );
}

// ---------- Details ----------

function DetailsTab({
  batch,
  admin,
  canDelete,
  members,
  onSaved,
  onDeleted,
}: {
  batch: BatchDTO;
  admin: boolean;
  canDelete: boolean;
  members: number;
  onSaved: (b: BatchDTO) => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState({ name: batch.name, code: batch.code, startDate: batch.startDate ?? "", endDate: batch.endDate ?? "", timezone: batch.timezone });
  const [busy, start] = useTransition();
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await updateBatchDetailsAction(batch.batchId, form);
      if (!res.ok) return void toast.error(res.error);
      onSaved(res.batch);
      toast.success("Batch details saved");
    });
  };
  const remove = () => {
    if (!window.confirm(`Delete the batch ${batch.name}?\n\nAffected: ${members} student(s) — they stay enrolled, just without this batch. Their work, results and records are kept.`)) return;
    start(async () => {
      const res = await deleteBatchAction(batch.batchId);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Batch deleted");
      onDeleted();
    });
  };
  return (
    <section className={`${card} space-y-4`}>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-semibold text-ink">
          Batch name
          <input required disabled={!admin} value={form.name} maxLength={BATCH_NAME_MAX} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${field} w-full font-normal`} />
        </label>
        <label className="space-y-1 text-sm font-semibold text-ink">
          Batch code
          <input disabled={!admin} value={form.code} maxLength={BATCH_CODE_MAX} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. IS-2027-01" className={`${field} w-full font-normal`} />
        </label>
        <label className="space-y-1 text-sm font-semibold text-ink">
          Planned start date
          <input type="date" disabled={!admin} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={`${field} w-full font-normal`} />
        </label>
        <label className="space-y-1 text-sm font-semibold text-ink">
          Planned end date
          <input type="date" disabled={!admin} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={`${field} w-full font-normal`} />
        </label>
        <label className="space-y-1 text-sm font-semibold text-ink">
          Timezone
          <select disabled={!admin} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className={`${field} w-full font-normal`}>
            {TIMEZONES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        {admin && (
          <div className="flex items-end gap-2">
            <button type="submit" disabled={busy} className={`${btn} bg-plum py-2.5 text-white hover:bg-plum-light`}>
              Save details
            </button>
            {canDelete && (
              <button type="button" onClick={remove} disabled={busy} className={`${btn} inline-flex items-center gap-1.5 border border-rose-200 py-2.5 text-rose-800 hover:bg-rose-50`}>
                <TrashIcon className="h-4 w-4" />
                Delete batch
              </button>
            )}
          </div>
        )}
      </form>
    </section>
  );
}
