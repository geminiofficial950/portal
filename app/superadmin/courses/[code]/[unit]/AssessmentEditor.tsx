"use client";

import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { CheckIcon, PlusIcon, TrashIcon } from "../../../../dashboard/_components/icons";
import FileList from "../../../../dashboard/_components/FileList";
import {
  ASSESSMENT_PARTS,
  isWritten,
  LIMITS,
  summarise,
  TASK_FILES_MAX,
  UPLOAD_SLOT_LABEL_MAX,
  UPLOAD_SLOTS_MAX,
  type AssessmentPart,
  type UnitAssessment,
  type UploadSlot,
} from "@/lib/assessment-meta";
import type { Unit } from "@/lib/courses";
import { toLocalInput } from "@/lib/format";
import type { FileRef } from "@/lib/submission-meta";
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
  canEditDue = true,
}: {
  course: { code: string; name: string };
  unit: Unit;
  initialAssessment: UnitAssessment;
  onDirtyChange?: (dirty: boolean) => void;
  canEditDue?: boolean;
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
    theory: summary.theoryCount ? `${summary.theoryCount} file${summary.theoryCount === 1 ? "" : "s"}` : "",
    rolePlay: summary.rolePlay ? "✓" : "",
    workplace: summary.workplaceCount ? `${summary.workplaceCount} file${summary.workplaceCount === 1 ? "" : "s"}` : "",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-medium text-ink">Assessment</h2>
          <p className="mt-0.5 text-sm text-ink/55">Set the due date and each part, then save.</p>
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

      <DueDate value={a.dueAt} onChange={(dueAt) => setA({ ...a, dueAt })} canEdit={canEditDue} />

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
      {tab === "theory" && (
        <TaskFilesEditor
          title="Theory Task"
          files={a.theory.files}
          onChange={(files) => setA({ ...a, theory: { ...a.theory, files } })}
          uploads={a.theory.uploads}
          onUploadsChange={(uploads) => setA({ ...a, theory: { ...a.theory, uploads } })}
        />
      )}
      {tab === "workplace" && (
        <TaskFilesEditor
          title="Workplacement Task"
          files={a.workplace.files}
          onChange={(files) => setA({ ...a, workplace: { ...a.workplace, files } })}
          uploads={a.workplace.uploads}
          onUploadsChange={(uploads) => setA({ ...a, workplace: { ...a.workplace, uploads } })}
        />
      )}
    </div>
  );
}

// ---------- Due date ----------

