"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { addSupportingFilesAction, clearSupportingFilesAction, removeResourceAction } from "./content-actions";
import { FILE_RULES, formatBytes, type FileRef } from "@/lib/submission-meta";
import { SUPPORTING_MAX, type Resource } from "@/lib/unit-meta";
import FileActions from "../../../../dashboard/_components/FileActions";

type FileResource = Extract<Resource, { kind: "file" }>;

const allowed = FILE_RULES.accept.split(",");
const okType = (name: string) => allowed.includes(`.${name.split(".").pop()?.toLowerCase()}`);
// Path inside the folder that was picked ("Week 1/Notes.pdf"), or just the name for loose files
const pathOf = (f: File) => f.webkitRelativePath.split("/").slice(1).join("/") || f.name;

// The Supporting Document row: Super Admin uploads a whole folder (or a few files) and students download them
export default function SupportingFolder({ courseCode, unitCode, initial }: { courseCode: string; unitCode: string; initial: FileResource[] }) {
  const [files, setFiles] = useState(initial);
  const [progress, setProgress] = useState<string | null>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const busy = progress !== null;

  // React has no prop for folder picking
  useEffect(() => folderInput.current?.setAttribute("webkitdirectory", ""), []);

  const upload = async (list: FileList | null) => {
    const picked = Array.from(list ?? []).filter((f) => !f.name.startsWith("."));
    if (folderInput.current) folderInput.current.value = "";
    if (filesInput.current) filesInput.current.value = "";
    const usable = picked.filter((f) => okType(f.name) && f.size > 0 && f.size <= FILE_RULES.maxBytes);
    const skipped = picked.length - usable.length;
    if (!usable.length) return void toast.error(picked.length ? "None of those files can be uploaded (Word, PowerPoint, PDF, JPG or PNG up to 10 MB)." : "That folder is empty.");
    const room = SUPPORTING_MAX - files.length;
    if (usable.length > room) return void toast.error(`The folder holds up to ${SUPPORTING_MAX} files — there’s room for ${room} more.`);

    const done: { fileId: string; path: string }[] = [];
    try {
      for (const [i, f] of usable.entries()) {
        setProgress(`Uploading ${i + 1} of ${usable.length}…`);
        const body = new FormData();
        body.append("file", f);
        const res = await fetch("/api/files", { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(`${f.name}: ${data.error ?? "upload failed"}`);
          continue;
        }
        done.push({ fileId: (data as FileRef).id, path: pathOf(f) });
      }
      if (!done.length) return;
      setProgress("Saving…");
      const res = await addSupportingFilesAction(courseCode, unitCode, done);
      if (!res.ok) return void toast.error(res.error);
      setFiles((old) => [...old, ...(res.resources as FileResource[])]);
      toast.success(`${done.length} file${done.length === 1 ? "" : "s"} added${skipped ? ` · ${skipped} skipped (not a supported file)` : ""}`);
    } catch {
      toast.error("Upload failed. Check your connection.");
    } finally {
      setProgress(null);
    }
  };

  const remove = async (r: FileResource) => {
    if (!window.confirm(`Remove “${r.title}”? Students won’t see it any more.`)) return;
    const res = await removeResourceAction(courseCode, unitCode, r.id);
    if (!res.ok) return void toast.error(res.error);
    setFiles((old) => old.filter((x) => x.id !== r.id));
    toast.success("File removed");
  };

  const clear = async () => {
    if (!window.confirm(`Remove all ${files.length} Supporting Document files? Students won’t see them any more.`)) return;
    const res = await clearSupportingFilesAction(courseCode, unitCode);
    if (!res.ok) return void toast.error(res.error);
    setFiles([]);
    toast.success("Supporting Document folder emptied");
  };

  const sorted = [...files].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
  const btn = "rounded-full px-4 py-2 text-xs font-medium transition disabled:cursor-wait disabled:opacity-60";

  return (
    <li className="space-y-3 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-base font-medium text-ink">Supporting Document</span>
          <span className={`block text-sm ${files.length ? "text-ink" : "text-amber-800"}`}>
            {busy ? progress : files.length ? `Folder · ${files.length} file${files.length === 1 ? "" : "s"} for students to download` : "No folder uploaded yet"}
          </span>
        </span>
        <input ref={folderInput} type="file" multiple aria-label="Upload Supporting Document folder" className="sr-only" onChange={(e) => upload(e.target.files)} />
        <input ref={filesInput} type="file" multiple accept={FILE_RULES.accept} aria-label="Add Supporting Document files" className="sr-only" onChange={(e) => upload(e.target.files)} />
        <button type="button" disabled={busy} onClick={() => folderInput.current?.click()} className={`${btn} bg-plum text-white hover:bg-plum-light`}>
          {busy ? "Uploading…" : "Upload folder"}
        </button>
        <button type="button" disabled={busy} onClick={() => filesInput.current?.click()} className={`${btn} border border-ink/15 text-ink hover:bg-lilac`}>
          Add files
        </button>
        {files.length > 0 && (
          <button type="button" disabled={busy} onClick={clear} className={`${btn} border border-ink/15 text-ink hover:bg-rose-50 hover:text-rose-700`}>
            Remove all
          </button>
        )}
      </div>

      {sorted.length > 0 && (
        <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10">
          {sorted.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{r.title}</span>
              <span className="shrink-0 text-xs text-ink">{formatBytes(r.file.size)}</span>
              <FileActions file={r.file} title={r.title} size="sm" />
              <button type="button" onClick={() => remove(r)} className="shrink-0 rounded-full px-3 py-1 text-xs font-medium text-ink hover:bg-rose-50 hover:text-rose-700">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
