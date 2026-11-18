"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

const FONTS = {
  Urbanist: "var(--font-urbanist), sans-serif",
  Poppins: "var(--font-poppins), sans-serif",
  "System UI": "system-ui, sans-serif",
  Verdana: "Verdana, Geneva, sans-serif",
  Georgia: "Georgia, serif",
  "Courier New": '"Courier New", Courier, monospace',
};

type Font = keyof typeof FONTS;
type Preferences = { font: Font; size: number };

const STORAGE_KEY = "stella-student-typography";
const MIN_SIZE = 90;
const MAX_SIZE = 120;
const DEFAULTS: Preferences = { font: "Urbanist", size: 100 };

let sessionPreferences: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function readSnapshot() {
  if (sessionPreferences !== null) return sessionPreferences;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parsePreferences(snapshot: string | null): Preferences {
  if (snapshot === null) return DEFAULTS;
  try {
    const saved = JSON.parse(snapshot);
    const font = typeof saved?.font === "string" && Object.hasOwn(FONTS, saved.font) ? saved.font as Font : DEFAULTS.font;
    const size = Number.isInteger(saved?.size) && saved.size >= MIN_SIZE && saved.size <= MAX_SIZE ? saved.size : DEFAULTS.size;
    return { font, size };
  } catch {
    return DEFAULTS;
  }
}

export default function StudentTypography() {
  const control = useRef<HTMLDetailsElement>(null);
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => null);
  const { font, size } = parsePreferences(snapshot);

  useEffect(() => {
    const portal = control.current?.closest<HTMLElement>(".student-ui");
    portal?.style.setProperty("--student-font", FONTS[font]);
    portal?.style.setProperty("--student-text-scale", String(size / 100));
  }, [font, size]);

  function update(next: Preferences) {
    sessionPreferences = JSON.stringify(next);
    try {
      localStorage.setItem(STORAGE_KEY, sessionPreferences);
    } catch {
      // The controls still work when browser storage is unavailable.
    }
    listeners.forEach((listen) => listen());
  }

  return (
    <details
      ref={control}
      className="relative z-20 shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape" && event.currentTarget.open) {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-full border border-[var(--s-line)] bg-[var(--s-card)] px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-[var(--s-soft)] [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true">Aa</span>
        Text Style
      </summary>
      <div className="absolute left-0 top-full mt-2 w-64 space-y-4 rounded-2xl border border-[var(--s-line)] bg-[var(--s-card)] p-4 text-ink shadow-lg lg:right-0 lg:left-auto">
        <label className="block text-sm font-medium">
          Font family
          <select
            value={font}
            onChange={(event) => update({ font: event.target.value as Font, size })}
            className="mt-1.5 block w-full rounded-lg border border-[var(--s-line)] bg-[var(--s-soft)] px-2 py-2"
          >
            {(Object.keys(FONTS) as Font[]).map((font) => (
              <option key={font} value={font}>{font}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          <span className="flex items-center justify-between gap-2">
            Font size
            <span className="tabular-nums">{size}%</span>
          </span>
          <input
            type="range"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={size}
            aria-valuetext={size + "%"}
            onChange={(event) => update({ font, size: event.target.valueAsNumber })}
            className="mt-2 block w-full accent-[var(--s-dark)]"
          />
          <span aria-hidden="true" className="mt-1 flex justify-between text-xs text-ink/75">
            <span>{MIN_SIZE}%</span>
            <span>{MAX_SIZE}%</span>
          </span>
        </label>
        <button type="button" onClick={() => update(DEFAULTS)} className="text-xs font-semibold underline underline-offset-4">
          Reset to default
        </button>
      </div>
    </details>
  );
}
