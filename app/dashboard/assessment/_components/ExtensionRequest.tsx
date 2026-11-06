"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { requestExtensionAction } from "../../../actions/deadlines";
import { ClockIcon, LockIcon } from "../../_components/icons";
import LocalTime from "./LocalTime";
import { DEADLINE_LIMITS, type ExtensionRequestDTO } from "@/lib/deadline-meta";

// A module locked by its deadline: its name and deadline stay, its content and submitting are locked, and the student
// can ask for an extension (reason + proposed date). The module stays locked while the request is pending.
export default function ExtensionRequest({
  courseCode,
  unitCode,
  moduleId,
  due,
  requests,
}: {
  courseCode: string;
  unitCode: string;
  moduleId: string;
  due: string;
  requests: ExtensionRequestDTO[];
}) {
  const [list, setList] = useState(requests);
  const [form, setForm] = useState({ reason: "", proposedDue: "" });
  const [busy, start] = useTransition();
  const pending = list.find((r) => r.status === "Pending");
  const lastDeclined = list.find((r) => r.status === "Declined");

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return; // no duplicate on a double click
    start(async () => {
      const res = await requestExtensionAction(courseCode, unitCode, moduleId, {
        reason: form.reason,
        proposedDue: form.proposedDue ? new Date(form.proposedDue).toISOString() : "",
      });
      if (!res.ok) return void toast.error(res.error);
      setList((l) => [res.request, ...l]);
      toast.success("Request sent — your trainer will decide");
    });
  };

  return (
    <section className="space-y-4 rounded-[1.5rem] border border-rose-200 bg-rose-50 p-5 sm:p-6">
      <p className="flex items-center gap-3 text-lg font-semibold text-rose-900">
        <LockIcon className="h-6 w-6 shrink-0" />
        The due date has passed — this module is locked
      </p>
      <p className="flex items-center gap-2 text-base text-ink">
        <ClockIcon className="h-4 w-4 text-plum" />
        Was due <LocalTime iso={due} />. Your saved work is kept.
      </p>

      {pending ? (
        <div className="rounded-xl bg-white px-4 py-3 text-base text-ink">
          <p className="font-semibold">Extension requested — waiting for a decision</p>
          <p className="mt-1 text-sm">
            You asked for <LocalTime iso={pending.proposedDue} />: “{pending.reason}”
          </p>
        </div>
      ) : (
        <>
          {lastDeclined && (
            <div className="rounded-xl bg-white px-4 py-3 text-sm text-ink">
              <p className="font-semibold text-rose-900">Your last request was declined</p>
              <p className="mt-1">Reason: {lastDeclined.decisionReason}</p>
            </div>
          )}
          <form onSubmit={send} className="space-y-3 rounded-xl bg-white p-4">
            <p className="text-base font-semibold text-ink">Request an extension</p>
            <textarea
              required
              rows={3}
              maxLength={DEADLINE_LIMITS.reason}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Why do you need more time?"
              aria-label="Reason for the extension"
              className="w-full resize-y rounded-xl bg-white px-4 py-3 text-base text-ink outline-none ring-1 ring-ink/15 placeholder:text-ink/60 focus:ring-plum/40"
            />
            <label className="flex flex-wrap items-center gap-3 text-sm font-medium text-ink">
              New date you’re asking for
              <input
                required
                type="datetime-local"
                value={form.proposedDue}
                onChange={(e) => setForm({ ...form, proposedDue: e.target.value })}
                className="rounded-xl bg-white px-3 py-2 text-sm text-ink outline-none ring-1 ring-ink/15 focus:ring-plum/40"
              />
            </label>
            <button type="submit" disabled={busy} className="rounded-xl bg-plum px-5 py-3 text-sm font-semibold text-white transition hover:bg-plum-light disabled:opacity-60">
              {busy ? "Sending…" : "Request extension"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
