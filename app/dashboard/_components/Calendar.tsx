"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import toast from "react-hot-toast";

// Something on a day, for the dots on the calendar: a due date or a meeting. `label` says what it is; `note` is optional.
export type CalendarDue = { id: string; iso: string; label: string; note?: string };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Today's date is only known on the client; the server render shows no highlight.
const noop = () => () => {};
const useToday = () =>
  useSyncExternalStore(
    noop,
    () => new Date().toDateString(),
    () => null,
  );

// Days in the viewer's own time zone ("2026-10-10" style keys, month 0-based)
const dayKey = (y: number, m: number, d: number) => `${y}-${m}-${d}`;
const keyOf = (iso: string) => {
  const d = new Date(iso);
  return dayKey(d.getFullYear(), d.getMonth(), d.getDate());
};

// Month view; a day with something on it has a dot, and clicking it pops up what's on that day
export default function Calendar({ dues = [] }: { dues?: CalendarDue[] }) {
  const todayStr = useToday();
  const today = todayStr ? new Date(todayStr) : null;
  const [view, setView] = useState<{ y: number; m: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close the month picker on outside click or Escape
  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pickerOpen]);

  const current = view ?? (today ? { y: today.getFullYear(), m: today.getMonth() } : null);
  if (!current) return <div className="h-80" />;

  const { y, m } = current;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();

  const cells: { day: number; muted: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevDays - i, muted: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, muted: false });

  const dueOn = new Map<string, CalendarDue[]>();
  for (const d of dues) dueOn.set(keyOf(d.iso), [...(dueOn.get(keyOf(d.iso)) ?? []), d]);

  const showDue = (day: number, list: CalendarDue[]) => {
    const when = new Date(y, m, day).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
    const time = (iso: string) => new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
    toast(
      <div className="text-sm text-ink">
        <p className="font-semibold">{when}</p>
        <ul className="mt-1 space-y-0.5">
          {list.map((d) => (
            <li key={d.id}>
              {d.label} · {time(d.iso)}
              {d.note && ` · ${d.note}`}
            </li>
          ))}
        </ul>
      </div>,
      { id: `due-${y}-${m}-${day}`, icon: "📅", duration: 5000 },
    );
  };

  const shift = (delta: number) => {
    const d = new Date(y, m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <section id="calendar">
      <div className="flex items-center justify-between">
        <div ref={pickerRef} className="relative">
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className="flex items-center gap-4 text-2xl font-medium text-ink sm:text-[1.6rem]"
          >
            {MONTHS[m]}, {y}
            <span className={`text-sm transition ${pickerOpen ? "rotate-180" : ""}`}>▼</span>
          </button>
          {pickerOpen && (
            <div className="absolute left-0 top-full z-20 mt-2 grid w-64 grid-cols-3 gap-1 rounded-xl bg-white p-2 shadow-xl ring-1 ring-ink/5">
              {MONTHS.map((name, i) => (
                <button
                  key={name}
                  onClick={() => {
                    setView({ y, m: i });
                    setPickerOpen(false);
                  }}
                  className={`rounded-lg py-2 text-xs ${i === m ? "bg-plum text-white" : "hover:bg-lilac"}`}
                >
                  {name.slice(0, 3)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-2xl leading-none text-ink">
          <button onClick={() => shift(-1)} aria-label="Previous month" className="rounded px-2 py-1 hover:bg-lilac hover:text-plum">
            ‹
          </button>
          <button onClick={() => shift(1)} aria-label="Next month" className="rounded px-2 py-1 hover:bg-lilac hover:text-plum">
            ›
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-7 border-b border-ink/10 pb-2.5 text-center text-sm font-medium text-ink">
        {DAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-7 gap-y-1.5 text-center text-sm">
        {cells.map(({ day, muted }, i) => {
          const isToday =
            !muted && today && today.getFullYear() === y && today.getMonth() === m && today.getDate() === day;
          const due = muted ? undefined : dueOn.get(dayKey(y, m, day));
          const circle = `relative grid h-9 w-9 place-items-center rounded-full ${isToday ? "bg-peach text-white" : "text-ink"}`;
          return (
            <span key={i} className="grid place-items-center">
              {due ? (
                <button
                  type="button"
                  onClick={() => showDue(day, due)}
                  aria-label={`${day}: ${due.length} on this day — show what`}
                  className={`${circle} font-semibold transition hover:bg-lilac hover:text-plum`}
                >
                  {day}
                  {/* the dot under a day with something due */}
                  <span aria-hidden className="absolute -bottom-0.5 h-2 w-2 rounded-full bg-plum ring-2 ring-white" />
                </button>
              ) : (
                <span className={circle}>{day}</span>
              )}
            </span>
          );
        })}
      </div>
    </section>
  );
}
