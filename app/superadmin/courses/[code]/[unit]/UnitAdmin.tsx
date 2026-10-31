"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { BackIcon } from "../../../../dashboard/_components/icons";
import FileList from "../../../../dashboard/_components/FileList";
import ResourceList from "../../../../dashboard/_components/ResourceList";
import RichTextEditor from "../../../../dashboard/_components/RichTextEditor";
import AssessmentEditor from "./AssessmentEditor";
import { addResourceAction, removeResourceAction, saveOverviewAction } from "./content-actions";
import type { UnitAssessment } from "@/lib/assessment-meta";
import type { Unit } from "@/lib/courses";
import type { FileRef } from "@/lib/submission-meta";
import type { Resource, UnitContent } from "@/lib/unit-meta";

const SECTIONS = [
  { key: "overview", label: "1. Main unit", hint: "What the unit is about" },
  { key: "resources", label: "2. Resources", hint: "Things to read first" },
  { key: "assessment", label: "3. Assessment", hint: "Quiz, theory, role play, workplace" },
] as const;
type Section = (typeof SECTIONS)[number]["key"];

const card = "rounded-[1.5rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] sm:p-6";

export default function UnitAdmin({
  course,
  unit,
  assessment,
  content,
}: {
  course: { code: string; name: string };
  unit: Unit;
  assessment: UnitAssessment;
  content: UnitContent;
}) {
  const [section, setSection] = useState<Section>("overview");
  const [assessmentDirty, setAssessmentDirty] = useState(false);
  const onDirtyChange = useCallback((d: boolean) => setAssessmentDirty(d), []);

  const go = (next: Section) => {
    if (section === "assessment" && assessmentDirty && !window.confirm("Your assessment changes aren’t saved. Leave this tab?")) return;
    setSection(next);
  };

  return (
    <div className="animate-fade-up space-y-6">
      <Link
        href="/superadmin/courses"
        onClick={(e) => {
          if (assessmentDirty && !window.confirm("You have unsaved changes. Leave anyway?")) e.preventDefault();
        }}
        className="inline-flex items-center gap-2 text-sm text-ink/55 transition hover:text-plum"
      >
        <BackIcon className="h-4 w-4" />
        All courses
      </Link>

      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-plum">
          {course.code} · {course.name}
        </p>
        <h1 className="mt-1 text-2xl font-medium text-ink sm:text-[1.65rem]">
          {unit.code} – {unit.title}
        </h1>
      </div>

      <div role="tablist" aria-label="Unit sections" className="grid gap-2 sm:grid-cols-3">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={section === s.key}
            onClick={() => go(s.key)}
            className={`rounded-2xl px-4 py-3 text-left transition ${
              section === s.key ? "bg-ink text-white shadow-md" : "bg-lilac text-ink hover:bg-plum/10"
            }`}
          >
            <span className="block text-sm font-medium">{s.label}</span>
            <span className={`mt-0.5 block text-[11px] ${section === s.key ? "text-white/70" : "text-ink/45"}`}>{s.hint}</span>
          </button>
        ))}
      </div>

      {section === "overview" && <OverviewEditor courseCode={course.code} unitCode={unit.code} initial={content.overview} />}
      {section === "resources" && <ResourcesManager courseCode={course.code} unitCode={unit.code} initial={content.resources} />}
      {/* Kept mounted while switching so unsaved assessment edits aren't lost */}
      <div hidden={section !== "assessment"}>
        <AssessmentEditor course={course} unit={unit} initialAssessment={assessment} onDirtyChange={onDirtyChange} />
      </div>
    </div>
  );
}

