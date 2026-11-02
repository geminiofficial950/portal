"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { FILE_RULES, type FileRef } from "@/lib/submission-meta";

// Uploads one file to /api/files, then hands it to `onUploaded` (which attaches it with a server action)
export default function UploadButton({
  label,
  ariaLabel = label,
  onUploaded,
  className = "rounded-full bg-plum px-4 py-2 text-xs font-medium text-white transition hover:bg-plum-light",
}: {
  label: string;
  ariaLabel?: string;
  onUploaded: (file: FileRef) => Promise<void>;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.size > FILE_RULES.maxBytes) return void toast.error(`${file.name} is over 10 MB.`);
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/files", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(data.error ?? "Upload failed. Try again.");
      await onUploaded(data as FileRef);
    } catch {
      toast.error("Upload failed. Check your connection.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={FILE_RULES.accept}
        aria-label={ariaLabel}
        className="sr-only"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className={`${className} disabled:cursor-wait disabled:opacity-60`}>
        {busy ? "Uploading…" : label}
      </button>
    </>
  );
}
