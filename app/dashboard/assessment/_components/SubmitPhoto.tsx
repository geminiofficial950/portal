"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FileRef } from "@/lib/submission-meta";

// Takes one photo of the student at the moment they submit. The photo is uploaded like any
// other file and attached to the submission; only Super Admin can view it later.
export default function SubmitPhoto({
  title,
  onCancel,
  onConfirm,
}: {
  title: string;
  onCancel: () => void;
  onConfirm: (photo: FileRef) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  // This dialog only ever renders in the browser (opened on click)
  const [error, setError] = useState<string | null>(() =>
    navigator.mediaDevices ? null : "Your browser doesn’t support the camera. Try Chrome, Edge or Safari.",
  );
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<{ url: string; blob: Blob } | null>(null);
  const [uploading, setUploading] = useState(false);

  // Camera runs only while this dialog is open
  useEffect(() => {
    if (!navigator.mediaDevices) return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setError("We couldn’t use your camera. Allow camera access in your browser, then try again."));
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => () => {
    if (shot) URL.revokeObjectURL(shot.url);
  }, [shot]);

  const take = () => {
    const v = video.current;
    if (!v || v.readyState < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror so the photo matches what the student sees
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => blob && setShot({ url: URL.createObjectURL(blob), blob }), "image/jpeg", 0.85);
  };

  const confirm = async () => {
    if (!shot) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", new File([shot.blob], "submission-photo.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/files", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      stream.current?.getTracks().forEach((t) => t.stop());
      onConfirm(data as FileRef);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
      setUploading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/60 p-4 font-dm text-ink backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-labelledby="photo-title" className="w-full max-w-md overflow-hidden rounded-[1.75rem] bg-white shadow-2xl">
        <div className="bg-plum px-6 py-5 text-white">
          <h2 id="photo-title" className="text-lg font-medium">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-white/75">A photo of you is taken when you submit. Only the college admin can see it.</p>
        </div>

        <div className="p-6">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink">
            {shot ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not a remote image
              <img src={shot.url} alt="Your photo" className="h-full w-full object-cover" />
            ) : (
              <video
                // Re-attach the stream when the preview comes back after "Retake"
                ref={(el) => {
                  video.current = el;
                  if (el && stream.current && el.srcObject !== stream.current) el.srcObject = stream.current;
                }}
                autoPlay
                playsInline
                muted
                onLoadedData={() => setReady(true)}
                className="h-full w-full -scale-x-100 object-cover"
              />
            )}
            {!shot && !ready && !error && <p className="absolute inset-0 grid place-items-center text-sm text-white/70">Starting camera…</p>}
          </div>

          {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

          <div className="mt-5 flex flex-wrap gap-3">
            {!shot ? (
              <button
                onClick={take}
                disabled={!ready}
                className="flex-1 rounded-full bg-plum px-6 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:opacity-50"
              >
                Take photo
              </button>
            ) : (
              <>
                <button
                  onClick={confirm}
                  disabled={uploading}
                  className="flex-1 rounded-full bg-plum px-6 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:cursor-wait disabled:opacity-60"
                >
                  {uploading ? "Submitting…" : "Use photo & submit"}
                </button>
                <button
                  onClick={() => setShot(null)}
                  disabled={uploading}
                  className="rounded-full bg-lilac px-5 py-3 text-sm font-medium text-plum transition hover:bg-plum/10"
                >
                  Retake
                </button>
              </>
            )}
            <button onClick={onCancel} disabled={uploading} className="rounded-full px-5 py-3 text-sm font-medium text-ink/60 hover:bg-lilac">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.getElementById("portal-root") ?? document.body,
  );
}
