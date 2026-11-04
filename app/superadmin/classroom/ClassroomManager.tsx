"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { VideoIcon } from "../../dashboard/_components/icons";
import { addClassLinkAction, removeClassLinkAction, updateClassLinkAction } from "./actions";
import type { ClassLinkDTO } from "@/lib/classroom-meta";

type Course = { code: string; name: string };

const card = "rounded-[1.5rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] sm:p-6";
const field = "w-full rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/15 placeholder:text-ink/60 focus:ring-plum/40";

// Standing class links for staff (Super Admin, Admin, trainer): paste a Google Meet link for a course;
// that course's students see it under Classroom and join with one click.
export default function ClassroomManager({ courses, initial }: { courses: Course[]; initial: ClassLinkDTO[] }) {
  const [links, setLinks] = useState(initial);
  const [form, setForm] = useState({ courseCode: courses[0]?.code ?? "", title: "", url: "" });
  const [saving, startSaving] = useTransition();

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    startSaving(async () => {
      const res = await addClassLinkAction(form.courseCode, { title: form.title, url: form.url });
      if (!res.ok) return void toast.error(res.error);
      setLinks((l) => [...l, res.link]);
      setForm((f) => ({ ...f, title: "", url: "" }));
      toast.success("Class link saved — students can join it now");
    });
  };

  const byCourse = courses.map((c) => ({ ...c, links: links.filter((l) => l.courseCode === c.code) })).filter((c) => c.links.length);

  return (
    <div className="space-y-8">
      <form onSubmit={add} className={`${card} space-y-4`}>
        <div>
          <h2 className="text-lg font-semibold text-ink">Add a class link</h2>
          <p className="mt-0.5 text-sm text-ink">A link that stays (e.g. the weekly class room). Students of that course join it any time from Classroom.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Course</span>
            <select value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} className={field}>
              {courses.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} – {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Class name</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Weekly live class – Monday 10 AM"
              maxLength={120}
              className={field}
            />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Google Meet link</span>
          <input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://meet.google.com/abc-defg-hij"
            inputMode="url"
            className={field}
          />
        </label>
        <button
          type="submit"
          disabled={saving || !courses.length}
          className="rounded-xl bg-plum px-6 py-3 text-sm font-semibold text-white transition hover:bg-plum-light disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save link"}
        </button>
      </form>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">Class links</h2>
        {byCourse.length ? (
          byCourse.map((c) => (
            <div key={c.code} className={card}>
              <p className="text-xs font-semibold tracking-wide text-plum">{c.code}</p>
              <h3 className="font-semibold text-ink">{c.name}</h3>
              <ul className="mt-3 divide-y divide-ink/10">
                {c.links.map((l) => (
                  <LinkRow
                    key={l.id}
                    link={l}
                    onSaved={(next) => setLinks((all) => all.map((x) => (x.id === next.id ? next : x)))}
                    onRemoved={() => setLinks((all) => all.filter((x) => x.id !== l.id))}
                  />
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className={`${card} text-center text-sm font-medium text-ink`}>No class links yet. Add one above.</p>
        )}
      </section>
    </div>
  );
}

function LinkRow({ link, onSaved, onRemoved }: { link: ClassLinkDTO; onSaved: (l: ClassLinkDTO) => void; onRemoved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: link.title, url: link.url });
  const [busy, startBusy] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startBusy(async () => {
      const res = await updateClassLinkAction(link.id, form);
      if (!res.ok) return void toast.error(res.error);
      onSaved(res.link);
      setEditing(false);
      toast.success("Class link updated");
    });
  };

  const remove = () => {
    if (!window.confirm(`Remove “${link.title}”? Students won’t see it any more.`)) return;
    startBusy(async () => {
      const res = await removeClassLinkAction(link.id);
      if (!res.ok) return void toast.error(res.error);
      onRemoved();
      toast.success("Class link removed");
    });
  };

  const btn = "rounded-full border border-ink/15 px-4 py-2 text-xs font-medium text-ink transition disabled:opacity-60";

  if (editing) {
    return (
      <li className="py-3">
        <form onSubmit={save} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <input aria-label="Class name" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} className={field} />
          <input aria-label="Google Meet link" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} inputMode="url" className={field} />
          <span className="flex items-center gap-2">
            <button type="submit" disabled={busy} className="rounded-full bg-plum px-4 py-2 text-xs font-semibold text-white hover:bg-plum-light disabled:opacity-60">
              Save
            </button>
            <button type="button" onClick={() => (setEditing(false), setForm({ title: link.title, url: link.url }))} className={`${btn} hover:bg-lilac`}>
              Cancel
            </button>
          </span>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lilac text-plum">
        <VideoIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-ink">{link.title}</span>
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-plum underline">
          {link.url.replace("https://", "")}
        </a>
        <span className="block text-xs text-ink">Saved by {link.addedBy}</span>
      </span>
      <button type="button" onClick={() => setEditing(true)} disabled={busy} className={`${btn} hover:bg-lilac`}>
        Edit
      </button>
      <button type="button" onClick={remove} disabled={busy} className={`${btn} hover:bg-rose-50 hover:text-rose-700`}>
        Remove
      </button>
    </li>
  );
}
