"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { ArrowRightIcon, BackIcon, CloseIcon } from "../../_components/icons";
import type { FileRef } from "@/lib/submission-meta";

const isPdf = (f: FileRef) => /\.pdf$/i.test(f.name);
// Zoom steps, as a share of "fit to the screen" (1)
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const FIT = ZOOMS.indexOf(1);

// Opens a document over the page like a book: two pages side by side (one on a phone), turned with the arrows.
// PDFs are drawn with PDF.js; a picture is shown as it is. Zoom with − / + (or the + and - keys, or Ctrl + mouse wheel);
// when zoomed in, the pages scroll. Esc or the close button leaves.
export default function BookViewer({ file, title, onClose }: { file: FileRef; title: string; onClose: () => void }) {
  const src = `/api/files/${file.id}?inline=1`;
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1); // the page last turned to
  const [single, setSingle] = useState(false); // phone: one page at a time
  const [zoomAt, setZoomAt] = useState(FIT);
  const stage = useRef<HTMLDivElement>(null);
  const zoom = ZOOMS[zoomAt];
  const zoomIn = useCallback(() => setZoomAt((z) => Math.min(ZOOMS.length - 1, z + 1)), []);
  const zoomOut = useCallback(() => setZoomAt((z) => Math.max(0, z - 1)), []);
  const zoomFit = useCallback(() => setZoomAt(FIT), []);

  const perSpread = single ? 1 : 2;
  // two pages at a time always start on an odd page (1–2, 3–4, …)
  const first = single || page % 2 === 1 ? page : page - 1;
  const total = pdf?.numPages ?? 0;
  const last = Math.min(total, first + perSpread - 1);
  const canBack = first > 1;
  const canNext = last < total;
  const back = useCallback(() => setPage(Math.max(1, first - perSpread)), [first, perSpread]);
  const next = useCallback(() => setPage(first + perSpread <= total ? first + perSpread : first), [first, perSpread, total]);

  // Load the PDF once
  useEffect(() => {
    if (!isPdf(file)) return;
    let loading: { destroy: () => Promise<void> } | null = null;
    let gone = false;
    (async () => {
      try {
        const lib = await import("pdfjs-dist");
        lib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const task = lib.getDocument({ url: src });
        loading = task;
        const doc = await task.promise;
        if (!gone) setPdf(doc);
      } catch {
        if (!gone) setError(true);
      }
    })();
    return () => {
      gone = true;
      void loading?.destroy();
    };
  }, [file, src]);

  // One page at a time on narrow screens
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const check = () => setSingle(media.matches);
    check();
    media.addEventListener("change", check);
    return () => media.removeEventListener("change", check);
  }, []);

  // Keyboard: arrows turn pages, Esc closes; the page behind doesn't scroll
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
      else if (e.key === "+" || e.key === "=") zoomIn();
      else if (e.key === "-") zoomOut();
      else if (e.key === "0") zoomFit();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [next, back, onClose, zoomIn, zoomOut, zoomFit]);

  // Ctrl + mouse wheel (or a trackpad pinch) zooms the document, not the browser
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomIn, zoomOut]);

  // A new page starts at its top
  useEffect(() => {
    stage.current?.scrollTo({ top: 0, left: 0 });
  }, [first]);

  const pages = pdf ? Array.from({ length: last - first + 1 }, (_, i) => first + i) : [];

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[100] flex flex-col bg-[#14112b] text-white">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold">{title}</span>
          <span className="block text-sm">{pdf ? (first === last ? `Page ${first} of ${total}` : `Pages ${first}–${last} of ${total}`) : file.name}</span>
        </span>
        {(pdf || !isPdf(file)) && (
          <span role="group" aria-label="Zoom" className="flex items-center gap-1 rounded-xl bg-white/15 p-1">
            <button type="button" onClick={zoomOut} disabled={zoomAt === 0} aria-label="Zoom out" className="grid h-8 w-8 place-items-center rounded-lg text-xl font-semibold leading-none transition hover:bg-white/20 disabled:cursor-not-allowed">
              −
            </button>
            <span aria-live="polite" className="min-w-14 text-center text-sm font-semibold tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button type="button" onClick={zoomIn} disabled={zoomAt === ZOOMS.length - 1} aria-label="Zoom in" className="grid h-8 w-8 place-items-center rounded-lg text-xl font-semibold leading-none transition hover:bg-white/20 disabled:cursor-not-allowed">
              +
            </button>
            <button type="button" onClick={zoomFit} disabled={zoomAt === FIT} className="rounded-lg px-2.5 py-1.5 text-sm font-semibold transition hover:bg-white/20 disabled:cursor-not-allowed">
              Fit
            </button>
          </span>
        )}
        <a href={`/api/files/${file.id}`} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-lilac">
          Download
        </a>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 transition hover:bg-white/25">
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center gap-2 px-2 pb-4 sm:gap-4 sm:px-4">
        {pdf && (
          <button
            type="button"
            onClick={back}
            disabled={!canBack}
            aria-label="Previous pages"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15 transition hover:bg-white/30 disabled:invisible"
          >
            <BackIcon className="h-5 w-5" />
          </button>
        )}

        {/* scrolls when zoomed in; m-auto keeps the pages centred when they fit */}
        <div ref={stage} className="flex h-full min-w-0 flex-1 overflow-auto">
          {!isPdf(file) ? (
            // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route
            <img
              src={src}
              alt={title}
              style={zoom === 1 ? undefined : { height: `${zoom * 100}%`, maxWidth: "none", maxHeight: "none" }}
              className="m-auto max-h-full max-w-full shrink-0 rounded-lg bg-white object-contain shadow-2xl"
            />
          ) : error ? (
            <p className="m-auto rounded-xl bg-white px-6 py-4 text-base font-medium text-ink">This document couldn’t be opened. Use Download to open it on your device.</p>
          ) : !pdf ? (
            <p className="m-auto text-base font-medium">Opening the document…</p>
          ) : (
            // the open book: pages meet in the middle with a soft spine shadow
            <div key={first} className="animate-fade-up m-auto flex shrink-0 items-start">
              {pages.map((n, i) => (
                <PdfPage key={n} pdf={pdf} page={n} stage={stage} perSpread={pages.length} zoom={zoom} side={pages.length === 1 ? "single" : i === 0 ? "left" : "right"} />
              ))}
            </div>
          )}
        </div>

        {pdf && (
          <button
            type="button"
            onClick={next}
            disabled={!canNext}
            aria-label="Next pages"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15 transition hover:bg-white/30 disabled:invisible"
          >
            <ArrowRightIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

// One page drawn to fit its half of the open book (or the whole width for a single page)
function PdfPage({
  pdf,
  page,
  stage,
  perSpread,
  zoom,
  side,
}: {
  pdf: PDFDocumentProxy;
  page: number;
  stage: React.RefObject<HTMLDivElement | null>;
  perSpread: number;
  zoom: number; // 1 = the spread fits the screen
  side: "left" | "right" | "single";
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  // Follow the size of the viewer
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage]);

  useEffect(() => {
    if (!box.w || !box.h || !canvas.current) return;
    let task: RenderTask | null = null;
    let gone = false;
    (async () => {
      const p = await pdf.getPage(page);
      if (gone || !canvas.current) return;
      const base = p.getViewport({ scale: 1 });
      const scale = Math.min(box.w / perSpread / base.width, box.h / base.height) * zoom;
      const dpr = window.devicePixelRatio || 1;
      const view = p.getViewport({ scale: scale * dpr });
      const c = canvas.current;
      c.width = Math.floor(view.width);
      c.height = Math.floor(view.height);
      c.style.width = `${Math.floor(view.width / dpr)}px`;
      c.style.height = `${Math.floor(view.height / dpr)}px`;
      task = p.render({ canvas: c, viewport: view });
      await task.promise.catch(() => undefined);
    })();
    return () => {
      gone = true;
      task?.cancel();
    };
  }, [pdf, page, box, perSpread, zoom]);

  const round = side === "left" ? "rounded-l-md" : side === "right" ? "rounded-r-md" : "rounded-md";
  const spine =
    side === "left"
      ? "shadow-[inset_-18px_0_24px_-18px_rgba(0,0,0,0.35)]"
      : side === "right"
        ? "shadow-[inset_18px_0_24px_-18px_rgba(0,0,0,0.35)]"
        : "";
  return (
    <span className={`relative block bg-white shadow-2xl ${round}`}>
      <canvas ref={canvas} aria-label={`Page ${page}`} className="block" />
      {/* spine shading drawn over the page */}
      <span aria-hidden className={`pointer-events-none absolute inset-0 ${round} ${spine}`} />
    </span>
  );
}
