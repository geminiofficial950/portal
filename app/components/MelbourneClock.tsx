"use client";

import { useSyncExternalStore } from "react";
import { ClockIcon } from "../dashboard/_components/icons";
import { melbourneClock } from "@/lib/clock";

// Ticks once a second; on the server (and before hydration) there's no time to show, so nothing mismatches
const subscribe = (tick: () => void) => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
};
const now = () => Math.floor(Date.now() / 1000);
const serverNow = () => null;

// Live Melbourne time, shown in the portal header for every role
export default function MelbourneClock() {
  const seconds = useSyncExternalStore(subscribe, now, serverNow);
  const c = seconds === null ? null : melbourneClock(seconds * 1000);
  return (
    <p
      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-1.5 text-sm text-ink shadow-sm"
      aria-label={c ? `Melbourne time ${c.time}, ${c.date}` : "Melbourne time"}
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
