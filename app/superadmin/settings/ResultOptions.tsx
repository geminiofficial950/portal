"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { PlusIcon, TrashIcon } from "../../dashboard/_components/icons";
import { RESULT_KINDS, RESULT_LABEL_MAX, RESULT_TONES, toneStyle, type ResultOption } from "@/lib/result-meta";
import { addResultOptionAction, deleteResultOptionAction, updateResultOptionAction } from "./actions";

type Draft = Omit<ResultOption, "id">;
const blank: Draft = { label: "", kind: "other", tone: "blue" };

// The final result buttons staff pick for a unit (Pass / Fail / Withdrawn to start with)
export default function ResultOptions({ initialOptions }: { initialOptions: ResultOption[] }) {
  const [options, setOptions] = useState(initialOptions);
  const [editing, setEditing] = useState<string | null>(null); // option id, or "new"
  const [draft, setDraft] = useState<Draft>(blank);
  const [saving, startSaving] = useTransition();

  const open = (o: ResultOption | null) => {
    setEditing(o ? o.id : "new");
    setDraft(o ? { label: o.label, kind: o.kind, tone: o.tone } : blank);
  };

  const save = () =>
    startSaving(async () => {
      const res = editing === "new" ? await addResultOptionAction(draft) : await updateResultOptionAction(editing!, draft);
      if (!res.ok) return void toast.error(res.error);
      setOptions((list) => (editing === "new" ? [...list, res.option] : list.map((o) => (o.id === res.option.id ? res.option : o))));
      setEditing(null);
      toast.success(editing === "new" ? `${res.option.label} added` : `${res.option.label} saved`);
    });

  const remove = (o: ResultOption) => {
    if (!window.confirm(`Delete the result option “${o.label}”?`)) return;
    startSaving(async () => {
      const res = await deleteResultOptionAction(o.id);
      if (!res.ok) return void toast.error(res.error);
      setOptions((list) => list.filter((x) => x.id !== o.id));
      if (editing === o.id) setEditing(null);
      toast.success(`${o.label} deleted`);
    });
  };

  const form = (
    <div className="space-y-4 rounded-2xl bg-lilac/70 p-4">
      <label className="block">
        <span className="text-sm font-medium text-ink">Name</span>
        <input
          autoFocus
          value={draft.label}
          maxLength={RESULT_LABEL_MAX}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="e.g. Competent"
          className="mt-1.5 w-full rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/15 placeholder:text-ink/60 focus:ring-plum/40"
        />
      </label>
      <fieldset>
        <legend className="text-sm font-medium text-ink">Counts as</legend>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
          {RESULT_KINDS.map((k) => (
            <label
              key={k.key}
              className={`cursor-pointer rounded-xl px-4 py-3 ring-1 transition ${draft.kind === k.key ? "bg-white ring-2 ring-plum" : "bg-white/60 ring-ink/15 hover:bg-white"}`}
            >
              <input type="radio" name="result-kind" className="sr-only" checked={draft.kind === k.key} onChange={() => setDraft({ ...draft, kind: k.key })} />
              <span className="block text-sm font-medium text-ink">{k.label}</span>
              <span className="mt-0.5 block text-xs text-ink">{k.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium text-ink">Colour</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {RESULT_TONES.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={draft.tone === t.key}
              onClick={() => setDraft({ ...draft, tone: t.key })}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${toneStyle[t.key]} ${draft.tone === t.key ? "ring-2 ring-current" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition hover:bg-plum-light disabled:opacity-60"
        >
          {saving ? "Saving…" : editing === "new" ? "Add option" : "Save option"}
        </button>
        <button onClick={() => setEditing(null)} className="rounded-full px-4 py-2.5 text-sm font-medium text-ink hover:bg-white/70">
          Cancel
        </button>
        <span className="text-xs text-ink">
          Preview: <span className={`ml-1 rounded-full px-3 py-1 text-xs font-medium ${toneStyle[draft.tone]}`}>{draft.label.trim() || "Name"}</span>
        </span>
      </div>
    </div>
  );

  return (
    <section
      id="result-options"
      className="scroll-mt-6 rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-ink">Final result options</h2>
          <p className="mt-0.5 text-sm text-ink">The buttons staff choose from when giving a unit its final result.</p>
        </div>
        {editing !== "new" && (
          <button
            onClick={() => open(null)}
            className="inline-flex items-center gap-2 rounded-full bg-plum px-4 py-2.5 text-sm font-medium text-white transition hover:bg-plum-light"
          >
            <PlusIcon className="h-4 w-4" />
            New option
          </button>
        )}
      </div>

      <ul className="mt-4 divide-y divide-ink/10">
        {options.map((o) => (
          <li key={o.id} className="py-3">
            {editing === o.id ? (
              form
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`rounded-full px-4 py-1.5 text-sm font-medium ${toneStyle[o.tone]}`}>{o.label}</span>
                  <span className="text-sm text-ink">{RESULT_KINDS.find((k) => k.key === o.kind)?.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => open(o)}
                    disabled={saving}
                    className="rounded-full bg-lilac px-4 py-1.5 text-sm font-medium text-ink transition hover:bg-plum/10 hover:text-plum"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(o)}
                    disabled={saving}
                    aria-label={`Delete ${o.label}`}
                    className="rounded-full p-2 text-ink transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
        {editing === "new" && <li className="py-3">{form}</li>}
      </ul>
      <p className="mt-3 text-xs text-ink">
        Renaming an option also changes it for students who already have it. An option that students already have can’t be deleted.
      </p>
    </section>
  );
}