// <input type="datetime-local"> works in the viewer's local time; we store an ISO instant
function DueDate({ value, onChange, canEdit }: { value: string | null; onChange: (v: string | null) => void; canEdit: boolean }) {
  if (!canEdit) {
    return (
      <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <h2 className="text-base font-medium text-ink">Due date &amp; time</h2>
          <p className="mt-0.5 text-sm text-ink">Only Super Admin can change dates.</p>
        </div>
        <p className="rounded-xl bg-lilac px-4 py-2.5 text-sm font-medium text-ink">
          {value ? new Date(value).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "No deadline"}
        </p>
      </div>
    );
  }
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

// ---------- Quiz and Activities ----------

function QuizEditor({ value, onChange }: { value: UnitAssessment["quiz"]; onChange: (v: UnitAssessment["quiz"]) => void }) {
  const update = (i: number, patch: Partial<UnitAssessment["quiz"]["questions"][number]>) =>
    onChange({ ...value, questions: value.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

  return (
    <section className="space-y-4">
      <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <h2 className="text-base font-medium text-ink">Quiz and Activities</h2>
          <p className="mt-0.5 text-xs text-ink/50">
            Each question is multiple choice (scored automatically) or a written answer (the student types it and the trainer reads it).
          </p>
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

          <div role="radiogroup" aria-label={`Question ${i + 1} type`} className="mt-3 flex flex-wrap gap-2 pl-10">
            {(
              [
                ["choice", "Multiple choice"],
                ["written", "Written answer"],
              ] as const
            ).map(([kind, label]) => {
              const active = (q.kind ?? "choice") === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() =>
                    !active &&
                    update(i, kind === "written" ? { kind, options: [], answer: -1 } : { kind, options: ["", "", "", ""], answer: 0 })
                  }
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${active ? "bg-plum text-white" : "bg-lilac text-plum hover:bg-plum/10"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {isWritten(q) ? (
            <p className="mt-3 pl-10 text-sm text-ink">The student gets a box to type their answer. The trainer reads it when marking.</p>
          ) : (
            <>
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
            </>
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
        Add multiple-choice question
      </button>
      <button
        onClick={() =>
          onChange({ ...value, questions: [...value.questions, { id: newId(), text: "", kind: "written", options: [], answer: -1 }] })
        }
        disabled={value.questions.length >= LIMITS.questions}
        className={`${addBtn} ml-2`}
      >
        <PlusIcon className="h-4 w-4" />
        Add written question
      </button>
    </section>
  );
}

// ---------- Theory Task / Workplacement Task ----------

// Super Admin uploads the task (PDF is best — students can read it in the page); students download it and upload their work
function TaskFilesEditor({
  title,
  files,
  onChange,
  uploads,
  onUploadsChange,
}: {
  title: string;
  files: FileRef[];
  onChange: (files: FileRef[]) => void;
  uploads: UploadSlot[];
  onUploadsChange: (uploads: UploadSlot[]) => void;
}) {
  return (
    <div className="space-y-5">
      <section className={`${card} space-y-4`}>
        <div>
          <h2 className="text-base font-medium text-ink">{title}</h2>
          <p className="mt-0.5 text-sm text-ink">
            Upload the task document(s). Students read or download them, do the task and upload their completed work — nothing to type.
            A PDF opens right in the student’s page. Up to {TASK_FILES_MAX} files. Remember to save.
          </p>
        </div>
        <FileList
          files={files}
          onChange={(next) => onChange(next.slice(0, TASK_FILES_MAX))}
          emptyText="No task document yet."
          uploadLabel="Upload task document"
          inputLabel={`Upload ${title} document`}
        />
      </section>
      <UploadSlotsEditor title={title} uploads={uploads} onChange={onUploadsChange} />
    </div>
  );
}

// The attachments the student must upload for this task. Each one gets its own upload box on the student's page,
// and they can't submit until every box has a file. Leave it empty to let them upload any files.
function UploadSlotsEditor({ title, uploads, onChange }: { title: string; uploads: UploadSlot[]; onChange: (u: UploadSlot[]) => void }) {
  const set = (i: number, label: string) => onChange(uploads.map((u, j) => (j === i ? { ...u, label } : u)));
  return (
    <section className={`${card} space-y-4`}>
      <div>
        <h2 className="text-base font-medium text-ink">What the student must upload</h2>
        <p className="mt-0.5 text-sm text-ink">
          Name each attachment you need (for example “Completed answers” or “Signed log timesheet”). The student gets an upload box for
          each one and must fill them all before submitting. Leave this empty to let them upload any files. Remember to save.
        </p>
      </div>
      {uploads.length > 0 && (
        <ol className="space-y-2">
          {uploads.map((u, i) => (
            <li key={u.id} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-sm font-medium text-ink">{i + 1}.</span>
              <input
                value={u.label}
                maxLength={UPLOAD_SLOT_LABEL_MAX}
                onChange={(e) => set(i, e.target.value)}
                placeholder="e.g. Signed log timesheet"
                aria-label={`${title} attachment ${i + 1}`}
                className={field}
              />
              <button
                type="button"
                onClick={() => onChange(uploads.filter((_, j) => j !== i))}
                aria-label={`Remove attachment ${i + 1}`}
                className={removeBtn}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ol>
      )}
      {uploads.length < UPLOAD_SLOTS_MAX && (
        <button type="button" onClick={() => onChange([...uploads, { id: newId(), label: "" }])} className={addBtn}>
          <PlusIcon className="h-4 w-4" />
          Add attachment
        </button>
      )}
    </section>
  );
}
