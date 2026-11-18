"use client";

import { useSyncExternalStore } from "react";
import { ClockIcon } from "../dashboard/_components/icons";
import { melbourneClock } from "@/lib/clock";

// The clock follows the SERVER's time, not the laptop's: it asks /api/time once, then counts on with
// performance.now() (a steady counter the computer's clock setting can't change). It checks the server again every
// few minutes and when the tab comes back (a laptop may have slept). Until the server answers, no time is shown.
let offset: number | null = null; // server time − performance.now(), in ms
let listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let lastSync = 0;
const RESYNC_MS = 5 * 60_000;

async function sync() {
  lastSync = performance.now();
  try {
    const sent = performance.now();
    const res = await fetch("/api/time", { cache: "no-store" });
    const { now } = (await res.json()) as { now: number };
    const back = performance.now();
    offset = now + (back - sent) / 2 - back; // half the round trip covers the time on the wire
    listeners.forEach((l) => l());
  } catch {
    lastSync = 0; // try again on the next tick
  }
}

const onVisible = () => {
  if (document.visibilityState === "visible") void sync();
};

const subscribe = (tick: () => void) => {
  listeners.add(tick);
  if (!timer) {
    void sync();
    timer = setInterval(() => {
      if (performance.now() - lastSync > RESYNC_MS || offset === null) void sync();
      listeners.forEach((l) => l());
    }, 1000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
  }
  return () => {
    listeners.delete(tick);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      listeners = new Set();
    }
  };
};
const now = () => (offset === null ? null : Math.floor((offset + performance.now()) / 1000));
const serverNow = () => null;

// Live Melbourne time, shown in the portal header for every role
export default function MelbourneClock({ student = false }: { student?: boolean }) {
  const seconds = useSyncExternalStore(subscribe, now, serverNow);
  const c = seconds === null ? null : melbourneClock(seconds * 1000);
  if (student) {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--s-line)] bg-[var(--s-card)] px-3 py-1.5 text-ink" data-clock-seconds={seconds ?? undefined}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--s-icon)]">
          <ClockIcon aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-xs text-ink/75">Melbourne time</p>
          <p className="text-sm font-semibold tabular-nums">{c?.time ?? "?"} <span className="hidden font-normal text-ink/75 sm:inline">{c ? "? " + c.date : ""}</span></p>
        </div>
      </div>
    );
  }
  return (
    <p
      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-1.5 text-sm text-ink shadow-sm"
      aria-label={c ? `Melbourne time ${c.time}, ${c.date}` : "Melbourne time"}
      data-clock-seconds={seconds ?? undefined}
    >
      <ClockIcon className="h-4 w-4 shrink-0 text-plum" />
      <span className="font-semibold">Melbourne</span>
      {c ? (
        <>
          <span className="tabular-nums font-semibold">{c.time}</span>
          <span className="hidden sm:inline">· {c.date}</span>
        </>
      ) : (
        <span className="w-20" />
      )}
    </p>
  );
}
