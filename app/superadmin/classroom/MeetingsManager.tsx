"use client";

import { useState, useTransition } from "react";
import { CheckIcon } from "../../dashboard/_components/icons";
import toast from "react-hot-toast";
import { cancelMeetingAction, scheduleMeetingAction, updateMeetingAction } from "./meeting-actions";
import { lengthLabel, MEETING_LENGTHS, meetingState, meetingWhen, zonedParts, type MeetingDTO, type MeetingInput } from "@/lib/meetings-meta";

type Course = { code: string; name: string };
type Student = { studentId: string; name: string; courseCodes: string[] };

const card = "rounded-[1.5rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] sm:p-6";
const field = "w-full rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/15 placeholder:text-ink/60 focus:ring-plum/40";
const label = "text-sm font-medium text-ink";

const blank = (courseCode: string): MeetingInput => ({ courseCode, studentId: "", title: "", notes: "", date: "", time: "", minutes: 30, url: "" });

// Scheduled meetings for staff (Super Admin, Admin, trainer): pick a course (or one student of it) and a date and time in
// Sydney time; Google Calendar makes the Meet link (or one is pasted while Google isn't connected).
// Students see it under Classroom until it ends.
export default function MeetingsManager({
  courses,
  students,
  initial,
  today,
  now,
  googleReady,
  trainerView = false,
}: {
  courses: Course[];
  students: Student[];
  initial: MeetingDTO[];
  today: string; // YYYY-MM-DD in Sydney
  now: number;
  googleReady: boolean; // Google Calendar connected: links are made automatically
  trainerView?: boolean; // a trainer: only their own batch students are listed, and a meeting is for one of them
}) {
  const [meetings, setMeetings] = useState(initial);
  const [form, setForm] = useState<MeetingInput>(() => blank(courses[0]?.code ?? ""));
  const [editing, setEditing] = useState<string | null>(null);
  const [ownLink, setOwnLink] = useState(!googleReady); // paste a link instead of letting Google make one
  const [saving, startSaving] = useTransition();
  const set = (patch: Partial<MeetingInput>) => setForm((f) => ({ ...f, ...patch }));
  const inCourse = students.filter((s) => s.courseCodes.includes(form.courseCode));
  const courseName = (code: string) => courses.find((c) => c.code === code)?.name ?? code;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trainerView && !form.studentId) return void toast.error("Choose the student this session is for.");
    startSaving(async () => {
      const res = editing ? await updateMeetingAction(editing, form) : await scheduleMeetingAction(form);
      if (!res.ok) return void toast.error(res.error);
      setMeetings((all) =>
        [...all.filter((m) => m.id !== res.meeting.id), res.meeting].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      );
      toast.success(editing ? "Meeting updated" : "Meeting scheduled — students can see it in Classroom");
      setEditing(null);
      setOwnLink(!googleReady);
      setForm(blank(form.courseCode));
    });
  };

  const edit = (m: MeetingDTO) => {
    setEditing(m.id);
    // Google's link stays with the meeting, so the form only carries a link that was pasted
    setOwnLink(!m.auto || !googleReady);
    setForm({ courseCode: m.courseCode, studentId: m.studentId ?? "", title: m.title, notes: m.notes, ...zonedParts(m.startsAt), minutes: m.minutes, url: m.auto ? "" : m.url });
    document.getElementById("meeting-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancel = (m: MeetingDTO) => {
    if (!window.confirm(`Cancel “${m.title}”? Students won’t see it any more.`)) return;
    startSaving(async () => {
      const res = await cancelMeetingAction(m.id);
      if (!res.ok) return void toast.error(res.error);
      setMeetings((all) => all.filter((x) => x.id !== m.id));
      if (editing === m.id) {
        setEditing(null);
        setOwnLink(!googleReady);
        setForm(blank(form.courseCode));
      }
      toast.success("Meeting cancelled");
    });
  };

  return (
    <section className="space-y-4">
      <form id="meeting-form" onSubmit={submit} className={`${card} scroll-mt-6 space-y-4`}>
        <div>
          <h2 className="text-lg font-semibold text-ink">{editing ? "Change the meeting" : "Schedule a meeting"}</h2>
          <p className="mt-0.5 text-sm text-ink">Times are Sydney time. Students see the meeting under Classroom until it ends.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1.5">
            <span className={label}>Course</span>
            <select value={form.courseCode} onChange={(e) => set({ courseCode: e.target.value, studentId: "" })} className={field}>
              {courses.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} – {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className={label}>Who is it for?</span>
            <select value={form.studentId} onChange={(e) => set({ studentId: e.target.value })} className={field}>
              {trainerView ? (
                <option value="" disabled>
                  {inCourse.length ? "Choose one of your students" : "No students in your batches for this course"}
                </option>
              ) : (
                <option value="">Everyone in this course</option>
              )}
              {inCourse.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  Only {s.name} ({s.studentId})
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className={label}>Meeting name</span>
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Trainer support session" maxLength={120} className={field} />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className={label}>Date</span>
            <input type="date" value={form.date} min={today} onChange={(e) => set({ date: e.target.value })} className={field} />
          </label>
          <label className="block space-y-1.5">
            <span className={label}>Start time (Sydney)</span>
            <input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} className={field} />
          </label>
          <label className="block space-y-1.5">
            <span className={label}>How long</span>
            <select value={form.minutes} onChange={(e) => set({ minutes: Number(e.target.value) })} className={field}>
              {MEETING_LENGTHS.map((n) => (
                <option key={n} value={n}>
                  {lengthLabel(n)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!googleReady && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
            Google Meet isn’t connected yet, so links can’t be made automatically. Paste a Meet link below for now — once Google is connected, the
            link is made for you.
          </p>
        )}
        {ownLink ? (
          <label className="block space-y-1.5">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className={label}>Google Meet link</span>
              {googleReady && (
                <button type="button" onClick={() => {
                    setOwnLink(false);
                    set({ url: "" });
                  }} className="text-sm font-medium text-plum underline">
                  Let Google make the link
                </button>
              )}
            </span>
            <input value={form.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://meet.google.com/abc-defg-hij" inputMode="url" className={field} />
          </label>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
              <CheckIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium text-emerald-900">
              {editing ? "The Google Meet link stays the same — the time and name change in Google Calendar too." : "The Google Meet link is made automatically when you schedule."}
            </span>
            <button type="button" onClick={() => setOwnLink(true)} className="text-sm font-medium text-plum underline">
              Use my own link
            </button>
          </div>
        )}

        <label className="block space-y-1.5">
          <span className={label}>Notes for students (optional)</span>
          <textarea
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            rows={2}
            maxLength={1000}
            placeholder="e.g. Bring your Learner Guide and any questions about the Theory Task."
            className={field}
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving || !courses.length}
            className="rounded-xl bg-plum px-6 py-3 text-sm font-semibold text-white transition hover:bg-plum-light disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Schedule meeting"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setOwnLink(!googleReady);
                setForm(blank(form.courseCode));
              }}
              className="rounded-xl border border-ink/15 px-6 py-3 text-sm font-semibold text-ink transition hover:bg-lilac"
            >
              Don’t change
            </button>
          )}
        </div>
      </form>

      <div className={card}>
        <h2 className="text-lg font-semibold text-ink">Upcoming meetings</h2>
        {meetings.length ? (
          <ul className="mt-3 divide-y divide-ink/10">
            {meetings.map((m) => {
              const when = meetingWhen(m);
              const live = meetingState(m, now) === "live";
              return (
                <li key={m.id} className={`flex flex-wrap items-center gap-4 py-4 ${editing === m.id ? "rounded-xl bg-lilac px-3" : ""}`}>
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-plum text-center leading-tight text-white">
                    <span>
                      <span className="block text-lg font-bold">{when.tileDay}</span>
                      <span className="block text-[11px] font-semibold uppercase">{when.tileMonth}</span>
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{m.title}</span>
                      {live && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Live now</span>}
                    </span>
                    <span className="block text-sm text-ink">
                      {when.day} · {when.time} (Sydney) · {lengthLabel(m.minutes)}
                    </span>
                    <span className="block text-sm text-ink">
                      {m.studentName ? `Only ${m.studentName} · ` : "Everyone in "}
                      {m.studentName ? m.courseCode : `${m.courseCode} – ${courseName(m.courseCode)}`}
                    </span>
                    <span className="block text-xs text-ink">
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-plum underline">
                        {m.url.replace("https://", "")}
                      </a>{" "}
                      · {m.auto ? "made by Google · " : ""}set by {m.createdBy}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <button type="button" onClick={() => edit(m)} disabled={saving} className="rounded-full border border-ink/15 px-4 py-2 text-xs font-medium text-ink transition hover:bg-lilac disabled:opacity-60">
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => cancel(m)}
                      disabled={saving}
                      className="rounded-full border border-ink/15 px-4 py-2 text-xs font-medium text-ink transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                    >
                      Cancel meeting
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm font-medium text-ink">No meetings scheduled. Use the form above to set one.</p>
        )}
      </div>
    </section>
  );
}