function OverviewEditor({ courseCode, unitCode, initial }: { courseCode: string; unitCode: string; initial: string }) {
  const [html, setHtml] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, startSaving] = useTransition();

  const save = () =>
    startSaving(async () => {
      const res = await saveOverviewAction(courseCode, unitCode, html);
      if (!res.ok) return void toast.error(res.error);
      setHtml(res.overview);
      setSaved(res.overview);
      toast.success("Overview saved");
    });

  return (
    <section className={`${card} space-y-4`}>
      <div>
        <h2 className="text-lg font-medium text-ink">Main unit</h2>
        <p className="mt-0.5 text-sm text-ink/55">What students learn in this unit, how long it takes, and anything they should know first.</p>
      </div>
      <RichTextEditor
        label="Unit overview"
        value={html}
        onChange={setHtml}
        placeholder="e.g. In this unit you will learn how to…"
        minHeight="14rem"
      />
      <button
        onClick={save}
        disabled={saving || html === saved}
        className="rounded-full bg-plum px-6 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "Saving…" : html === saved ? "Saved" : "Save overview"}
      </button>
    </section>
  );
}

const KINDS = [
  { key: "file", label: "Upload document" },
  { key: "link", label: "Web link" },
  { key: "note", label: "Write notes" },
] as const;

function ResourcesManager({ courseCode, unitCode, initial }: { courseCode: string; unitCode: string; initial: Resource[] }) {
  const [list, setList] = useState(initial);
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("file");
  const [form, setForm] = useState({ title: "", description: "", url: "", body: "" });
  const [files, setFiles] = useState<FileRef[]>([]);
  const [saving, startSaving] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    startSaving(async () => {
      const input =
        kind === "file"
          ? { kind, title: form.title, description: form.description, fileId: files[0]?.id ?? "" }
          : kind === "link"
            ? { kind, title: form.title, description: form.description, url: form.url }
            : { kind, title: form.title, description: form.description, body: form.body };
      const res = await addResourceAction(courseCode, unitCode, input);
      if (!res.ok) return void toast.error(res.error);
      setList((l) => [...l, res.resource]);
      setForm({ title: "", description: "", url: "", body: "" });
      setFiles([]);
      toast.success("Resource added");
    });
  };

  const remove = async (r: Resource) => {
    if (!window.confirm(`Remove “${r.title}”? Students won’t see it any more.`)) return;
    setBusyId(r.id);
    try {
      const res = await removeResourceAction(courseCode, unitCode, r.id);
      if (!res.ok) return void toast.error(res.error);
      setList((l) => l.filter((x) => x.id !== r.id));
      toast.success("Resource removed");
    } finally {
      setBusyId(null);
    }
  };

  const field = "w-full rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/10 placeholder:text-ink/35 focus:ring-plum/40";

  return (
    <section className="space-y-4">
      <form onSubmit={add} className={`${card} space-y-4`}>
        <div>
          <h2 className="text-lg font-medium text-ink">Add a resource</h2>
          <p className="mt-0.5 text-sm text-ink/55">Reading material students see before they start the assessment.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              className={`rounded-full px-4 py-2 text-xs font-medium transition ${kind === k.key ? "bg-plum text-white" : "bg-lilac text-ink/70 hover:bg-plum/10"}`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <input
          required
          value={form.title}
          maxLength={200}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Title — e.g. Learner guide, chapter 2"
          aria-label="Resource title"
          className={field}
        />
        <textarea
          rows={2}
          value={form.description}
          maxLength={1000}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Short description (optional)"
          aria-label="Resource description"
          className={`${field} resize-y`}
        />
        {kind === "file" && <FileList files={files} onChange={(f) => setFiles(f.slice(-1))} />}
        {kind === "link" && (
          <input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://…"
            aria-label="Resource link"
            className={field}
          />
        )}
        {kind === "note" && (
          <RichTextEditor
            label="Resource notes"
            value={form.body}
            onChange={(body) => setForm((f) => ({ ...f, body }))}
            placeholder="Write the reading notes here…"
          />
        )}
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-plum px-6 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? "Adding…" : "Add resource"}
        </button>
      </form>

      <ResourceList resources={list} onRemove={remove} busyId={busyId} />
    </section>
  );
}
