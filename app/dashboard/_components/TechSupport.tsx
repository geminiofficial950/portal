"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import toast from "react-hot-toast";
import { raiseTechSupportAction } from "../tickets/actions";
import { CloseIcon, HeadsetIcon, PlusIcon } from "./icons";
import { TICKET_ATTACHMENTS_MAX } from "@/lib/ticket-meta";
import { FILE_RULES, type FileRef } from "@/lib/submission-meta";

let shotKey = 0;
const toShot = (file: File): Shot => ({ key: `shot-${++shotKey}`, file, preview: URL.createObjectURL(file) });

// A screenshot waiting in the browser. Nothing is uploaded or saved until the student selects Raise ticket.
type Shot = { key: string; file: File; preview: string };

/** Opens the form already filled in — used by the problem reporter (automatic screenshot of a problem). */
export type TechSupportRequest = { id: number; subject: string; details: string; files: File[] };

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";
const CLOSE_MS = 220;
const field =
  "w-full rounded-xl border border-[var(--s-line)] bg-[var(--s-soft)] px-4 text-base text-ink outline-none transition placeholder:text-ink/45 focus:border-[var(--s-dark)] focus:ring-4 focus:ring-[var(--s-dark)]/10";

// "Tech support" in the student's sidebar card: opens a short form that raises a ticket.
// The ticket goes to Admin (Support → Tech support) and shows in the student's own Student support page.
// `request` opens it pre-filled (the problem reporter's screenshot and details); `showButton={false}` hides the pill.
export default function TechSupport({
  onNavigate,
  showButton = true,
  request = null,
}: {
  onNavigate?: () => void;
  showButton?: boolean;
  request?: TechSupportRequest | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [visible, setVisible] = useState(false);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const titleId = useId();

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

  // a pre-filled report (from the problem reporter) opens the form with its text and screenshot
  const lastRequest = useRef<number | null>(null);
  useEffect(() => {
    if (!request || lastRequest.current === request.id) return;
    lastRequest.current = request.id;
    setSubject(request.subject);
    setDetails(request.details);
    setShots((old) => {
      old.forEach((s) => URL.revokeObjectURL(s.preview));
      return request.files.slice(0, TICKET_ATTACHMENTS_MAX).map(toShot);
    });
    dialogRef.current?.showModal();
    requestAnimationFrame(() => setVisible(true));
  }, [request]);

  // Picked screenshots stay in the browser; they're uploaded only when the ticket is raised
  const addShots = (files: FileList | null) => {
    const room = TICKET_ATTACHMENTS_MAX - shots.length;
    const picked = [...(files ?? [])];
    if (fileInput.current) fileInput.current.value = "";
    if (picked.length > room) toast.error(`You can add up to ${TICKET_ATTACHMENTS_MAX} screenshots.`);
    for (const file of picked.slice(0, Math.max(room, 0))) {
      if (!/^image\/(png|jpeg)$/.test(file.type)) {
        toast.error(`${file.name}: use a PNG or JPG screenshot.`);
        continue;
      }
      if (file.size > FILE_RULES.maxBytes) {
        toast.error(`${file.name} is over 10 MB.`);
        continue;
      }
      setShots((list) => [...list, toShot(file)]);
    }
  };
  const removeShot = (key: string) =>
    setShots((list) => {
      const gone = list.find((s) => s.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return list.filter((s) => s.key !== key);
    });

  // Raise ticket: upload the screenshots now (/api/files), then raise the ticket with them
  const submit = (e: FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const fileIds: string[] = [];
      for (const s of shots) {
        try {
          const body = new FormData();
          body.append("file", s.file);
          const res = await fetch("/api/files", { method: "POST", body });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return void toast.error(data.error ?? "A screenshot didn’t upload. Try again.");
          fileIds.push((data as FileRef).id);
        } catch {
          return void toast.error("A screenshot didn’t upload. Check your connection.");
        }
      }
      const res = await raiseTechSupportAction({ subject, details, fileIds });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Ticket ${res.ticket.ticketId} raised. We’ll reply in Student support.`);
      shots.forEach((s) => URL.revokeObjectURL(s.preview));
      setSubject("");
      setDetails("");
      setShots([]);
      close();
    });
  };

  return (
    <>
      {showButton && (
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        // a slim black pill, same height as the round dark-mode / logout buttons beside it; icon + white text on one line
        className="group inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-black px-2.5 text-xs font-bold text-white shadow-[0_6px_14px_-8px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition hover:-translate-y-px hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--s-logo-gold)] motion-reduce:hover:translate-y-0"
      >
        <HeadsetIcon className="h-4 w-4 shrink-0" />
        <span className="text-white">Tech support</span>
      </button>
      )}

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
        <form
          onSubmit={submit}
          className={`max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[1.75rem] border border-[var(--s-line)] bg-[var(--s-card)] p-5 shadow-[0_30px_80px_-30px_rgba(11,18,20,0.55)] transition duration-300 ${EASE} motion-reduce:transition-none sm:p-6 ${
            visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-95 opacity-0"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--s-dark)] text-white">
                <HeadsetIcon className="h-6 w-6" />
              </span>
              <div>
                <h2 id={titleId} className="text-xl font-semibold text-ink">
                  Tech support
                </h2>
                <p className="text-sm text-ink/75">Problem with the portal? Tell us and we’ll help.</p>
              </div>
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

          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">Short title</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={140}
              required
              placeholder="e.g. Can’t upload my assessment"
              className={`${field} h-12`}
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">What’s going wrong?</span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={4000}
              required
              rows={5}
              placeholder="What were you doing, and what happened? Add any error message you saw."
              className={`${field} resize-none py-3`}
            />
          </label>

          <div className="mt-4">
            <p className="mb-1.5 text-sm font-semibold text-ink">
              Screenshots <span className="font-normal text-ink/60">(optional, up to {TICKET_ATTACHMENTS_MAX})</span>
            </p>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg"
              multiple
              aria-label="Add screenshots"
              className="sr-only"
              onChange={(e) => addShots(e.target.files)}
            />
            <ul className="flex flex-wrap gap-2.5">
              {shots.map((s) => (
                <li key={s.key} className="relative size-20 overflow-hidden rounded-xl border border-[var(--s-line)] bg-[var(--s-soft)]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the student's own file */}
                  <img src={s.preview} alt={s.file.name} className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeShot(s.key)}
                    aria-label={`Remove ${s.file.name}`}
                    className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              {shots.length < TICKET_ATTACHMENTS_MAX && (
                <li>
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="grid size-20 place-items-center rounded-xl border-2 border-dashed border-[var(--s-line)] text-ink/70 transition hover:border-[var(--s-dark)] hover:text-ink"
                  >
                    <span className="flex flex-col items-center gap-1 text-xs font-semibold">
                      <PlusIcon className="h-5 w-5" />
                      Add
                    </span>
                  </button>
                </li>
              )}
            </ul>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/dashboard/tickets"
              onClick={() => {
                close();
                onNavigate?.();
              }}
              className="text-sm font-semibold text-ink underline decoration-[var(--s-line)] decoration-2 underline-offset-4 hover:decoration-current"
            >
              See my requests
            </Link>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-[var(--s-dark)] px-6 py-3 text-base font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {pending ? "Sending…" : "Raise ticket"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
