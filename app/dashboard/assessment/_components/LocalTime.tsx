"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

// Formats an instant in the viewer's own time zone (rendered after hydration to avoid a server/client mismatch)
export default function LocalTime({ iso }: { iso: string }) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  if (!hydrated) return <span>…</span>;
  return (
    <time dateTime={iso}>
      {new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
    </time>
  );
}
