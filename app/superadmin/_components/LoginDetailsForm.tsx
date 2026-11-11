"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";

// Super Admin only: change a person's login email and ID. Shows what changes before saving; the person signs in
// again with the new details (their password stays the same).
export default function LoginDetailsForm({
  who,
  idLabel,
  current,
  save,
  onSaved,
}: {
  who: string;
  idLabel: "Student ID" | "Trainer ID";
  current: { id: string; email: string };
  save: (next: { id: string; email: string }) => Promise<{ ok: true; moved: number } | { ok: false; error: string }>;
  onSaved: (next: { id: string; email: string }) => void;
}) {
  const [email, setEmail] = useState(current.email);
  const [id, setId] = useState(current.id);
  const [busy, start] = useTransition();
  const next = { id: id.trim().toUpperCase(), email: email.trim().toLowerCase() };
  const changed = next.id !== current.id || next.email !== current.email;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!changed) return;
    const lines = [next.id !== current.id && `${idLabel}: ${current.id} → ${next.id}`, next.email !== current.email && `Email: ${current.email} → ${next.email}`].filter(Boolean).join("\n");
    if (!window.confirm(`Change ${who}’s login?\n\n${lines}\n\nAll their records move to the new details. They sign in again with the new ${next.id !== current.id ? "ID or email" : "email or ID"}; their password stays the same.`)) return;
    start(async () => {
      const res = await save(next);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${who}’s login updated${res.moved ? ` — ${res.moved} record(s) moved to ${next.id}` : ""}`);
      onSaved(next);
    });
  };

  const field = "w-full rounded-xl bg-white px-3.5 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/15 focus:ring-2 focus:ring-plum/40";
  return (
    <form onSubmit={submit} className="space-y-3" aria-label={`Login details for ${who}`}>
      <p className="text-sm font-semibold text-ink">Login details (Super Admin only)</p>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-ink">Email</span>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" className={field} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-ink">{idLabel}</span>
        <input required value={id} maxLength={20} onChange={(e) => setId(e.target.value.toUpperCase())} autoComplete="off" className={`${field} font-mono`} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={!changed || busy} className="rounded-xl bg-plum px-4 py-2 text-sm font-semibold text-white transition hover:bg-plum-light disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Saving…" : "Save login details"}
        </button>
        {changed && (
          <button type="button" onClick={() => (setEmail(current.email), setId(current.id))} className="rounded-xl px-3 py-2 text-sm font-semibold text-ink hover:bg-lilac">
            Undo
          </button>
        )}
      </div>
      <p className="text-xs text-ink">They sign in with their email or ID. Changing either signs them out; the password stays the same.</p>
    </form>
  );
}
