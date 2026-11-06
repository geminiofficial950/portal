"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { FileRef } from "@/lib/submission-meta";

export type Signature = { file: FileRef; method: "drawn" | "uploaded" };

const tabBtn = (active: boolean) =>
  `rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-plum text-white" : "bg-lilac text-ink hover:bg-plum/10"}`;

async function uploadFile(file: File): Promise<FileRef | null> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/files", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast.error(data.error ?? "Upload failed. Try again.");
    return null;
  }
  return data as FileRef;
}

// The student signs the declaration: draw with the mouse (or a finger), or upload a picture of their signature.
// The signature is saved as an image and printed on the declaration certificate.
export default function SignaturePad({ value, onChange }: { value: Signature | null; onChange: (s: Signature | null) => void }) {
  const [mode, setMode] = useState<"draw" | "upload">("draw");
  const [busy, setBusy] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // A white, sharp canvas (scaled for high-DPI screens) with a dark pen
  useEffect(() => {
    const c = canvas.current;
    if (!c || value || mode !== "draw") return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.offsetWidth, c.offsetHeight);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1d1b33";
  }, [value, mode]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
    setDrawn(true);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const up = () => {
    drawing.current = false;
  };

  const clear = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    setDrawn(false);
  };

  const saveDrawing = async () => {
    const c = canvas.current;
    if (!c || !drawn) return void toast.error("Sign in the box first.");
    setBusy(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/png"));
      if (!blob) return void toast.error("Couldn’t save the signature. Try again.");
      const file = await uploadFile(new File([blob], "signature.png", { type: "image/png" }));
      if (file) onChange({ file, method: "drawn" });
    } finally {
      setBusy(false);
    }
  };

  const saveUpload = async (f: File | undefined) => {
    if (fileInput.current) fileInput.current.value = "";
    if (!f) return;
    if (!/\.(png|jpe?g)$/i.test(f.name)) return void toast.error("Upload a PNG or JPG picture of your signature.");
    setBusy(true);
    try {
      const file = await uploadFile(f);
      if (file) onChange({ file, method: "uploaded" });
    } finally {
      setBusy(false);
    }
  };

  if (value) {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route */}
        <img src={`/api/files/${value.file.id}?inline=1`} alt="Your signature" className="h-20 w-56 rounded-lg bg-white object-contain ring-1 ring-ink/10" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-emerald-900">Signed ✓</p>
          <p className="text-sm text-ink">{value.method === "drawn" ? "Drawn with the mouse" : "Uploaded picture"}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="rounded-xl border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-lilac">
          Sign again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="How to sign">
        <button type="button" role="tab" aria-selected={mode === "draw"} onClick={() => setMode("draw")} className={tabBtn(mode === "draw")}>
          Draw with mouse
        </button>
        <button type="button" role="tab" aria-selected={mode === "upload"} onClick={() => setMode("upload")} className={tabBtn(mode === "upload")}>
          Upload signature
        </button>
      </div>

      {mode === "draw" ? (
        <div className="space-y-2">
          <canvas
            ref={canvas}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={up}
            aria-label="Signature box — sign here with your mouse or finger"
            className="h-40 w-full max-w-xl cursor-crosshair touch-none rounded-xl border-2 border-dashed border-ink/30 bg-white"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveDrawing}
              disabled={busy || !drawn}
              className="rounded-xl bg-plum px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-plum-light disabled:opacity-50"
            >
              {busy ? "Saving…" : "Use this signature"}
            </button>
            <button type="button" onClick={clear} disabled={busy} className="rounded-xl border border-ink/15 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-lilac">
              Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="rounded-xl bg-plum px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-plum-light disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Choose picture of signature"}
          </button>
          <span className="text-sm text-ink">PNG or JPG, up to 10 MB</span>
          <input ref={fileInput} type="file" accept=".png,.jpg,.jpeg" hidden aria-label="Upload your signature" onChange={(e) => saveUpload(e.target.files?.[0])} />
        </div>
      )}
    </div>
  );
}
