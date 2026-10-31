"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

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

export default function Calendar() {
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
        <div className="flex items-center gap-1 text-2xl leading-none text-ink/40">
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
          return (
            <span key={i} className="grid place-items-center">
              <span
                className={`grid h-9 w-9 place-items-center rounded-full ${
                  isToday ? "bg-peach text-white" : muted ? "text-ink/30" : "text-ink"
                }`}
              >
                {day}
              </span>
            </span>
          );
        })}
      </div>
    </section>
  );
}
