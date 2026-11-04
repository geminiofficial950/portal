"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { FILE_RULES, formatBytes, type FileRef } from "@/lib/submission-meta";
import FileActions from "./FileActions";
import { FileIcon, PlusIcon, TrashIcon } from "./icons";

// Attached files, each with View (opens here like a book) and Download. Pass `onChange` to allow uploading and removing.
export default function FileList({
  files,
  onChange,
  emptyText = "No files attached.",
  uploadLabel = "Upload document",
  inputLabel = uploadLabel,
}: {
  files: FileRef[];
  onChange?: (files: FileRef[]) => void;
  emptyText?: string;
  uploadLabel?: string;
  inputLabel?: string; // accessible name when several upload buttons share the same text
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (!onChange) return;
    if (file.size > FILE_RULES.maxBytes) return void toast.error(`${file.name} is over 10 MB.`);
    setUploading(file.name);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/files", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error(data.error ?? "Upload failed. Try again.");
      onChange([...files, data as FileRef]);
      toast.success(`${data.name} uploaded`);
    } catch {
      toast.error("Upload failed. Check your connection.");
    } finally {
      setUploading(null);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {files.length === 0 && !onChange && <p className="text-xs text-ink">{emptyText}</p>}
      {files.map((f) => (
        <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-lilac/70 px-4 py-2.5">
          <FileIcon className="h-4 w-4 shrink-0 text-plum" />
          <span className="min-w-0 flex-1 truncate text-sm text-ink" title={f.name}>
            {f.name}
          </span>
          <span className="shrink-0 text-[11px] text-ink">{formatBytes(f.size)}</span>
          <FileActions file={f} size="sm" />
          {onChange && (
            <button
              type="button"
              onClick={() => onChange(files.filter((x) => x.id !== f.id))}
              aria-label={`Remove ${f.name}`}
              className="shrink-0 rounded-full p-1.5 text-ink transition hover:bg-rose-50 hover:text-rose-600"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {onChange && files.length < FILE_RULES.maxFiles && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!!uploading}
            onClick={() => input.current?.click()}
            className="inline-flex items-center gap-2 rounded-full bg-lilac px-4 py-2.5 text-xs font-medium text-plum transition hover:bg-plum/10 disabled:cursor-wait disabled:opacity-60"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {uploading ? `Uploading ${uploading}…` : uploadLabel}
          </button>
          <span className="text-[11px] text-ink">{FILE_RULES.label}</span>
          <input
            ref={input}
            type="file"
            accept={FILE_RULES.accept}
            hidden
            aria-label={inputLabel}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </div>
      )}
    </div>
  );
}
