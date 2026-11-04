"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, CloseIcon, LockIcon, PlusIcon } from "./icons";
import type { StudentNotificationKind } from "@/lib/student-notifications";

export type FeedItem = { id: string; kind: StudentNotificationKind; text: string; ago: string };

const SHOWN = 6;

const LOOK: Record<StudentNotificationKind, { icon: typeof CheckIcon; tone: string }> = {
  unlocked: { icon: CheckIcon, tone: "bg-emerald-600 text-white" },
  locked: { icon: LockIcon, tone: "bg-zinc-400 text-white" },
  hidden: { icon: CloseIcon, tone: "bg-amber-500 text-white" },
  shown: { icon: PlusIcon, tone: "bg-plum text-white" },
};

function Row({ item }: { item: FeedItem }) {
  const { icon: Icon, tone } = LOOK[item.kind];
  return (
    <li className="flex items-start gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug text-ink">{item.text}</span>
        <span className="mt-0.5 block text-xs text-ink">{item.ago}</span>
      </span>
    </li>
  );
}

// The newest six on the dashboard; "View all" opens every one in a pop-up
export default function NotificationFeed({ items }: { items: FeedItem[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!items.length) return <p className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink">No updates yet. Changes to your units will show here.</p>;

  return (
    <>
      <ul className="space-y-2">
        {items.slice(0, SHOWN).map((n) => (
          <Row key={n.id} item={n} />
        ))}
      </ul>
      {items.length > SHOWN && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-plum/30 bg-lilac px-4 py-2.5 text-sm font-semibold text-plum transition hover:bg-plum hover:text-white"
        >
          View all ({items.length})
        </button>
      )}
      {open &&
        createPortal(
          <div role="dialog" aria-modal="true" aria-label="All notifications" className="fixed inset-0 z-[100] grid place-items-center bg-[#14112b]/60 p-4" onClick={() => setOpen(false)}>
            <div className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-[1.5rem] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-4">
                <h2 className="text-lg font-semibold text-ink">All notifications ({items.length})</h2>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-ink transition hover:bg-lilac">
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>
              <ul className="space-y-2 overflow-y-auto p-4">
                {items.map((n) => (
                  <Row key={n.id} item={n} />
                ))}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
