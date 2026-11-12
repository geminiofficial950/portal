"use client";

import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon } from "../../../../dashboard/_components/icons";
import FileList from "../../../../dashboard/_components/FileList";
import UploadButton from "../../../../dashboard/_components/UploadButton";
import type { UnitAssessment } from "@/lib/assessment-meta";
import type { Unit } from "@/lib/courses";
import { toLocalInput } from "@/lib/format";
import {
  ACTIVITY_TYPES,
  MODULE_KINDS,
  MODULE_LIMITS,
  needsSubmission,
  newModule,
  type Activity,
  type ActivityType,
  type Module,
  type ModuleKind,
} from "@/lib/module-meta";
import { saveAssessmentAction } from "./actions";

const newId = () => crypto.randomUUID();

const field = "w-full rounded-xl bg-white px-4 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/15 placeholder:text-ink/60 focus:ring-plum/40";
const card = "rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)]";
const addBtn = "inline-flex items-center gap-2 rounded-full bg-lilac px-4 py-2 text-xs font-semibold text-plum transition hover:bg-plum/10";
const iconBtn = "shrink-0 rounded-full p-2 text-ink transition hover:bg-lilac disabled:opacity-30";

const blankActivity = (type: ActivityType): Activity => {
  const id = newId();
  if (type === "mcq") return { id, type, prompt: "", options: ["", "", ""], answer: null };
  if (type === "matching") return { id, type, prompt: "", pairs: [{ left: "", right: "" }, { left: "", right: "" }] };
  if (type === "image") return { id, type, prompt: "", image: null };
  return { id, type: "short", prompt: "" };
};

const fmtDue = (iso: string) => new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

