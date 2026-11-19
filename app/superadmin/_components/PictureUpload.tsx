"use client";

import { useRef, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { imageUrl } from "@/lib/display-image-meta";
import { FILE_RULES, type FileRef } from "@/lib/submission-meta";

type SaveResult = { ok: true } | { ok: false; error: string };

// A picture slot for Super Admin / Admins: a course thumbnail ("wide") or a trainer profile picture ("round").
// Uploading sends the image to /api/files, then `onSave` attaches it (or detaches it, `null`) with a server action.
export default function PictureUpload({
  file,
  shape,
  label,
  fallback,
  onSave,
}: {
  file: FileRef | null;
  shape: "wide" | "round";
  label: string; // e.g. "TEST001 picture", "Priya Sharma's photo"
  fallback: ReactNode; // shown when there's no picture
  onSave: (fileId: string | null) => Promise<SaveResult>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const src = imageUrl(file);

  const upload = async (picked: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!picked) return;
    if (!/^image\/(png|jpeg)$/.test(picked.type)) return void toast.error("Use a PNG or JPG picture.");
    if (picked.size > FILE_RULES.maxBytes) return void toast.error("That picture is over 10 MB.");
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", picked);
      const res = await fetch("/api/files", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(data.error ?? "Upload failed. Try again.");
      const saved = await onSave((data as FileRef).id);
      if (!saved.ok) return void toast.error(saved.error);
      toast.success("Picture saved");
    } catch {
      toast.error("Upload failed. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove the ${label}?`)) return;
    setBusy(true);
    try {
      const saved = await onSave(null);
      if (!saved.ok) return void toast.error(saved.error);
      toast.success("Picture removed");
    } finally {
      setBusy(false);
    }
  };

  const picker = (
    <input ref={input} type="file" accept="image/png,image/jpeg" aria-label={`Upload ${label}`} className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
  );

  if (shape === "round") {
    return (
      <span className="relative shrink-0">
        {picker}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          title={src ? `Change ${label}` : `Add ${label}`}
          aria-label={src ? `Change ${label}` : `Add ${label}`}
          className="group relative grid size-12 place-items-center overflow-hidden rounded-2xl disabled:opacity-60"
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- private file served by /api/files
            <img src={src} alt="" className="size-full object-cover" />
          ) : (
            fallback
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/45 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
            {busy ? "…" : src ? "Change" : "Add"}
          </span>
        </button>
        {src && !busy && (
          <button
            type="button"
            onClick={remove}
            aria-label={`Remove ${label}`}
            className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-white text-[11px] font-bold text-ink shadow ring-1 ring-ink/10 hover:text-rose-600"
          >
            ×
          </button>
        )}
      </span>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/60">
      {picker}
      <div className="grid aspect-[16/7] place-items-center">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- private file served by /api/files
          <img src={src} alt="" className="size-full object-cover" />
        ) : (
          fallback
        )}
      </div>
      <div className="absolute bottom-2 right-2 flex gap-1.5">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-plum shadow-sm transition hover:bg-plum hover:text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : src ? "Change picture" : "Upload picture"}
        </button>
        {src && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            aria-label={`Remove ${label}`}
            className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-ink shadow-sm transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
