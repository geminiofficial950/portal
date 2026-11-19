"use client";

import { useActionState } from "react";
import { sendStudentPortalUpdate } from "./notify-action";

export default function StudentPortalUpdate({ studentId }: { studentId: string }) {
  const [message, action, pending] = useActionState(sendStudentPortalUpdate.bind(null, studentId), "");

  return (
    <details className="rounded-2xl border border-ink/10 bg-page p-4">
      <summary className="cursor-pointer font-semibold text-ink">Send portal notification</summary>
      <form action={action} className="mt-3 space-y-3">
        <label className="block text-sm font-medium text-ink">
          Message
          <textarea name="message" required maxLength={300} rows={2} className="mt-1 block w-full rounded-xl border border-ink/15 bg-page p-2 text-ink" />
        </label>
        <button type="submit" disabled={pending} className="rounded-full bg-plum px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Sending..." : "Send in portal only"}
        </button>
        <p role="status" className="text-sm text-ink">{message}</p>
      </form>
    </details>
  );
}
