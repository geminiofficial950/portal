import "server-only";
import { partLabel, partsOf, unitDueAt, type AssessmentPart } from "./assessment-meta";
import { listCourseAssessments } from "./assessments";
import { getCourse } from "./courses";
import { listHiddenUnits } from "./hidden-units";
import { listStudentDueDates } from "./due-dates";
import type { SubmissionStatus } from "./submission-meta";
import { getStudent, listStudents, pickCourse } from "./students";
import { listCourseWork, listStudentSubmissions } from "./submissions";
import { listUnitRecords, type FullUnitRecord } from "./unit-records";
import { unitAccess, type UnitAccess } from "./unit-status-meta";

export type UnitProgress = {
  code: string;
  title: string;
  parts: { key: AssessmentPart; label: string }[]; // the unit's marked modules, in order
  statuses: Partial<Record<AssessmentPart, SubmissionStatus>>;
  dueAt: string | null; // what applies to this student
  unitDueAt: string | null; // the unit's own due date
  extended: boolean; // Super Admin set a different date for this student
  record: FullUnitRecord; // unit status, admin opening, scheduled release, unit feedback
  access: UnitAccess; // can the student open it now, and if not why
  // Photos taken at submit time (only passed to Super Admin pages)
  photos: { part: AssessmentPart; label: string; fileId: string; submittedAt: string | null }[];
  hidden: boolean; // Super Admin hid this unit from the student
  unlocked: boolean; // admin opened it for the student
};

export type StudentProgressDTO = {
  student: { studentId: string; name: string; email: string; status: string };
  course: { code: string; name: string };
  units: UnitProgress[];
};

// One student's whole course: every unit, each part's status and the final result
// `courseCode` picks one of the student's courses; default is their first
export async function getStudentProgress(studentId: string, courseCode?: string | null): Promise<StudentProgressDTO | null> {
  const student = await getStudent(studentId);
  const picked = student ? pickCourse(student, courseCode) : null;
  const course = picked ? await getCourse(picked.code) : null;
  if (!student || !course) return null;

  const [assessments, submissions, records, ownDue, hidden] = await Promise.all([
    listCourseAssessments(course.code),
    listStudentSubmissions(student.studentId, course.code),
    listUnitRecords(student.studentId, course.code),
    listStudentDueDates(student.studentId, course.code),
    listHiddenUnits(student.studentId, course.code),
  ]);
  const recordOf = (u: string): FullUnitRecord => records[u] ?? { status: "Active", opened: false, releaseAt: null, feedback: "", decidedBy: null, decidedAt: null };

  return {
    student: { studentId: student.studentId, name: student.name, email: student.email, status: student.status },
    course: { code: course.code, name: course.name },
    units: course.units.map((u) => ({
      code: u.code,
      title: u.title,
      parts: partsOf(assessments[u.code]),
      statuses: Object.fromEntries(submissions.filter((s) => s.unitCode === u.code).map((s) => [s.part, s.status])),
      dueAt: ownDue[u.code] ?? unitDueAt(assessments[u.code]),
      unitDueAt: unitDueAt(assessments[u.code]),
      extended: !!ownDue[u.code],
      record: recordOf(u.code),
      access: unitAccess(recordOf(u.code)),
      hidden: hidden.has(u.code),
      unlocked: recordOf(u.code).opened,
      photos: submissions
        .filter((s) => s.unitCode === u.code && s.photo)
        .map((s) => ({ part: s.part, label: partLabel(assessments[u.code], s.part), fileId: s.photo!.id, submittedAt: s.submittedAt })),
    })),
  };
}

// Students with how many units they've passed (across all their courses), for the trainer's list
export async function listStudentsWithResults() {
  const students = await listStudents();
  return Promise.all(
    students.map(async (s) => {
      const perCourse = await Promise.all(
        s.courses.map(async (c) => {
          const [course, records] = await Promise.all([getCourse(c.code), listUnitRecords(s.studentId, c.code)]);
          const list = Object.values(records);
          return { units: course?.units.length ?? 0, passed: list.filter((r) => r.status === "Competent").length, graded: list.filter((r) => r.status === "Competent" || r.status === "Not Yet Competent").length };
        }),
      );
      return {
        studentId: s.studentId,
        name: s.name,
        email: s.email,
        status: s.status,
        courseCodes: s.courses.map((c) => c.code),
        units: perCourse.reduce((n, c) => n + c.units, 0),
        passed: perCourse.reduce((n, c) => n + c.passed, 0),
        graded: perCourse.reduce((n, c) => n + c.graded, 0),
      };
    }),
  );
}

// Average progress per course for the admin dashboard, worked out like each student's course player:
// a student's progress = assessment parts marked Satisfactory ÷ every part set up in the course
export async function courseProgressAverages(courseCodes: string[]) {
  const students = await listStudents();
  const rows = await Promise.all(
    courseCodes.map(async (code) => {
      const enrolled = students.filter((s) => s.courses.some((c) => c.code === code));
      const [assessments, work] = await Promise.all([listCourseAssessments(code), listCourseWork(code)]);
      const set = Object.fromEntries(Object.entries(assessments).map(([unit, a]) => [unit, new Set(partsOf(a).map((p) => p.key))]));
      const partsSet = Object.values(set).reduce((n, keys) => n + keys.size, 0);
      const counts = (w: { unitCode: string; part: AssessmentPart }) => !!set[w.unitCode]?.has(w.part);
      const avg =
        enrolled.length && partsSet
          ? enrolled.reduce((sum, st) => sum + work.filter((w) => w.studentId === st.studentId && w.status === "Accepted" && counts(w)).length / partsSet, 0) /
            enrolled.length
          : 0;
      return [code, { students: enrolled.length, avg: Math.round(Math.min(1, avg) * 100) }] as const;
    }),
  );
  return Object.fromEntries(rows) as Record<string, { students: number; avg: number }>;
}
