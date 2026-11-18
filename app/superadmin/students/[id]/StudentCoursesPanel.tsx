"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import StudentProgress from "../../../dashboard/_components/StudentProgress";
import { addStudentCourseAction, getCourseProgressAction, setStudentCoursesAction } from "../actions";
import CourseViewModal from "./CourseViewModal";
import CourseStatusDrawer from "../CourseStatusDrawer";
import { courseStatusStyle, type CourseStatus } from "@/lib/course-status";
import type { StudentProgressDTO } from "@/lib/progress";

type Enrolment = { code: string; name: string; status: CourseStatus };

// Super Admin: the courses a student is enrolled in, each with its status (shown on the student's Course page)
export default function StudentCoursesPanel({
  studentId,
  name,
  initial,
  allCourses,
  batches,
  isSuper,
  initialView,
}: {
  studentId: string;
  name: string;
  initial: Enrolment[];
  allCourses: { code: string; name: string }[];
  isSuper: boolean; // Super Admin may change due dates and status dates in the popup
  initialView: StudentProgressDTO | null; // opened from a link with ?course=CODE
  batches: { batchId: string; name: string; courseCode: string | null }[];
}) {
  const router = useRouter();
  const [courses, setCourses] = useState(initial);
  const available = allCourses.filter((c) => !courses.some((x) => x.code === c.code));
  const [adding, setAdding] = useState(""); // "" = "Select your course"
  const [addBatch, setAddBatch] = useState("");
  const batchesFor = batches.filter((b) => b.courseCode === adding);
  const [saving, startSaving] = useTransition();

  const [managing, setManaging] = useState<Enrolment | null>(null);
  // View: the course's units, results and dates in a popup
  const [view, setView] = useState<StudentProgressDTO | null>(initialView);
  const [loadingView, setLoadingView] = useState<string | null>(null);
  const openView = async (code: string) => {
    setLoadingView(code);
    try {
      const res = await getCourseProgressAction(studentId, code);
      if (!res.ok) return void toast.error(res.error);
      setView(res.progress);
    } finally {
      setLoadingView(null);
    }
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

  // course + its batch together (a batch is needed when the course has any)
  const add = () => {
    const course = allCourses.find((c) => c.code === adding);
    if (!course) return;
    startSaving(async () => {
      const res = await addStudentCourseAction(studentId, course.code, addBatch || null);
      if (!res.ok) return void toast.error(res.error);
      setCourses((list) => [...list, { code: course.code, name: course.name, status: "Active" as const }]);
      setAdding("");
      setAddBatch("");
      toast.success(`${name} enrolled in ${course.code}${addBatch ? ` · ${batches.find((b) => b.batchId === addBatch)?.name}` : ""}`);
      router.refresh();
    });
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
            <button
              onClick={() => setManaging(c)}
              disabled={saving}
              aria-label={`Change status of ${c.code}`}
              className="rounded-full border border-plum/40 bg-white px-3 py-2 text-xs font-semibold text-plum transition hover:bg-plum hover:text-white disabled:opacity-60"
            >
              Change status
            </button>
            <button
              onClick={() => remove(c)}
              disabled={saving || courses.length === 1}
              title={courses.length === 1 ? "A student needs at least one course" : undefined}
              className="rounded-full bg-lilac px-3 py-2 text-xs font-medium text-ink transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remove
            </button>
            {/* opens this course's units in a popup */}
            <button
              type="button"
              onClick={() => openView(c.code)}
              disabled={loadingView === c.code}
              aria-label={`View ${c.code}`}
              className="shrink-0 rounded-full bg-plum px-4 py-2 text-xs font-semibold text-white transition hover:bg-plum-light disabled:cursor-wait disabled:opacity-60"
            >
              {loadingView === c.code ? "Opening…" : "View"}
            </button>
          </li>
        ))}
      </ul>
      {managing && (
        <CourseStatusDrawer
          key={managing.code}
          student={{ studentId, name }}
          course={{ code: managing.code, name: managing.name }}
          current={managing.status}
          courseChoices={courses}
          onPickCourse={(code) => setManaging(courses.find((c) => c.code === code) ?? null)}
          onClose={() => setManaging(null)}
          onSaved={(status) => {
            setCourses((list) => list.map((c) => (c.code === managing.code ? { ...c, status } : c)));
            setManaging(null);
            router.refresh();
          }}
        />
      )}
      {available.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={adding}
            onChange={(e) => (setAdding(e.target.value), setAddBatch(""))}
            aria-label="Course to add"
            className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/5 focus:ring-plum/30"
          >
            <option value="">Select your course</option>
            {available.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
          {adding &&
            (batchesFor.length ? (
              <select
                value={addBatch}
                onChange={(e) => setAddBatch(e.target.value)}
                aria-label="Batch for the new course"
                className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/5 focus:ring-plum/30"
              >
                <option value="">Select a batch</option>
                {batchesFor.map((b) => (
                  <option key={b.batchId} value={b.batchId}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-ink">No batch has been made for this course yet.</span>
            ))}
          <button
            onClick={add}
            disabled={saving || !adding || (batchesFor.length > 0 && !addBatch)}
            className="rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition hover:bg-plum-light disabled:opacity-60"
          >
            Add course
          </button>
        </div>
      )}
      {view && (
        <CourseViewModal title={`${view.course.code} · ${view.course.name}`} onClose={() => setView(null)}>
          <StudentProgress
            key={view.course.code}
            initial={view}
            canGrade
            role="admin"
            showPhotos
            canChangeDue={isSuper}
            canChangeDates={isSuper}
            canHide
            canUnlock
            workHrefBase={`/superadmin/students/${encodeURIComponent(studentId)}`}
          />
        </CourseViewModal>
      )}
    </section>
  );
}
