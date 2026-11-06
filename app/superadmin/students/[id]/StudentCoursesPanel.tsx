"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { setCourseStatusAction, setStudentCoursesAction } from "../actions";
import { courseStatusStyle, statusOptions, type CourseStatus } from "@/lib/course-status";

type Enrolment = { code: string; name: string; status: CourseStatus };

// Super Admin: the courses a student is enrolled in, each with its status (shown on the student's Course page)
export default function StudentCoursesPanel({
  studentId,
  name,
  initial,
  allCourses,
}: {
  studentId: string;
  name: string;
  initial: Enrolment[];
  allCourses: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [courses, setCourses] = useState(initial);
  const available = allCourses.filter((c) => !courses.some((x) => x.code === c.code));
  const [adding, setAdding] = useState(available[0]?.code ?? "");
  const [saving, startSaving] = useTransition();

  const changeStatus = (code: string, status: CourseStatus) => {
    const before = courses;
    setCourses((list) => list.map((c) => (c.code === code ? { ...c, status } : c)));
    startSaving(async () => {
      const res = await setCourseStatusAction(studentId, code, status);
      if (!res.ok) {
        setCourses(before);
        return void toast.error(res.error);
      }
      toast.success(`${name}: ${code} is now ${status}`);
    });
  };

  const saveList = (next: Enrolment[], message: string) =>
    startSaving(async () => {
      const res = await setStudentCoursesAction(
        studentId,
        next.map((c) => c.code),
      );
      if (!res.ok) return void toast.error(res.error);
      setCourses(next);
      toast.success(message);
      router.refresh();
    });

  const add = () => {
    const course = allCourses.find((c) => c.code === adding);
    if (!course) return;
    const next = [...courses, { code: course.code, name: course.name, status: "Active" as const }];
    saveList(next, `${name} enrolled in ${course.code}`);
    setAdding(allCourses.find((c) => !next.some((x) => x.code === c.code))?.code ?? "");
  };

  const remove = (c: Enrolment) => {
    if (!window.confirm(`Remove ${c.code} from ${name}? Their work in it is kept and comes back if you add the course again.`)) return;
    saveList(
      courses.filter((x) => x.code !== c.code),
      `${c.code} removed from ${name}`,
    );
  };

  return (
    <section className="space-y-3 rounded-[1.5rem] bg-lilac/80 p-5">
      <h2 className="text-base font-medium text-ink">Courses ({courses.length})</h2>
      <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl bg-white">
        {courses.map((c) => (
          <li key={c.code} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">{c.code}</span>
              <span className="block truncate text-xs text-ink">{c.name}</span>
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${courseStatusStyle[c.status]}`}>{c.status}</span>
            <select
              value={c.status}
              disabled={saving}
              onChange={(e) => changeStatus(c.code, e.target.value as CourseStatus)}
              aria-label={`Course status for ${c.code}`}
              className="rounded-xl bg-lilac px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-plum/30 disabled:opacity-60"
            >
              {statusOptions(c.status).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              onClick={() => remove(c)}
              disabled={saving || courses.length === 1}
              title={courses.length === 1 ? "A student needs at least one course" : undefined}
              className="rounded-full bg-lilac px-3 py-2 text-xs font-medium text-ink transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {available.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            aria-label="Course to add"
            className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/5 focus:ring-plum/30"
          >
            {available.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={add}
            disabled={saving || !adding}
            className="rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition hover:bg-plum-light disabled:opacity-60"
          >
            Add course
          </button>
        </div>
      )}
    </section>
  );
}
