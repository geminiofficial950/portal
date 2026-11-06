"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { respondToFeedbackAction } from "../actions";
import LocalTime from "./LocalTime";
import SignaturePad, { type Signature } from "./SignaturePad";
import type { SubmissionDTO } from "@/lib/submission-meta";

// After feedback is published, the student either accepts it (with a signature) or asks for a review (with a comment,
// sent to the trainer now assigned to the unit). Neither changes the module result.
export default function FeedbackResponse({ sub, onSaved }: { sub: SubmissionDTO; onSaved: (s: SubmissionDTO) => void }) {
  const [mode, setMode] = useState<"accept" | "review" | null>(null);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [comment, setComment] = useState("");
  const [busy, start] = useTransition();
  const r = sub.response;

  if (r) {
    return (
      <div className="mt-3 space-y-2 rounded-xl bg-white/80 px-4 py-3 text-sm text-ink">
        <p className="font-semibold">
          {r.state === "accepted" ? "You accepted this feedback" : "You asked for a review"} · <LocalTime iso={r.at} />
        </p>
        {r.comment && <p className="whitespace-pre-wrap">“{r.comment}”</p>}
        {r.replies.map((x, i) => (
          <p key={i} className="rounded-lg bg-lilac px-3 py-2">
            <span className="font-semibold">{x.by}:</span> {x.text}
          </p>
        ))}
        {r.state === "review" && !r.replies.length && <p>Waiting for your trainer’s reply.</p>}
      </div>
    );
  }

  const send = () =>
    start(async () => {
      const res = await respondToFeedbackAction(sub.submissionId, mode === "accept" ? { state: "accepted", signatureId: signature?.file.id } : { state: "review", comment });
      if (!res.ok) return void toast.error(res.error);
      onSaved(res.submission);
      toast.success(mode === "accept" ? "Feedback accepted" : "Review requested — your trainer will reply");
    });

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-white/80 p-4 text-ink">
      <p className="text-sm font-semibold">Please respond to this feedback</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setMode("accept")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${mode === "accept" ? "bg-plum text-white" : "bg-lilac text-ink"}`}>
          Accept feedback
        </button>
        <button onClick={() => setMode("review")} className={`rounded-xl px-4 py-2 text-sm font-semibold ${mode === "review" ? "bg-plum text-white" : "bg-lilac text-ink"}`}>
          Request review
        </button>
      </div>
      {mode === "accept" && <SignaturePad value={signature} onChange={setSignature} />}
      {mode === "review" && (
        <textarea
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What would you like your trainer to look at again?"
          aria-label="Your review comment"
          className="w-full resize-y rounded-xl bg-white px-4 py-3 text-base text-ink outline-none ring-1 ring-ink/15 placeholder:text-ink/60 focus:ring-plum/40"
        />
      )}
      {mode && (
        <button
          onClick={send}
          disabled={busy || (mode === "accept" ? !signature : !comment.trim())}
          className="rounded-xl bg-plum px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-plum-light disabled:opacity-50"
        >
          {busy ? "Sending…" : mode === "accept" ? "Accept and sign" : "Send review request"}
        </button>
      )}
    </div>
  );
}
