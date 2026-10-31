"use client";

import { useState } from "react";
import { ArrowRightIcon, BoxIcon, ClockIcon } from "../../dashboard/_components/icons";
import type { CourseDTO, Unit } from "@/lib/courses";
import type { AssessmentSummary } from "@/lib/assessment-meta";
import type { UnitContentSummary } from "@/lib/unit-content";
import UnitsModal from "./UnitsModal";

const tones = ["bg-[#ffe8d6]", "bg-lilac", "bg-[#e8f3ff]", "bg-emerald-50"];

export default function CoursesClient({
  initialCourses,
  summaries,
  content,
}: {
  initialCourses: CourseDTO[];
  summaries: Record<string, AssessmentSummary>;
  content: Record<string, UnitContentSummary>;
}) {
  const [courses, setCourses] = useState(initialCourses);
  const [selected, setSelected] = useState(initialCourses[0]?.code ?? "");
  const [openCode, setOpenCode] = useState<string | null>(null);

  const openCourse = courses.find((c) => c.code === openCode) ?? null;

  const setUnits = (code: string, update: (units: Unit[]) => Unit[]) =>
    setCourses((list) => list.map((c) => (c.code === code ? { ...c, units: update(c.units) } : c)));

  return (
    <div className="animate-fade-up space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-ink sm:text-[1.65rem]">Certificate courses</h1>
        <p className="mt-1 text-sm text-ink/55">Pick a course to see its units. Add or remove units, and set up each unit’s assessment.</p>
      </div>

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
                {c.code} · {c.name} ({c.release})
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
              {c.code} · {c.release}
            </p>
            <h2 className="mt-1 text-base font-medium leading-snug text-ink">{c.name}</h2>
            <p className="mt-1 flex-1 text-xs text-ink/50">{c.category}</p>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink/5 pt-4">
              <div className="flex items-center gap-4 text-xs text-ink/60">
                <span className="flex items-center gap-1.5">
                  <BoxIcon className="h-4 w-4" />
                  {c.units.length} units
                </span>
                <span className="flex items-center gap-1.5">
                  <ClockIcon className="h-4 w-4" />
                  {c.duration}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelected(c.code);
                  setOpenCode(c.code);
                }}
                className="rounded-full bg-white px-4 py-2 text-[11px] font-medium text-plum transition hover:bg-plum hover:text-white"
              >
                View
              </button>
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
        />
      )}
    </div>
  );
}
