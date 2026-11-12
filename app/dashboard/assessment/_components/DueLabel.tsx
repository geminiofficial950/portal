"use client";

import { useSyncExternalStore } from "react";
import { ClockIcon } from "../../_components/icons";

// The viewer's clock and time zone only exist in the browser, so the server render is a placeholder.
const noop = () => () => {};
const useNow = () => useSyncExternalStore(noop, () => Math.floor(Date.now() / 60000), () => null);

export const formatDue = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }); // date only, no time

export default function DueLabel({ dueAt }: { dueAt: string | null }) {
  const minute = useNow();
  if (!dueAt) return <span className="text-xs text-ink">No due date</span>;
  if (minute === null) return <span className="text-xs text-ink">Due date…</span>;

  const msLeft = new Date(dueAt).getTime() - minute * 60000;
  const days = Math.ceil(msLeft / 86400000);
  const text = formatDue(dueAt);
  const tone = msLeft < 0 ? "text-rose-800" : days <= 3 ? "text-amber-900" : "text-ink";
  const hint = msLeft < 0 ? " · Overdue" : days <= 1 ? " · Due today" : days <= 7 ? ` · ${days} days left` : "";

  return (
    <span className={`flex items-center gap-1.5 text-sm font-semibold ${tone}`}>
      <ClockIcon className="h-4 w-4" />
      Due {text}
      {hint}
    </span>
  );
}
