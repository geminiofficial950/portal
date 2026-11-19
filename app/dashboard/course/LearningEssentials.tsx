"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowRightIcon, CloseIcon } from "../_components/icons";
import StudentDocuments, { type PlacementGroup } from "./StudentDocuments";
import type { SignedDocDTO } from "@/lib/document-meta";

type Section = "course" | "placement";

const TILES: { id: Section; label: string; surface: string; icon: ReactNode }[] = [
  {
    id: "course",
    label: "Course documents",
    surface: "bg-[#f9dbe7] hover:bg-[#f5cddd]",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </svg>
    ),
  },
  {
    id: "placement",
    label: "Placement pack",
    surface: "bg-[#ead9f7] hover:bg-[#e0caf2]",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      </svg>
    ),
  },
];

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";
const CLOSE_MS = 220;

// "Learning essentials" beside the course cards: Course documents and Placement pack, each opening the existing
// documents view (download course documents; download, sign and upload placement forms) in a pop-up.
export default function LearningEssentials({ placement, initialSigned }: { placement: PlacementGroup[]; initialSigned: SignedDocDTO[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [visible, setVisible] = useState(false);
  const headingId = useId(); // one box per course: ids must not repeat

  const open = (s: Section) => {
    setSection(s);
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

  return (
    <section aria-labelledby={headingId} className="flex flex-col justify-between gap-3 rounded-[1.5rem] bg-[#171d24] p-4 text-white">
      <h2 id={headingId} className="text-lg font-bold">
        Learning essentials
      </h2>
      <ul className="space-y-2">
        {TILES.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => open(t.id)}
              aria-haspopup="dialog"
              aria-label={placement[0] ? `${t.label} for ${placement[0].name}` : t.label}
              className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-3.5 text-left text-[#172027] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${t.surface}`}
            >
              {t.icon}
              <span className="min-w-0 flex-1 text-sm font-bold">{t.label}</span>
              <ArrowRightIcon className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-label={TILES.find((t) => t.id === section)?.label ?? "Learning essentials"}
        onCancel={(e) => {
          e.preventDefault(); // Esc: close with the animation
          close();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close(); // click on the backdrop
        }}
        className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-visible bg-transparent p-0 text-ink backdrop:bg-[#0b1214]/45 backdrop:backdrop-blur-sm backdrop:transition-opacity backdrop:duration-300 motion-reduce:backdrop:transition-none ${
          visible ? "backdrop:opacity-100" : "backdrop:opacity-0"
        }`}
      >
        <div
          className={`relative max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[1.75rem] border border-[var(--s-line)] bg-[var(--s-card)] p-5 shadow-[0_30px_80px_-30px_rgba(11,18,20,0.55)] transition duration-300 ${EASE} motion-reduce:transition-none sm:p-6 ${
            visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-95 opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-[var(--s-soft)] text-ink transition hover:bg-[var(--s-icon)]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
          {/* stays mounted so a signed form uploaded here is still shown after closing and reopening */}
          <div className="pr-12">
            <StudentDocuments placement={placement} initialSigned={initialSigned} only={section ?? "course"} />
          </div>
        </div>
      </dialog>
    </section>
  );
}
