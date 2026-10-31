"use client";

import { useState } from "react";
import { PlusIcon } from "./icons";

type Task = { id: number; title: string; time: string; done: boolean };

const initialTasks: Task[] = [
  { id: 1, title: "Complete First Aid Assessment", time: "08.00-10.00 AM", done: false },
  { id: 2, title: "Meeting with Trainer", time: "11.00-12.00 AM", done: false },
  { id: 3, title: "Doing Research", time: "13.00-16.00 PM", done: false },
];

export default function TodayTasks() {
  const [tasks, setTasks] = useState(initialTasks);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const addTask = () => {
    const title = draft.trim();
    if (title) {
      setTasks((t) => [...t, { id: Date.now(), title, time: "Anytime", done: false }]);
    }
    setDraft("");
    setAdding(false);
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-ink">
          Today Task <span className="text-sm">({tasks.length})</span>
        </h2>
        <button
          onClick={() => setAdding(true)}
          aria-label="Add task"
          className="rounded p-1 text-plum transition hover:bg-lilac"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      </div>

      <ul className="mt-4 space-y-1 rounded-lg bg-lilac/70 p-4 shadow-[0_4px_24px_-8px_rgba(91,63,153,0.15)]">
        {tasks.map((task) => (
          <li key={task.id}>
            <label className="flex cursor-pointer items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={task.done}
                onChange={() =>
                  setTasks((t) => t.map((x) => (x.id === task.id ? { ...x, done: !x.done } : x)))
                }
                className="peer sr-only"
              />
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded border-2 border-plum text-[11px] text-white peer-checked:bg-plum">
                {task.done && "✓"}
              </span>
              <span className={`flex-1 text-sm text-ink/80 ${task.done ? "line-through opacity-50" : ""}`}>
                {task.title}
              </span>
              <span className="shrink-0 text-[10px] font-medium text-plum">{task.time}</span>
            </label>
          </li>
        ))}
        {adding && (
          <li className="flex items-center gap-3 py-2">
            <span className="h-5 w-5 shrink-0 rounded border-2 border-plum/40" />
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTask();
                if (e.key === "Escape") setAdding(false);
              }}
              onBlur={addTask}
              placeholder="New task…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink/40"
            />
          </li>
        )}
      </ul>
    </section>
  );
}
