"use client";

import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { CheckIcon, PlusIcon, TrashIcon } from "../../../../dashboard/_components/icons";
import Toggle from "../../../_components/Toggle";
import {
  ASSESSMENT_PARTS,
  LIMITS,
  summarise,
  type AssessmentPart,
  type ListItem,
  type UnitAssessment,
} from "@/lib/assessment-meta";
import type { Unit } from "@/lib/courses";
import { saveAssessmentAction } from "./actions";

const newId = () => crypto.randomUUID();

const field =
  "w-full rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/10 placeholder:text-ink/35 focus:ring-plum/40";
const card = "rounded-[1.5rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)]";
const addBtn =
  "inline-flex items-center gap-2 rounded-full bg-lilac px-4 py-2.5 text-xs font-medium text-plum transition hover:bg-plum/10";
const removeBtn = "shrink-0 rounded-full p-2 text-ink/35 transition hover:bg-rose-50 hover:text-rose-600";

export default function AssessmentEditor({
  course,
  unit,
  initialAssessment,
  onDirtyChange,
}: {
  course: { code: string; name: string };
  unit: Unit;
  initialAssessment: UnitAssessment;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [a, setA] = useState(initialAssessment);
  const [saved, setSaved] = useState(initialAssessment);
  const [tab, setTab] = useState<AssessmentPart>("quiz");
  const [saving, startSaving] = useTransition();
  const dirty = JSON.stringify(a) !== JSON.stringify(saved);
  const summary = summarise(a);

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  // Warn before leaving with unsaved edits
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const save = () =>
    startSaving(async () => {
      const res = await saveAssessmentAction(course.code, unit.code, a);
      if (!res.ok) return void toast.error(res.error);
      setA(res.assessment);
      setSaved(res.assessment);
      toast.success("Assessment saved");
    });

  const tabBadge: Record<AssessmentPart, string> = {
    quiz: summary.quizCount ? `${summary.quizCount} Q` : "",
    theory: summary.theoryCount ? `${summary.theoryCount} Q` : "",
    rolePlay: summary.rolePlay ? "✓" : "",
    workplace: summary.workplace ? "✓" : "",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-medium text-ink">Assessment</h2>
          <p className="mt-0.5 text-sm text-ink/55">Set the due date and all four parts, then save.</p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <button onClick={() => setA(saved)} className="rounded-full px-5 py-3 text-sm font-medium text-ink/60 transition hover:bg-lilac">
              Discard
            </button>
          )}
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-full bg-plum px-6 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : dirty ? "Save assessment" : "Saved"}
          </button>
        </div>
      </div>

      <DueDate value={a.dueAt} onChange={(dueAt) => setA({ ...a, dueAt })} />

      <div role="tablist" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {ASSESSMENT_PARTS.map((p, i) => {
          const active = tab === p.key;
          const done = summary[p.key];
          return (
            <button
              key={p.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(p.key)}
              className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-left transition ${
                active ? "bg-plum text-white shadow-md shadow-plum/20" : "bg-lilac text-ink hover:bg-plum/10"
              }`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-medium ${
                  done ? "bg-emerald-400 text-white" : active ? "bg-white/20" : "bg-white text-plum"
                }`}
              >
                {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {p.label}
                  {tabBadge[p.key] && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-white/20" : "bg-white text-plum"}`}>
                      {tabBadge[p.key]}
                    </span>
                  )}
                </span>
                <span className={`mt-0.5 block text-[11px] ${active ? "text-white/70" : "text-ink/45"}`}>{p.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {tab === "quiz" && <QuizEditor value={a.quiz} onChange={(quiz) => setA({ ...a, quiz })} />}
      {tab === "theory" && <TheoryEditor value={a.theory} onChange={(theory) => setA({ ...a, theory })} />}
      {tab === "rolePlay" && <RolePlayEditor value={a.rolePlay} onChange={(rolePlay) => setA({ ...a, rolePlay })} />}
      {tab === "workplace" && <WorkplaceEditor value={a.workplace} onChange={(workplace) => setA({ ...a, workplace })} />}
    </div>
  );
}

// ---------- Due date ----------

// <input type="datetime-local"> works in the viewer's local time; we store an ISO instant
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function DueDate({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
      <div>
        <h2 className="text-base font-medium text-ink">Due date &amp; time</h2>
        <p className="mt-0.5 text-xs text-ink/50">
          Students can’t submit after this. Move it later any time to give more time.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="datetime-local"
          value={toLocalInput(value)}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
          aria-label="Due date and time"
          className="rounded-xl bg-lilac px-4 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/5 focus:ring-plum/40"
        />
        {value && (
          <button onClick={() => onChange(null)} className="rounded-full px-3 py-2 text-xs font-medium text-ink/55 hover:bg-lilac">
            No deadline
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Online quiz ----------

function QuizEditor({ value, onChange }: { value: UnitAssessment["quiz"]; onChange: (v: UnitAssessment["quiz"]) => void }) {
  const update = (i: number, patch: Partial<UnitAssessment["quiz"]["questions"][number]>) =>
    onChange({ ...value, questions: value.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

  return (
    <section className="space-y-4">
      <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <h2 className="text-base font-medium text-ink">Online quiz</h2>
          <p className="mt-0.5 text-xs text-ink/50">Students pick one answer per question. The portal marks it straight away.</p>
        </div>
        <label className="flex items-center gap-3 text-sm text-ink/70">
          Pass mark
          <span className="flex items-center rounded-xl bg-lilac px-3">
            <input
              type="number"
              min={1}
              max={100}
              value={value.passMark}
              onChange={(e) => onChange({ ...value, passMark: Number(e.target.value) })}
              aria-label="Pass mark percent"
              className="w-14 bg-transparent py-2 text-right text-sm font-medium text-ink outline-none"
            />
            <span className="pl-1 text-ink/50">%</span>
          </span>
        </label>
      </div>

      {value.questions.map((q, i) => (
        <div key={q.id} className={card}>
          <div className="flex items-start gap-3">
            <span className="mt-2 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-lilac text-[11px] font-medium text-plum">{i + 1}</span>
            <textarea
              rows={2}
              value={q.text}
              maxLength={LIMITS.text}
              onChange={(e) => update(i, { text: e.target.value })}
              placeholder="Question"
              aria-label={`Quiz question ${i + 1}`}
              className={`${field} resize-y`}
            />
            <button
              onClick={() => onChange({ ...value, questions: value.questions.filter((_, j) => j !== i) })}
              aria-label={`Remove quiz question ${i + 1}`}
              className={removeBtn}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-4 pl-10 text-[11px] font-medium text-ink/45">Options — select the correct one</p>
          <ul className="mt-2 space-y-2 pl-10">
            {q.options.map((opt, k) => (
              <li key={k} className="flex items-center gap-3">
                <input
                  type="radio"
                  name={`answer-${q.id}`}
                  checked={q.answer === k}
                  onChange={() => update(i, { answer: k })}
                  aria-label={`Option ${k + 1} is correct`}
                  className="h-4 w-4 shrink-0 cursor-pointer accent-emerald-600"
                />
                <input
                  value={opt}
                  maxLength={500}
                  onChange={(e) => update(i, { options: q.options.map((o, m) => (m === k ? e.target.value : o)) })}
                  placeholder={`Option ${k + 1}`}
                  aria-label={`Question ${i + 1} option ${k + 1}`}
                  className={`${field} py-2.5 ${q.answer === k ? "ring-2 ring-emerald-300" : ""}`}
                />
                <button
                  disabled={q.options.length <= 2}
                  onClick={() =>
                    update(i, {
                      options: q.options.filter((_, m) => m !== k),
                      answer: q.answer === k ? 0 : q.answer > k ? q.answer - 1 : q.answer,
                    })
                  }
                  aria-label={`Remove option ${k + 1}`}
                  className={`${removeBtn} disabled:invisible`}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          {q.options.length < LIMITS.options && (
            <button onClick={() => update(i, { options: [...q.options, ""] })} className={`${addBtn} ml-10 mt-3`}>
              <PlusIcon className="h-3.5 w-3.5" />
              Add option
            </button>
          )}
        </div>
      ))}

      <button
        onClick={() =>
          onChange({ ...value, questions: [...value.questions, { id: newId(), text: "", options: ["", "", "", ""], answer: 0 }] })
        }
        disabled={value.questions.length >= LIMITS.questions}
        className={addBtn}
      >
        <PlusIcon className="h-4 w-4" />
        Add quiz question
      </button>
    </section>
  );
}

// ---------- Theory ----------

function TheoryEditor({ value, onChange }: { value: UnitAssessment["theory"]; onChange: (v: UnitAssessment["theory"]) => void }) {
  const update = (i: number, patch: Partial<UnitAssessment["theory"]["questions"][number]>) =>
    onChange({ questions: value.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

  return (
    <section className="space-y-4">
      <div className={card}>
        <h2 className="text-base font-medium text-ink">Theory</h2>
        <p className="mt-0.5 text-xs text-ink/50">Short or long written answers. The trainer reads and marks them.</p>
      </div>

      {value.questions.map((q, i) => (
        <div key={q.id} className={card}>
          <div className="flex items-start gap-3">
            <span className="mt-2 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-lilac text-[11px] font-medium text-plum">{i + 1}</span>
            <div className="min-w-0 flex-1 space-y-3">
              <textarea
                rows={2}
                value={q.text}
                maxLength={LIMITS.text}
                onChange={(e) => update(i, { text: e.target.value })}
                placeholder="Question"
                aria-label={`Theory question ${i + 1}`}
                className={`${field} resize-y`}
              />
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                <input
                  value={q.guidance}
                  maxLength={LIMITS.text}
                  onChange={(e) => update(i, { guidance: e.target.value })}
                  placeholder="Guidance for the student (optional)"
                  aria-label={`Theory question ${i + 1} guidance`}
                  className={field}
                />
                <input
                  type="number"
                  min={1}
                  value={q.wordLimit ?? ""}
                  onChange={(e) => update(i, { wordLimit: e.target.value ? Number(e.target.value) : null })}
                  placeholder="Word limit"
                  aria-label={`Theory question ${i + 1} word limit`}
                  className={field}
                />
              </div>
            </div>
            <button
              onClick={() => onChange({ questions: value.questions.filter((_, j) => j !== i) })}
              aria-label={`Remove theory question ${i + 1}`}
              className={removeBtn}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={() => onChange({ questions: [...value.questions, { id: newId(), text: "", guidance: "", wordLimit: null }] })}
        disabled={value.questions.length >= LIMITS.questions}
        className={addBtn}
      >
        <PlusIcon className="h-4 w-4" />
        Add theory question
      </button>
    </section>
  );
}

// ---------- Shared checklist ----------

function Checklist({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: ListItem[];
  onChange: (items: ListItem[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={it.id} className="flex items-center gap-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 border-plum/30" aria-hidden />
          <input
            value={it.text}
            maxLength={LIMITS.text}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            placeholder={placeholder}
            aria-label={`${addLabel} ${i + 1}`}
            className={`${field} py-2.5`}
          />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove ${addLabel} ${i + 1}`} className={removeBtn}>
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, { id: newId(), text: "" }])}
        disabled={items.length >= LIMITS.items}
        className={addBtn}
      >
        <PlusIcon className="h-3.5 w-3.5" />
        {addLabel}
      </button>
    </div>
  );
}

// ---------- Role play ----------

function RolePlayEditor({ value, onChange }: { value: UnitAssessment["rolePlay"]; onChange: (v: UnitAssessment["rolePlay"]) => void }) {
  return (
    <section className="space-y-4">
      <div className={`${card} space-y-4`}>
        <div>
          <h2 className="text-base font-medium text-ink">Role play</h2>
          <p className="mt-0.5 text-xs text-ink/50">Describe the situation the student acts out. The trainer observes and ticks the checklist.</p>
        </div>
        <label className="block">
          <span className="text-[11px] font-medium text-ink/50">Scenario</span>
          <textarea
            rows={4}
            value={value.scenario}
            maxLength={LIMITS.longText}
            onChange={(e) => onChange({ ...value, scenario: e.target.value })}
            placeholder="e.g. Mrs Lee, 82, is refusing her morning shower and seems upset…"
            className={`${field} mt-1 resize-y`}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-ink/50">Instructions for the student</span>
          <textarea
            rows={3}
            value={value.instructions}
            maxLength={LIMITS.longText}
            onChange={(e) => onChange({ ...value, instructions: e.target.value })}
            placeholder="e.g. Talk with Mrs Lee, find out why, and agree on a plan that respects her choices."
            className={`${field} mt-1 resize-y`}
          />
        </label>
      </div>
      <div className={card}>
        <h3 className="text-sm font-medium text-ink">What the trainer observes</h3>
        <p className="mb-3 mt-0.5 text-xs text-ink/50">Each line becomes a tick box when the trainer marks the role play.</p>
        <Checklist
          items={value.criteria}
          onChange={(criteria) => onChange({ ...value, criteria })}
          placeholder="e.g. Uses open questions and active listening"
          addLabel="Add criterion"
        />
      </div>
    </section>
  );
}

// ---------- Workplace task ----------

function WorkplaceEditor({ value, onChange }: { value: UnitAssessment["workplace"]; onChange: (v: UnitAssessment["workplace"]) => void }) {
  return (
    <section className="space-y-4">
      <div className={`${card} space-y-4`}>
        <div>
          <h2 className="text-base font-medium text-ink">Workplace task</h2>
          <p className="mt-0.5 text-xs text-ink/50">A task the student completes during placement, with proof they did it.</p>
        </div>
        <label className="block">
          <span className="text-[11px] font-medium text-ink/50">Task</span>
          <textarea
            rows={5}
            value={value.task}
            maxLength={LIMITS.longText}
            onChange={(e) => onChange({ ...value, task: e.target.value })}
            placeholder="e.g. Support two clients with personal care over three shifts, following each client’s care plan."
            className={`${field} mt-1 resize-y`}
          />
        </label>
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-lilac/70 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink">Workplace supervisor must sign off</p>
            <p className="mt-0.5 text-[11px] text-ink/45">The supervisor confirms the student did the task.</p>
          </div>
          <Toggle
            checked={value.supervisorSignOff}
            label="Supervisor sign-off required"
            onChange={(supervisorSignOff) => onChange({ ...value, supervisorSignOff })}
          />
        </div>
      </div>
      <div className={card}>
        <h3 className="text-sm font-medium text-ink">Evidence the student uploads</h3>
        <p className="mb-3 mt-0.5 text-xs text-ink/50">e.g. completed log sheet, signed observation form, photos of their work.</p>
        <Checklist
          items={value.evidence}
          onChange={(evidence) => onChange({ ...value, evidence })}
          placeholder="e.g. Signed shift log for each shift"
          addLabel="Add evidence"
        />
      </div>
    </section>
  );
}
