"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ArrowRightIcon, BoxIcon, ClockIcon, PlusIcon, TrashIcon } from "../../dashboard/_components/icons";
import { createCourseAction, deleteCourseAction, setPlacementHoursAction, updateCourseAction } from "./actions";
import { COURSE_LIMITS, COURSE_UNITS_MAX, UNIT_TITLE_MAX } from "@/lib/course-meta";
import { PLACEMENT_HOURS_MAX } from "@/lib/course-status";
import type { CourseDTO, Unit } from "@/lib/courses";
import type { AssessmentSummary } from "@/lib/assessment-meta";
import type { UnitContentSummary } from "@/lib/unit-content";
import UnitsModal from "./UnitsModal";

const tones = ["bg-[#ffe8d6]", "bg-lilac", "bg-[#e8f3ff]", "bg-emerald-50"];

export default function CoursesClient({
  initialCourses,
  summaries,
  content,
  canDelete,
}: {
  canDelete: boolean; // Super Admin only
  initialCourses: CourseDTO[];
  summaries: Record<string, AssessmentSummary>;
  content: Record<string, UnitContentSummary>;
}) {
  const [courses, setCourses] = useState(initialCourses);
  const [selected, setSelected] = useState(initialCourses[0]?.code ?? "");
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const emptyForm = { code: "", name: "", category: "", duration: "", description: "" };
  const [form, setForm] = useState(emptyForm);
  // the units chosen with the course: each its own code and name (more can be added later under View units)
  const [unitRows, setUnitRows] = useState([{ code: "", title: "" }]);
  const [saving, startSaving] = useTransition();

  const addCourse = (e: React.FormEvent) => {
    e.preventDefault();
    startSaving(async () => {
      const res = await createCourseAction({ ...form, units: unitRows });
      if (!res.ok) return void toast.error(res.error);
      setCourses((list) => [...list, res.course].sort((a, b) => a.code.localeCompare(b.code)));
      setSelected(res.course.code);
      setForm(emptyForm);
      setUnitRows([{ code: "", title: "" }]);
      setAdding(false);
      toast.success(`${res.course.code} added with ${res.course.units.length} unit(s) — next, its batches`);
    });
  };

  const removeCourse = (c: CourseDTO) => {
    if (!window.confirm(`Delete ${c.code} – ${c.name}? Its units and their content go with it.`)) return;
    startSaving(async () => {
      const res = await deleteCourseAction(c.code);
      if (!res.ok) return void toast.error(res.error);
      setCourses((list) => list.filter((x) => x.code !== c.code));
      if (selected === c.code) setSelected("");
      toast.success(`${c.code} deleted`);
    });
  };

  const field = "rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/10 placeholder:text-ink/60 focus:ring-plum/30";

  const openCourse = courses.find((c) => c.code === openCode) ?? null;

  const setUnits = (code: string, update: (units: Unit[]) => Unit[]) =>
    setCourses((list) => list.map((c) => (c.code === code ? { ...c, units: update(c.units) } : c)));

  return (
    <div className="animate-fade-up space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-ink sm:text-[1.65rem]">Certificate courses</h1>
          <p className="mt-1 text-sm text-ink">
            First add the course, then its units and batches. Pick a course to see its units and set up each unit’s assessment.
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-plum px-5 py-3 text-sm font-medium text-white transition hover:bg-plum-light"
        >
          <PlusIcon className="h-4 w-4" />
          Add course
        </button>
      </div>

      {adding && (
        <form onSubmit={addCourse} className="grid gap-3 rounded-[1.75rem] bg-lilac/80 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          <input
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="Course code (any format), e.g. CHC33021"
            aria-label="Course code"
            maxLength={30}
            className={`${field} font-mono placeholder:font-sans`}
          />
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Course name, e.g. Certificate III in Individual Support"
            aria-label="Course name"
            maxLength={COURSE_LIMITS.name}
            className={`${field} lg:col-span-2`}
          />
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Category (e.g. Certificate III)"
            aria-label="Category"
            maxLength={COURSE_LIMITS.category}
            className={field}
          />
          <input
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: e.target.value })}
            placeholder="Duration (e.g. 12 months)"
            aria-label="Duration"
            maxLength={COURSE_LIMITS.duration}
            className={field}
          />
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Course description — what students will learn (shown on their course page)"
            aria-label="Course description"
            maxLength={COURSE_LIMITS.description}
            className={`${field} resize-y sm:col-span-2 lg:col-span-3`}
          />
          <fieldset className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-ink/10 sm:col-span-2 lg:col-span-3">
            <legend className="px-1 text-sm font-semibold text-ink">Units of this course</legend>
            <p className="px-1 text-xs text-ink">Each unit has its own code (any format) and name. You can add more later under View units.</p>
            {unitRows.map((u, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span className="w-6 text-right text-sm font-semibold text-ink">{i + 1}.</span>
                <input
                  value={u.code}
                  maxLength={30}
                  onChange={(e) => setUnitRows((r) => r.map((x, j) => (j === i ? { ...x, code: e.target.value.toUpperCase() } : x)))}
                  placeholder="Unit code"
                  aria-label={`Unit ${i + 1} code`}
                  className={`${field} w-40 font-mono placeholder:font-sans`}
                />
                <input
                  value={u.title}
                  maxLength={UNIT_TITLE_MAX}
                  onChange={(e) => setUnitRows((r) => r.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                  placeholder="Unit name"
                  aria-label={`Unit ${i + 1} name`}
                  className={`${field} min-w-48 flex-1`}
                />
                <button
                  type="button"
                  onClick={() => setUnitRows((r) => (r.length > 1 ? r.filter((_, j) => j !== i) : [{ code: "", title: "" }]))}
                  aria-label={`Remove unit ${i + 1}`}
                  className="rounded-full p-2 text-ink transition hover:bg-rose-50 hover:text-rose-700"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
            {unitRows.length < COURSE_UNITS_MAX && (
              <button type="button" onClick={() => setUnitRows((r) => [...r, { code: "", title: "" }])} className="inline-flex items-center gap-2 rounded-full bg-lilac px-4 py-2 text-xs font-semibold text-plum hover:bg-plum/10">
                <PlusIcon className="h-3.5 w-3.5" />
                Add unit
              </button>
            )}
          </fieldset>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-plum px-6 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? "Saving…" : "Create course"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-full px-5 py-3 text-sm font-medium text-ink hover:bg-white/60">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3 rounded-[1.75rem] bg-lilac/80 p-5 sm:flex-row sm:items-center sm:p-6">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-white px-4 ring-1 ring-ink/5 focus-within:ring-plum/30">
          <BoxIcon className="h-5 w-5 shrink-0 text-plum/60" />
          <span className="sr-only">Certificate course</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="min-w-0 flex-1 truncate bg-transparent py-3.5 text-sm text-ink outline-none"
          >
            {courses.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => setOpenCode(selected)}
          disabled={!selected}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-plum px-6 py-3.5 text-sm font-medium text-white transition hover:bg-plum-light disabled:opacity-40"
        >
          View units
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>

      <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {courses.map((c, i) => (
          <li key={c.code} className={`flex flex-col rounded-[1.75rem] p-5 ${tones[i % tones.length]}`}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-plum">
              {c.code}
            </p>
            <h2 className="mt-1 text-base font-medium leading-snug text-ink">{c.name}</h2>
            <p className="mt-1 text-xs text-ink">{c.category}</p>
            <CourseDetails course={c} onSaved={(d) => setCourses((list) => list.map((x) => (x.code === c.code ? { ...x, ...d } : x)))} />
            <PlacementHours
              course={c}
              onSaved={(hours) => setCourses((list) => list.map((x) => (x.code === c.code ? { ...x, placementHours: hours } : x)))}
            />

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink/5 pt-4">
              <div className="flex items-center gap-4 text-xs text-ink">
                <span className="flex items-center gap-1.5">
                  <BoxIcon className="h-4 w-4" />
                  {c.units.length} units
                </span>
                <span className="flex items-center gap-1.5">
                  <ClockIcon className="h-4 w-4" />
                  {c.duration}
                </span>
              </div>
              <Link
                href={`/superadmin/courses/${encodeURIComponent(c.code)}/placement`}
                className="ml-auto rounded-full bg-white px-4 py-2 text-[11px] font-medium text-plum transition hover:bg-plum hover:text-white"
              >
                Placement
              </Link>
              <button
                onClick={() => {
                  setSelected(c.code);
                  setOpenCode(c.code);
                }}
                className="rounded-full bg-white px-4 py-2 text-[11px] font-medium text-plum transition hover:bg-plum hover:text-white"
              >
                View
              </button>
              {canDelete && (
                <button
                  onClick={() => removeCourse(c)}
                  disabled={saving}
                  aria-label={`Delete ${c.code}`}
                  className="rounded-full p-2 text-ink transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {openCourse && (
        <UnitsModal
          summaries={summaries}
          content={content}
          course={openCourse}
          onClose={() => setOpenCode(null)}
          onUnitsChange={(update) => setUnits(openCourse.code, update)}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}

// Work placement hours for a course (shown to its students on the Course page)
function PlacementHours({ course, onSaved }: { course: CourseDTO; onSaved: (hours: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(course.placementHours?.toString() ?? "");
  const [saving, startSaving] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const hours = value.trim() === "" ? null : Number(value);
    startSaving(async () => {
      const res = await setPlacementHoursAction(course.code, hours);
      if (!res.ok) return void toast.error(res.error);
      onSaved(res.hours);
      setEditing(false);
      toast.success(`${course.code}: work placement ${res.hours === null ? "cleared" : `set to ${res.hours} hours`}`);
    });
  };

  if (!editing) {
    return (
      <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink">
        <span className="font-medium text-ink">Work placement:</span>
        {course.placementHours === null ? "not set" : `${course.placementHours} hours`}
        <button onClick={() => setEditing(true)} className="font-medium text-plum hover:underline">
          {course.placementHours === null ? "Set hours" : "Change"}
        </button>
      </p>
    );
  }

  return (
    <form onSubmit={save} className="mt-3 flex flex-wrap items-center gap-2">
      <input
        type="number"
        min={0}
        max={PLACEMENT_HOURS_MAX}
        step={1}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Hours"
        aria-label={`Work placement hours for ${course.code}`}
        className="w-24 rounded-lg bg-white px-3 py-1.5 text-sm text-ink outline-none ring-1 ring-ink/10 focus:ring-plum/40"
      />
      <span className="text-xs text-ink">hours</span>
      <button type="submit" disabled={saving} className="rounded-full bg-plum px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-60">
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="rounded-full px-2 py-1.5 text-[11px] text-ink hover:bg-white/60">
        Cancel
      </button>
    </form>
  );
}

// The course description (students see it on their course page), and the other details, edited in place
function CourseDetails({ course, onSaved }: { course: CourseDTO; onSaved: (d: Omit<CourseDTO, "code" | "units" | "placementHours" | "placementText">) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: course.name, category: course.category, duration: course.duration, description: course.description });
  const [saving, startSaving] = useTransition();
  const field = "w-full rounded-lg bg-white px-3 py-2 text-sm text-ink outline-none ring-1 ring-ink/15 focus:ring-plum/40";

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startSaving(async () => {
      const res = await updateCourseAction(course.code, form);
      if (!res.ok) return void toast.error(res.error);
      onSaved(res.details);
      setEditing(false);
      toast.success(`${course.code} updated`);
    });
  };

  if (!editing) {
    return (
      <div className="mt-2 flex-1">
        <p className="line-clamp-3 whitespace-pre-wrap text-sm text-ink">{course.description || <span className="text-amber-800">No description yet.</span>}</p>
        <button onClick={() => setEditing(true)} className="mt-1 text-xs font-semibold text-plum hover:underline">
          Edit details
        </button>
      </div>
    );
  }
  return (
    <form onSubmit={save} className="mt-2 flex-1 space-y-2">
      <input required value={form.name} maxLength={COURSE_LIMITS.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Course name" className={field} />
      <div className="grid grid-cols-2 gap-2">
        <input value={form.category} maxLength={COURSE_LIMITS.category} onChange={(e) => setForm({ ...form, category: e.target.value })} aria-label="Category" className={field} />
        <input value={form.duration} maxLength={COURSE_LIMITS.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} aria-label="Duration" className={field} />
      </div>
      <textarea rows={4} value={form.description} maxLength={COURSE_LIMITS.description} onChange={(e) => setForm({ ...form, description: e.target.value })} aria-label="Course description" placeholder="Course description" className={`${field} resize-y`} />
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded-full bg-plum px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink hover:bg-white/60">
          Cancel
        </button>
      </div>
    </form>
  );
}
