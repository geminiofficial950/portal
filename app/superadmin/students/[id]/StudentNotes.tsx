"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { addStudentNoteAction } from "@/app/actions/student-notes";
import type { StudentNoteDTO } from "@/lib/student-notes";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Australia/Melbourne" });

// Staff notes on a student — Admins and trainers only, never the student.
// Admin: write, tick which of the student's trainers can see it. Trainer: write; Admins see it.
export default function StudentNotes({
  studentId,
  role,
  trainers = [],
  initial,
}: {
  studentId: string;
  role: "admin" | "trainer";
  trainers?: { trainerId: string; name: string }[];
  initial: StudentNoteDTO[];
}) {
  const [notes, setNotes] = useState(initial);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, start] = useTransition();
  const needsTrainer = role === "admin" && trainers.length > 0;
  const ready = text.trim().length > 0 && (!needsTrainer || picked.length > 0) && !saving;

  const save = () =>
    start(async () => {
      const res = await addStudentNoteAction(studentId, text, picked);
      if (!res.ok) return void toast.error(res.error);
      setNotes((n) => [res.note, ...n]);
      setText("");
      setPicked([]);
      toast.success("Note saved");
    });

  return (
    <section aria-labelledby="notes-heading" className="space-y-4 rounded-[1.5rem] bg-lilac/80 p-5">
      <div>
        <h2 id="notes-heading" className="text-base font-semibold text-ink">
          Notes
        </h2>
        <p className="text-sm text-ink">Only staff see these notes — never the student.</p>
      </div>

      <div className="space-y-3 rounded-2xl bg-white p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Write a note about this student…"
          aria-label="Note"
          className="w-full resize-y rounded-xl bg-lilac/40 px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/15 focus:ring-2 focus:ring-plum/40"
        />
        {role === "admin" ? (
          trainers.length ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-ink">Show this note to (tick one or more trainers)</legend>
              <div className="flex flex-wrap gap-2">
                {trainers.map((t) => {
                  const on = picked.includes(t.trainerId);
                  return (
                    <label
                      key={t.trainerId}
                      className={`flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-2 text-sm text-ink transition ${on ? "bg-plum/10 ring-2 ring-plum" : "bg-lilac/50 ring-1 ring-ink/15 hover:bg-lilac"}`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => setPicked((p) => (e.target.checked ? [...p, t.trainerId] : p.filter((x) => x !== t.trainerId)))}
                        className="h-4 w-4 accent-plum"
                      />
                      {t.name}
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-ink">Admins always see every note.</p>
            </fieldset>
          ) : (
            <p className="text-sm text-ink">This student has no trainer yet, so only Admins will see this note.</p>
          )
        ) : (
          <p className="text-sm text-ink">Admins will see this note.</p>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={!ready}
            className="rounded-xl bg-plum px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-plum-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save note"}
          </button>
        </div>
      </div>

      {notes.length ? (
        <ul className="space-y-2" aria-label="Notes">
          {notes.map((n) => (
            <li key={n.noteId} className="rounded-2xl bg-white px-4 py-3">
              <p className="whitespace-pre-wrap text-sm text-ink">{n.text}</p>
              <p className="mt-2 text-xs text-ink">
                <span className="font-semibold">{n.byName}</span>
                {n.byRole === "trainer" ? " (Trainer)" : ""} · {when(n.at)} · Seen by: {n.forNames.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink">No notes yet.</p>
      )}
    </section>
  );
}