// The unit's modules: admin adds as many as the unit needs, names and orders them, and fills each with learning
// documents, online activities and/or a downloadable task with student uploads. Nothing here is marked automatically.
export default function AssessmentEditor({
  course,
  unit,
  initialAssessment,
  onDirtyChange,
  canEditDue = true,
}: {
  course: { code: string; name: string };
  unit: Unit;
  initialAssessment: UnitAssessment;
  onDirtyChange?: (dirty: boolean) => void;
  canEditDue?: boolean; // Super Admin only
}) {
  const [modules, setModules] = useState(initialAssessment.modules);
  const [saved, setSaved] = useState(initialAssessment.modules);
  const [open, setOpen] = useState<string | null>(initialAssessment.modules.find((m) => !m.archived)?.id ?? null);
  const [adding, setAdding] = useState(false);
  // a changed default due date needs a reason (deadline log); students' own dates are kept unless reset is ticked
  const [dueReason, setDueReason] = useState("");
  const [resetExceptions, setResetExceptions] = useState(false);
  const dueChanged = modules.some((m) => (saved.find((x) => x.id === m.id)?.dueAt ?? null) !== (m.dueAt ?? null));
  const [saving, startSaving] = useTransition();
  const dirty = JSON.stringify(modules) !== JSON.stringify(saved);
  const live = modules.filter((m) => !m.archived);
  const archived = modules.filter((m) => m.archived);

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (id: string, patch: Partial<Module>) => setModules((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const add = (kind: ModuleKind) => {
    const m = newModule(kind, newId());
    m.title = `${MODULE_KINDS.find((k) => k.key === kind)!.label} ${live.length + 1}`;
    setModules((list) => [...list.filter((x) => !x.archived), m, ...list.filter((x) => x.archived)]);
    setOpen(m.id);
    setAdding(false);
  };

  // Moves a module up or down among the live ones (archived ones stay at the end)
  const move = (id: string, by: -1 | 1) =>
    setModules((list) => {
      const l = list.filter((m) => !m.archived);
      const i = l.findIndex((m) => m.id === id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= l.length) return list;
      [l[i], l[j]] = [l[j], l[i]];
      return [...l, ...list.filter((m) => m.archived)];
    });

  const remove = (m: Module) => {
    if (!window.confirm(`Remove “${m.title}”? If any student has work in it, it is archived instead (hidden from students, their work kept). Save to apply.`)) return;
    setModules((list) => list.filter((x) => x.id !== m.id));
  };

  const save = () =>
    startSaving(async () => {
      const res = await saveAssessmentAction(course.code, unit.code, { modules }, { reason: dueReason, resetExceptions });
      if (!res.ok) return void toast.error(res.error);
      setModules(res.assessment.modules);
      setSaved(res.assessment.modules);
      setDueReason("");
      setResetExceptions(false);
      if (res.reset) toast.success(`${res.reset} student date(s) reset to the new default`);
      const archivedNow = res.assessment.modules.filter((m) => m.archived).length - archived.length;
      toast.success(archivedNow > 0 ? `Saved — ${archivedNow} removed module(s) had student work, so they were archived` : "Modules saved");
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">Modules</h2>
          <p className="mt-0.5 text-sm text-ink">
            Add as many modules as this unit needs, in the order students should do them. Resources stay in their own tab. Nothing is
            marked automatically — trainers set every module status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button onClick={() => setModules(saved)} className="rounded-full px-5 py-3 text-sm font-medium text-ink transition hover:bg-lilac">
              Discard
            </button>
          )}
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-full bg-plum px-6 py-3 text-sm font-semibold text-white transition hover:bg-plum-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : dirty ? "Save modules" : "Saved"}
          </button>
        </div>
      </div>

      {dueChanged && (
        <div className={`${card} space-y-2 border-amber-300 bg-amber-50`}>
          <p className="text-sm font-semibold text-amber-900">You changed a module’s due date</p>
          <input
            value={dueReason}
            maxLength={1000}
            onChange={(e) => setDueReason(e.target.value)}
            placeholder="Reason for the change (required — goes in the deadline log)"
            aria-label="Reason for the due-date change"
            className={field}
          />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={resetExceptions} onChange={(e) => setResetExceptions(e.target.checked)} className="h-4 w-4 accent-plum" />
            Also reset students’ own dates for these modules (otherwise their extensions and exceptions are kept)
          </label>
        </div>
      )}

      {live.length > 0 && (
        <p className="text-sm text-ink">
          {canEditDue
            ? "Set each module’s due date on its row, then save. Students see it on the unit page and in their training plan."
            : "Due dates are shown on each module row. Only Super Admin can change them."}
        </p>
      )}
      {live.length === 0 && <p className={`${card} text-center text-sm text-ink`}>No modules yet. Add the first one below.</p>}

      <ol className="space-y-3">
        {live.map((m, i) => (
          <li key={m.id} className={`${card} p-0`}>
            <div className="flex flex-wrap items-center gap-3 px-5 py-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-plum text-sm font-bold text-white">{i + 1}</span>
              <button onClick={() => setOpen(open === m.id ? null : m.id)} className="min-w-0 flex-1 text-left" aria-expanded={open === m.id}>
                <span className="block text-base font-semibold text-ink">{m.title || "Untitled module"}</span>
                <span className="block text-sm text-ink">
                  {MODULE_KINDS.find((k) => k.key === m.kind)?.label} · {m.activities.length} activit{m.activities.length === 1 ? "y" : "ies"} ·{" "}
                  {m.files.length} file{m.files.length === 1 ? "" : "s"}
                  {needsSubmission(m) ? " · student submits" : " · nothing to submit"}
                </span>
              </button>
              {/* The due date is set right here on the module row (Super Admin); everyone else sees it */}
              {canEditDue && needsSubmission(m) ? (
                <label className="flex items-center gap-2 rounded-xl bg-lilac/60 px-3 py-1.5">
                  <span className="text-sm font-semibold text-ink">Due</span>
                  <input
                    type="datetime-local"
                    value={toLocalInput(m.dueAt)}
                    onChange={(e) => update(m.id, { dueAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    aria-label={`${m.title} due date (row)`}
                    className="rounded-lg bg-white px-2 py-1 text-sm text-ink outline-none ring-1 ring-ink/15 focus:ring-plum/40"
                  />
                </label>
              ) : (
                needsSubmission(m) && (
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${m.dueAt ? "bg-lilac text-ink" : "bg-amber-100 text-amber-900"}`}>
                    {m.dueAt ? `Due ${fmtDue(m.dueAt)}` : "No due date"}
                  </span>
                )
              )}
              <button onClick={() => move(m.id, -1)} disabled={i === 0} aria-label={`Move ${m.title} up`} className={iconBtn}>
                <ChevronUpIcon className="h-5 w-5" />
              </button>
              <button onClick={() => move(m.id, 1)} disabled={i === live.length - 1} aria-label={`Move ${m.title} down`} className={iconBtn}>
                <ChevronDownIcon className="h-5 w-5" />
              </button>
              <button onClick={() => remove(m)} aria-label={`Remove ${m.title}`} className={`${iconBtn} hover:bg-rose-50 hover:text-rose-700`}>
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
            {open === m.id && (
              <div className="border-t border-ink/10 px-5 py-5">
                <ModuleForm module={m} onChange={(patch) => update(m.id, patch)} canEditDue={canEditDue} />
              </div>
            )}
          </li>
        ))}
      </ol>

      {adding ? (
        <div className={`${card} space-y-3`}>
          <p className="text-sm font-semibold text-ink">What kind of module?</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {MODULE_KINDS.map((k) => (
              <button key={k.key} onClick={() => add(k.key)} className="rounded-2xl border border-ink/15 px-4 py-3 text-left transition hover:border-plum hover:bg-lilac">
                <span className="block text-sm font-semibold text-ink">{k.label}</span>
                <span className="block text-xs text-ink">{k.hint}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setAdding(false)} className="text-sm font-medium text-ink underline">
            Cancel
          </button>
        </div>
      ) : (
        live.length < MODULE_LIMITS.modules && (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-2 rounded-full bg-plum px-5 py-3 text-sm font-semibold text-white hover:bg-plum-light">
            <PlusIcon className="h-4 w-4" />
            Add module
          </button>
        )
      )}

      {archived.length > 0 && (
        <section className={`${card} space-y-2`}>
          <h3 className="text-sm font-semibold text-ink">Archived modules ({archived.length})</h3>
          <p className="text-sm text-ink">Removed from the unit, but students had work in them, so their work is kept. Students don’t see these.</p>
          <ul className="divide-y divide-ink/10">
            {archived.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 text-sm font-medium text-ink">{m.title}</span>
                <button onClick={() => update(m.id, { archived: false })} className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-lilac">
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ModuleForm({ module: m, onChange, canEditDue }: { module: Module; onChange: (p: Partial<Module>) => void; canEditDue: boolean }) {
  const setActivity = (id: string, a: Activity) => onChange({ activities: m.activities.map((x) => (x.id === id ? a : x)) });
  const moveActivity = (i: number, by: -1 | 1) => {
    const l = [...m.activities];
    const j = i + by;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    onChange({ activities: l });
  };
  const slots = m.upload.slots;
  const setSlots = (next: typeof slots) => onChange({ upload: { ...m.upload, slots: next } });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">Module name</span>
          <input value={m.title} maxLength={MODULE_LIMITS.title} onChange={(e) => onChange({ title: e.target.value })} className={field} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">Kind</span>
          <select value={m.kind} onChange={(e) => onChange({ kind: e.target.value as ModuleKind })} className={field}>
            {MODULE_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-ink">Instructions for students</span>
        <textarea
          rows={3}
          value={m.instructions}
          maxLength={MODULE_LIMITS.instructions}
          onChange={(e) => onChange({ instructions: e.target.value })}
          placeholder="What to read, do or upload in this module"
          className={`${field} resize-y`}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-lilac/60 px-4 py-3">
        <span className="text-sm font-semibold text-ink">Due date &amp; time</span>
        {canEditDue ? (
          <>
            <input
              type="datetime-local"
              value={toLocalInput(m.dueAt)}
              onChange={(e) => onChange({ dueAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
              aria-label={`${m.title} due date`}
              className="rounded-xl bg-white px-3 py-2 text-sm text-ink outline-none ring-1 ring-ink/15 focus:ring-plum/40"
            />
            {m.dueAt && (
              <button onClick={() => onChange({ dueAt: null })} className="text-xs font-semibold text-ink underline">
                No due date
              </button>
            )}
          </>
        ) : (
          <span className="text-sm text-ink">{m.dueAt ? fmtDue(m.dueAt) : "No due date"} · Only Super Admin can change dates.</span>
        )}
      </div>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-ink">Documents students read or download</h4>
        <FileList
          files={m.files}
          onChange={(files) => onChange({ files: files.slice(0, MODULE_LIMITS.files) })}
          emptyText="No documents."
          uploadLabel="Upload document"
          inputLabel={`Upload a document to ${m.title}`}
          renamable
        />
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-ink">Online activities ({m.activities.length})</h4>
        {m.activities.map((a, i) => (
          <ActivityForm
            key={a.id}
            index={i}
            activity={a}
            count={m.activities.length}
            onChange={(next) => setActivity(a.id, next)}
            onMove={(by) => moveActivity(i, by)}
            onRemove={() => onChange({ activities: m.activities.filter((x) => x.id !== a.id) })}
          />
        ))}
        {m.activities.length < MODULE_LIMITS.activities && (
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_TYPES.map((t) => (
              <button key={t.key} onClick={() => onChange({ activities: [...m.activities, blankActivity(t.key)] })} className={addBtn}>
                <PlusIcon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <label className="flex w-fit cursor-pointer items-center gap-3 text-sm font-semibold text-ink">
          <input type="checkbox" checked={m.upload.enabled} onChange={(e) => onChange({ upload: { ...m.upload, enabled: e.target.checked } })} className="h-5 w-5 accent-plum" />
          Students upload files for this module
        </label>
        {m.upload.enabled && (
          <div className="space-y-2 rounded-xl border border-ink/10 p-4">
            <p className="text-sm text-ink">Name each file you need (e.g. “Signed log timesheet”). Leave empty to let students upload any files.</p>
            {slots.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="w-6 text-right text-sm font-semibold text-ink">{i + 1}.</span>
                <input
                  value={s.label}
                  maxLength={MODULE_LIMITS.title}
                  onChange={(e) => setSlots(slots.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)))}
                  placeholder="e.g. Completed answers"
                  aria-label={`Upload ${i + 1} name`}
                  className={field}
                />
                <button onClick={() => setSlots(slots.filter((x) => x.id !== s.id))} aria-label={`Remove upload ${i + 1}`} className={`${iconBtn} hover:bg-rose-50 hover:text-rose-700`}>
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
            {slots.length < MODULE_LIMITS.slots && (
              <button onClick={() => setSlots([...slots, { id: newId(), label: "" }])} className={addBtn}>
                <PlusIcon className="h-3.5 w-3.5" />
                Add named upload
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ActivityForm({
  index,
  activity: a,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  activity: Activity;
  count: number;
  onChange: (a: Activity) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const label = ACTIVITY_TYPES.find((t) => t.key === a.type)?.label;
  return (
    <div className="space-y-3 rounded-2xl border border-ink/10 bg-lilac/30 p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-plum ring-1 ring-ink/10">
          {index + 1}. {label}
        </span>
        <span className="flex-1" />
        <button onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move activity ${index + 1} up`} className={iconBtn}>
          <ChevronUpIcon className="h-4 w-4" />
        </button>
        <button onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Move activity ${index + 1} down`} className={iconBtn}>
          <ChevronDownIcon className="h-4 w-4" />
        </button>
        <button onClick={onRemove} aria-label={`Remove activity ${index + 1}`} className={`${iconBtn} hover:bg-rose-50 hover:text-rose-700`}>
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
      <textarea
        rows={2}
        value={a.prompt}
        maxLength={MODULE_LIMITS.prompt}
        onChange={(e) => onChange({ ...a, prompt: e.target.value })}
        placeholder={a.type === "matching" ? "e.g. Match each term to its meaning" : "Question"}
        aria-label={`Activity ${index + 1} question`}
        className={`${field} resize-y`}
      />

      {a.type === "mcq" && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink">Options — optionally tick the expected answer (a reference for the trainer; never used to mark)</p>
          {a.options.map((o, k) => (
            <div key={k} className="flex items-center gap-2">
              <input
                type="radio"
                checked={a.answer === k}
                onChange={() => onChange({ ...a, answer: k })}
                aria-label={`Option ${k + 1} is the expected answer`}
                className="h-4 w-4 accent-emerald-600"
              />
              <input
                value={o}
                maxLength={MODULE_LIMITS.option}
                onChange={(e) => onChange({ ...a, options: a.options.map((x, j) => (j === k ? e.target.value : x)) })}
                placeholder={`Option ${k + 1}`}
                aria-label={`Activity ${index + 1} option ${k + 1}`}
                className={field}
              />
              <button
                disabled={a.options.length <= 2}
                onClick={() =>
                  onChange({ ...a, options: a.options.filter((_, j) => j !== k), answer: a.answer === k ? null : a.answer !== null && a.answer > k ? a.answer - 1 : a.answer })
                }
                aria-label={`Remove option ${k + 1}`}
                className={iconBtn}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
          {a.options.length < MODULE_LIMITS.options && (
            <button onClick={() => onChange({ ...a, options: [...a.options, ""] })} className={addBtn}>
              <PlusIcon className="h-3.5 w-3.5" />
              Add option
            </button>
          )}
        </div>
      )}

      {a.type === "matching" && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink">Pairs — students see the right column shuffled and match each left item</p>
          {a.pairs.map((p, k) => (
            <div key={k} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <input
                value={p.left}
                maxLength={MODULE_LIMITS.option}
                onChange={(e) => onChange({ ...a, pairs: a.pairs.map((x, j) => (j === k ? { ...x, left: e.target.value } : x)) })}
                placeholder={`Left ${k + 1}`}
                aria-label={`Pair ${k + 1} left`}
                className={field}
              />
              <input
                value={p.right}
                maxLength={MODULE_LIMITS.option}
                onChange={(e) => onChange({ ...a, pairs: a.pairs.map((x, j) => (j === k ? { ...x, right: e.target.value } : x)) })}
                placeholder={`Matches ${k + 1}`}
                aria-label={`Pair ${k + 1} right`}
                className={field}
              />
              <button disabled={a.pairs.length <= 2} onClick={() => onChange({ ...a, pairs: a.pairs.filter((_, j) => j !== k) })} aria-label={`Remove pair ${k + 1}`} className={iconBtn}>
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
          {a.pairs.length < MODULE_LIMITS.pairs && (
            <button onClick={() => onChange({ ...a, pairs: [...a.pairs, { left: "", right: "" }] })} className={addBtn}>
              <PlusIcon className="h-3.5 w-3.5" />
              Add pair
            </button>
          )}
        </div>
      )}

      {a.type === "image" && (
        <div className="flex flex-wrap items-center gap-3">
          {a.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route
            <img src={`/api/files/${a.image.id}?inline=1`} alt="Activity" className="h-24 w-36 rounded-lg bg-white object-contain ring-1 ring-ink/10" />
          ) : (
            <span className="text-sm text-amber-800">No image yet</span>
          )}
          <UploadButton
            label={a.image ? "Replace image" : "Upload image (JPG or PNG)"}
            ariaLabel={`Image for activity ${index + 1}`}
            onUploaded={async (file) => {
              if (!/\.(png|jpe?g)$/i.test(file.name)) return void toast.error("Use a JPG or PNG image.");
              onChange({ ...a, image: file });
            }}
          />
          <span className="text-xs text-ink">Students answer in writing.</span>
        </div>
      )}

      {a.type === "short" && <p className="text-xs text-ink">Students type a short answer; the trainer reads it.</p>}
    </div>
  );
}
