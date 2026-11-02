"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { PlusIcon, TrashIcon } from "../../dashboard/_components/icons";
import { DECLARATION_LIMITS, type DeclarationText } from "@/lib/declaration";
import { saveDeclarationAction } from "./actions";

const field =
  "w-full rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/15 placeholder:text-ink/60 focus:ring-plum/40";

// The declaration students tick before submitting a Theory Task or Workplacement Task
export default function DeclarationEditor({ initial }: { initial: DeclarationText }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, startSaving] = useTransition();
  const dirty = JSON.stringify(text) !== JSON.stringify(saved);

  const setPoint = (i: number, value: string) => setText({ ...text, points: text.points.map((p, j) => (j === i ? value : p)) });
  const removePoint = (i: number) => setText({ ...text, points: text.points.filter((_, j) => j !== i) });
  const movePoint = (i: number, by: -1 | 1) => {
    const points = [...text.points];
    [points[i], points[i + by]] = [points[i + by], points[i]];
    setText({ ...text, points });
  };

  const save = () =>
    startSaving(async () => {
      const res = await saveDeclarationAction(text);
      if (!res.ok) return void toast.error(res.error);
      setText(res.declaration);
      setSaved(res.declaration);
      toast.success("Declaration saved");
    });

  return (
    <section
      id="declaration"
      className="scroll-mt-6 rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] sm:p-6"
    >
      <h2 className="text-lg font-medium text-ink">Declaration</h2>
      <p className="mt-0.5 text-sm text-ink">
        Students tick this before they submit a Theory Task or Workplacement Task. Certificates already made keep the words the student agreed to.
      </p>

      <div className="mt-5 space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-ink">Opening line</span>
          <input
            value={text.intro}
            maxLength={DECLARATION_LIMITS.intro}
            onChange={(e) => setText({ ...text, intro: e.target.value })}
            className={`mt-1.5 ${field}`}
          />
        </label>

        <div>
          <p className="text-sm font-medium text-ink">Points</p>
          <ol className="mt-1.5 space-y-2">
            {text.points.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-3 w-6 shrink-0 text-right text-sm font-medium text-ink">{i + 1}.</span>
                <textarea
                  rows={2}
                  value={p}
                  maxLength={DECLARATION_LIMITS.point}
                  onChange={(e) => setPoint(i, e.target.value)}
                  aria-label={`Point ${i + 1}`}
                  className={`${field} resize-y`}
                />
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    onClick={() => movePoint(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move point ${i + 1} up`}
                    className="rounded-lg bg-lilac px-2 py-1 text-xs font-medium text-ink hover:bg-plum/10 disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => movePoint(i, 1)}
                    disabled={i === text.points.length - 1}
                    aria-label={`Move point ${i + 1} down`}
                    className="rounded-lg bg-lilac px-2 py-1 text-xs font-medium text-ink hover:bg-plum/10 disabled:opacity-40"
                  >
                    ↓
                  </button>
                </div>
                <button
                  onClick={() => removePoint(i)}
                  aria-label={`Delete point ${i + 1}`}
                  className="mt-2 rounded-full p-2 text-ink transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
          {text.points.length < DECLARATION_LIMITS.points && (
            <button
              onClick={() => setText({ ...text, points: [...text.points, ""] })}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-lilac px-4 py-2 text-sm font-medium text-plum transition hover:bg-plum/10"
            >
              <PlusIcon className="h-4 w-4" />
              Add point
            </button>
          )}
        </div>

        <label className="block">
          <span className="text-sm font-medium text-ink">Tick-box line</span>
          <input
            value={text.agree}
            maxLength={DECLARATION_LIMITS.agree}
            onChange={(e) => setText({ ...text, agree: e.target.value })}
            className={`mt-1.5 ${field}`}
          />
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="rounded-full bg-plum px-6 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save declaration"}
        </button>
        {dirty && (
          <button onClick={() => setText(saved)} className="rounded-full px-5 py-3 text-sm font-medium text-ink hover:bg-lilac">
            Discard
          </button>
        )}
      </div>
    </section>
  );
}
