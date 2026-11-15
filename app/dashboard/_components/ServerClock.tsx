"use client";

import { useEffect } from "react";
import { serverTimeAction } from "../../actions/clock";
import { syncServerClock } from "@/lib/server-clock";

/** Ask the server for its time and keep the offset (see lib/server-clock.ts) */
export async function resyncServerClock() {
  const sent = performance.now();
  try {
    const server = await serverTimeAction();
    syncServerClock(server, sent, performance.now());
  } catch {
    // offline or the server didn't answer: keep the last offset, the next sync tries again
  }
}

// Keeps the student portal on the server's clock: on load, when the tab or window comes back (also after the
// computer slept, when performance.now() may have paused), when the connection returns, and every 5 minutes.
export default function ServerClock() {
  useEffect(() => {
    void resyncServerClock();
    const sync = () => void resyncServerClock();
    const onVisible = () => document.visibilityState === "visible" && sync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    window.addEventListener("pageshow", sync);
    const timer = setInterval(sync, 5 * 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
      window.removeEventListener("pageshow", sync);
      clearInterval(timer);
    };
  }, []);
  return null;
}
