"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Popup over the student's profile showing one course's units (opened with View)
export default function CourseViewModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  ); // the popup is drawn in the browser only (it goes into the page's portal root)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  if (!mounted) return null;
  const close = onClose;
  // centred on the screen; the units scroll inside the box
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/50 p-3 font-dm text-ink backdrop-blur-[2px] sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-fade-up flex max-h-[92dvh] w-full max-w-6xl min-w-0 flex-col overflow-hidden rounded-[1.75rem] bg-page shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink/10 bg-white px-5 py-4 sm:px-6">
          <h2 className="min-w-0 text-lg font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="shrink-0 rounded-full border border-ink/20 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-lilac"
          >
            Close
          </button>
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">{children}</div>
      </div>
    </div>,
    document.getElementById("portal-root") ?? document.body,
  );
}
