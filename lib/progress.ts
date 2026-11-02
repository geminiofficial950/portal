import "server-only";
import { summarise, type AssessmentPart, type AssessmentSummary } from "./assessment-meta";
import { listCourseAssessments } from "./assessments";
import { getCourse } from "./courses";
import { listHiddenUnits } from "./hidden-units";
import { listStudentDueDates } from "./due-dates";
import type { SubmissionStatus } from "./submission-meta";
import { getStudent, listStudents, pickCourse } from "./students";
import { listStudentSubmissions } from "./submissions";
import type { ResultOption } from "./result-meta";
import { listResultOptions } from "./result-options";
import type { UnitResultDTO } from "./unit-meta";
import { listStudentResults } from "./unit-results";

export type UnitProgress = {
  code: string;
  title: string;
  setUp: AssessmentSummary | null;
  statuses: Partial<Record<AssessmentPart, SubmissionStatus>>;
  dueAt: string | null; // what applies to this student
  unitDueAt: string | null; // the unit's own due date
  extended: boolean; // Super Admin set a different date for this student
  outcome: UnitResultDTO | null;
  // Photos taken at submit time (only passed to Super Admin pages)
  photos: { part: AssessmentPart; fileId: string; submittedAt: string | null }[];
  hidden: boolean; // Super Admin hid this unit from the student
};

export type StudentProgressDTO = {
  student: { studentId: string; name: string; email: string; status: string };
  course: { code: string; name: string };
  units: UnitProgress[];
  resultOptions: ResultOption[]; // what staff can pick as a final result
};

// One student's whole course: every unit, each part's status and the final result
// `courseCode` picks one of the student's courses; default is their first
export async function getStudentProgress(studentId: string, courseCode?: string | null): Promise<StudentProgressDTO | null> {
  const student = await getStudent(studentId);
  const picked = student ? pickCourse(student, courseCode) : null;
  const course = picked ? await getCourse(picked.code) : null;
  if (!student || !course) return null;

  const [assessments, submissions, results, ownDue, hidden, resultOptions] = await Promise.all([
    listCourseAssessments(course.code),
    listStudentSubmissions(student.studentId, course.code),
    listStudentResults(student.studentId, course.code),
    listStudentDueDates(student.studentId, course.code),
    listHiddenUnits(student.studentId, course.code),
    listResultOptions(),
  ]);

  return {
    student: { studentId: student.studentId, name: student.name, email: student.email, status: student.status },
    course: { code: course.code, name: course.name },
    resultOptions,
    units: course.units.map((u) => ({
      code: u.code,
      title: u.title,
      setUp: assessments[u.code] ? summarise(assessments[u.code]) : null,
      statuses: Object.fromEntries(submissions.filter((s) => s.unitCode === u.code).map((s) => [s.part, s.status])),
      dueAt: ownDue[u.code] ?? assessments[u.code]?.dueAt ?? null,
      unitDueAt: assessments[u.code]?.dueAt ?? null,
      extended: !!ownDue[u.code],
      outcome: results.find((r) => r.unitCode === u.code) ?? null,
      hidden: hidden.has(u.code),
      photos: submissions
        .filter((s) => s.unitCode === u.code && s.photo)
        .map((s) => ({ part: s.part, fileId: s.photo!.id, submittedAt: s.submittedAt })),
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
          const [course, results] = await Promise.all([getCourse(c.code), listStudentResults(s.studentId, c.code)]);
          return { units: course?.units.length ?? 0, passed: results.filter((r) => r.kind === "pass").length, graded: results.length };
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
