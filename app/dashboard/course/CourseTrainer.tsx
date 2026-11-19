"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CloseIcon, MailIcon } from "../_components/icons";

export type CourseTrainerInfo = { trainerId: string; name: string; email: string; batch: string; photo: string | null }; // photo: image URL or null

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";
const CLOSE_MS = 220;

// "Trainer: <name>" on the course card — only when the student has a trainer for this course. Clicking the name
// opens a pop-up (native <dialog>: focus stays inside, Esc closes) with the trainer's details.
export default function CourseTrainer({ trainers }: { trainers: CourseTrainerInfo[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [visible, setVisible] = useState(false);
  const titleId = useId();
  const label = trainers.length > 1 ? "Your trainers" : "Your trainer";

  const open = () => {
    dialogRef.current?.showModal();
    requestAnimationFrame(() => setVisible(true));
  };
  const close = () => {
    setVisible(false);
    window.setTimeout(() => dialogRef.current?.close(), CLOSE_MS);
  };

  // no page scroll behind the pop-up
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  if (!trainers.length) return null;

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="inline-flex min-w-0 cursor-pointer items-center gap-2 rounded-lg text-base text-ink transition hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--s-dark)]"
      >
        {/* the trainer's photo, or a person icon */}
        {trainers[0].photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- private file served by /api/files
          <img src={trainers[0].photo} alt="" className="size-7 shrink-0 rounded-full object-cover ring-1 ring-[var(--s-line)]" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
          </svg>
        )}
        <span className="truncate">
          {trainers.length > 1 ? "Trainers" : "Trainer"} {trainers.map((t) => t.name).join(", ")}
        </span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={(e) => {
          e.preventDefault(); // Esc: close with the animation
          close();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close(); // click on the backdrop
        }}
        className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-visible bg-transparent p-0 text-ink backdrop:bg-[#0b1214]/45 backdrop:backdrop-blur-sm backdrop:transition-opacity backdrop:duration-300 motion-reduce:backdrop:transition-none ${
          visible ? "backdrop:opacity-100" : "backdrop:opacity-0"
        }`}
      >
        <div
          className={`max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[1.75rem] border border-[var(--s-line)] bg-[var(--s-card)] p-5 shadow-[0_30px_80px_-30px_rgba(11,18,20,0.55)] transition duration-300 ${EASE} motion-reduce:transition-none sm:p-6 ${
            visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-95 opacity-0"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/75">{trainers[0].batch || "Your class"}</p>
              <h2 id={titleId} className="mt-1 text-2xl font-semibold text-ink">
                {label}
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--s-soft)] text-ink transition hover:bg-[var(--s-icon)]"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <ul className="mt-5 space-y-4">
            {trainers.map((t, i) => (
              <li
                key={t.trainerId}
                style={{ transitionDelay: visible ? `${90 + i * 70}ms` : "0ms" }}
                className={`rounded-2xl bg-[var(--s-soft)] p-4 transition duration-300 ease-out motion-reduce:transition-none ${
                  visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                }`}
              >
                <div className="flex items-center gap-4">
                  {t.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private file served by /api/files
                    <img src={t.photo} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
                  ) : (
                    <span aria-hidden="true" className="s-profile-avatar grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-bold">
                      {initialsOf(t.name)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="wrap-anywhere text-lg font-semibold leading-snug text-ink">{t.name}</p>
                    <p className="text-sm text-ink/80">Trainer</p>
                  </div>
                </div>

                <a
                  href={`mailto:${t.email}`}
                  className="mt-4 flex min-w-0 items-center gap-3 rounded-xl bg-[var(--s-card)] px-3.5 py-3 text-sm text-ink transition hover:bg-[var(--s-icon)]"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--s-icon)]">
                    <MailIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-ink/75">Email</span>
                    <span className="block wrap-anywhere font-semibold">{t.email}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}
