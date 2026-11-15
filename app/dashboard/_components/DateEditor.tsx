"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { toLocalInput } from "@/lib/format";

// Super Admin: a "Change date" link that opens a date + time picker for one recorded date (submitted, marked,
// unit status). `save` is the server action; the server checks Super Admin and keeps the dates in order.
export default function DateEditor({
  value,
  label,
  save,
  onSaved,
}: {
  value: string; // ISO
  label: string; // what the date is, e.g. "Submitted date"
  save: (iso: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(toLocalInput(value));
  const [saving, startSaving] = useTransition();

  const submit = () =>
    startSaving(async () => {
      const res = await save(new Date(input).toISOString());
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${label} changed`);
      setOpen(false);
      onSaved?.();
      router.refresh();
    });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setInput(toLocalInput(value));
          setOpen(true);
        }}
        className="ml-2 font-medium text-plum underline-offset-2 hover:underline"
      >
        Change date
      </button>
    );
  }
  return (
    <span className="mt-2 flex flex-wrap items-center gap-2">
      <input
        type="datetime-local"
        value={input}
        max={toLocalInput(new Date().toISOString())}
        onChange={(e) => setInput(e.target.value)}
        aria-label={label}
        className="rounded-lg bg-lilac px-3 py-1.5 text-sm text-ink outline-none ring-1 ring-ink/10 focus:ring-plum/40"
      />
      <button
        type="button"
        onClick={submit}
        disabled={saving || !input}
        className="rounded-full bg-plum px-3 py-1.5 text-xs font-medium text-white transition hover:bg-plum-light disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="rounded-full px-2 py-1.5 text-xs text-ink hover:bg-lilac">
        Cancel
      </button>
    </span>
  );
}
