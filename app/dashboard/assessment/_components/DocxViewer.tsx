"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "../../_components/icons";
import type { FileRef } from "@/lib/submission-meta";

// Opens a Word document (.docx) over the page, laid out as pages, without downloading it. The file is fetched through
// the same access-checked route as Download and drawn in the browser by docx-preview. Esc or Close leaves.
export default function DocxViewer({ file, title, onClose }: { file: FileRef; title: string; onClose: () => void }) {
  const body = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let gone = false;
    (async () => {
      try {
        const [res, { renderAsync }] = await Promise.all([fetch(`/api/files/${file.id}`), import("docx-preview")]);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (gone || !body.current) return;
        await renderAsync(blob, body.current, undefined, { className: "docx", inWrapper: true, ignoreLastRenderedPageBreak: true, breakPages: true });
        if (!gone) setState("ready");
      } catch {
        if (!gone) setState("error");
      }
    })();
    return () => {
      gone = true;
    };
  }, [file.id]);

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

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[60] flex flex-col bg-ink">
      <div className="flex items-center justify-between gap-3 bg-ink px-4 py-3 text-white sm:px-6">
        <p className="min-w-0 truncate text-sm font-semibold">{title}</p>
        <div className="flex shrink-0 items-center gap-2">
          <a href={`/api/files/${file.id}`} className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-ink transition hover:bg-lilac">
            Download
          </a>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-white transition hover:bg-white/10">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="relative flex-1 overflow-auto">
        {state === "loading" && <p className="absolute inset-x-0 top-10 text-center text-sm font-medium text-white">Opening {file.name}…</p>}
        {state === "error" && (
          <div className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-6 text-center text-sm text-ink">
            This document couldn’t be shown here. Use <span className="font-semibold">Download</span> to open it on your device.
          </div>
        )}
        {/* docx-preview draws the pages here; the wrapper is scaled down to fit narrow screens */}
        <div ref={body} className={`docx-host ${state === "error" ? "hidden" : ""}`} />
      </div>
    </div>,
    document.getElementById("portal-root") ?? document.body,
  );
}
