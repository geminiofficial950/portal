"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { timeAgo } from "@/lib/format";
import type { StudentNotificationDTO, StudentNotificationKind } from "@/lib/student-notifications";
import { BellIcon, CheckIcon, CloseIcon, LockIcon, PlusIcon } from "./icons";

const SHOWN = 2;
const REFRESH_MS = 8_000;

const LOOK: Record<StudentNotificationKind, { icon: typeof CheckIcon; tone: string }> = {
  unlocked: { icon: CheckIcon, tone: "bg-emerald-600 text-white" },
  locked: { icon: LockIcon, tone: "bg-zinc-400 text-white" },
  hidden: { icon: CloseIcon, tone: "bg-amber-500 text-white" },
  shown: { icon: PlusIcon, tone: "bg-plum text-white" },
  class: { icon: PlusIcon, tone: "bg-sky-600 text-white" },
  portal: { icon: BellIcon, tone: "bg-[var(--s-dark)] text-white" },
};

function Row({ item, now, compact = false }: { item: StudentNotificationDTO; now: Date; compact?: boolean }) {
  const { icon: Icon, tone } = LOOK[item.kind];
  return (
    <li className={`flex items-start ${compact ? "gap-2 px-1 py-1.5" : "gap-3 rounded-xl border border-[var(--s-line)] bg-[var(--s-soft)] p-3"}`}>
      <span className={`grid shrink-0 place-items-center rounded-full ${compact ? "size-5" : "size-8"} ${tone}`}>
        <Icon className={compact ? "size-3" : "size-4"} />
      </span>
      <div className="min-w-0">
        <p className={`wrap-anywhere font-semibold leading-snug text-ink ${compact ? "text-xs" : "text-sm"}`}>{item.text}</p>
        <time dateTime={item.at} className={`block text-ink/75 ${compact ? "text-[11px]" : "mt-0.5 text-xs"}`}>{timeAgo(new Date(item.at), now)}</time>
      </div>
    </li>
  );
}

export default function NotificationFeed({
  initialItems,
  initialTime,
  children,
}: {
  initialItems: StudentNotificationDTO[];
  initialTime: number;
  children: ReactNode;
}) {
  const [items, setItems] = useState(initialItems);
  const [now, setNow] = useState(initialTime);
  const [newCount, setNewCount] = useState(0);
  const lastIds = useRef(new Set(initialItems.map(({ id }) => id)));
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;

    async function refresh() {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const response = await fetch("/api/student-notifications", { signal: controller.signal, cache: "no-store" });
        if (!response.ok || controller.signal.aborted) return;
        const next: StudentNotificationDTO[] = await response.json();
        if (controller.signal.aborted) return;

        const added = next.filter(({ id }) => !lastIds.current.has(id)).length;
        lastIds.current = new Set(next.map(({ id }) => id));
        setItems(next);
        setNow(Date.now());
        if (added && !dialog.current?.open) setNewCount((count) => count + added);
      } catch {
        // Keep the existing feed if a connection drops; the next poll retries.
      } finally {
        pending = false;
      }
    }

    void refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const currentTime = new Date(now);
  return (
    <div className="mt-2 space-y-2">
      <div aria-live="polite" aria-atomic="true" className={newCount ? undefined : "sr-only"}>
        {newCount > 0 && (
          <p className="inline-flex items-center gap-1 rounded-full bg-[var(--s-soft)] px-2 py-0.5 text-[11px] font-semibold text-ink">
            <BellIcon className="size-3 shrink-0" />
            {newCount === 1 ? "You have one new notification" : `You have ${newCount} new notifications`}
          </p>
        )}
      </div>
      {items.length === 0 ? (
        <>
          {children}
          <p className="border-t border-[var(--s-line)] px-1 pt-3 text-sm text-ink/70">No new updates yet.</p>
        </>
      ) : (
        <ul className="divide-y divide-[var(--s-line)]">
          {items.slice(0, SHOWN).map((item) => <Row key={item.id} item={item} now={currentTime} compact />)}
        </ul>
      )}
      {items.length >= SHOWN && (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => {
            dialog.current?.showModal();
            setNewCount(0);
          }}
          className="w-full rounded-xl border border-[var(--s-line)] bg-[var(--s-soft)] px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-[var(--s-badge-hover)]"
        >
          View all ({items.length})
        </button>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="all-notifications-heading"
        className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-hidden rounded-[1.5rem] border border-[var(--s-line)] bg-[var(--s-card)] p-0 text-ink shadow-2xl backdrop:bg-[#14112b]/60"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--s-line)] px-5 py-4">
            <h2 id="all-notifications-heading" className="text-lg font-semibold">All notifications ({items.length})</h2>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="grid size-9 place-items-center rounded-full hover:bg-[var(--s-soft)]">
              <CloseIcon className="size-5" />
            </button>
          </div>
          <ul className="space-y-2 overflow-y-auto p-4">
            {items.map((item) => <Row key={item.id} item={item} now={currentTime} />)}
          </ul>
        </div>
      </dialog>
    </div>
  );
}
