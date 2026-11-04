"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

const EVERY = 60_000;
const noop = () => () => {};

// Keeps a dashboard current: fetches fresh data every minute and whenever the tab is opened again.
// Shows when the numbers were last updated (in the viewer's time, after hydration).
export default function LiveRefresh({ at }: { at: string }) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(noop, () => true, () => false);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, EVERY);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return (
    <p className="flex items-center justify-end gap-2 text-xs font-medium text-ink" aria-live="polite">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
      </span>
      Live · updated {hydrated ? new Date(at).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" }) : "just now"}
    </p>
  );
}
