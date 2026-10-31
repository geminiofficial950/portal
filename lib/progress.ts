import "server-only";
import { summarise, type AssessmentPart, type AssessmentSummary } from "./assessment-meta";
import { listCourseAssessments } from "./assessments";
import { getCourse } from "./courses";
import { listStudentDueDates } from "./due-dates";
import type { SubmissionStatus } from "./submission-meta";
import { getStudent, listStudents } from "./students";
import { listStudentSubmissions } from "./submissions";
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
};

export type StudentProgressDTO = {
  student: { studentId: string; name: string; email: string; status: string };
  course: { code: string; name: string };
  units: UnitProgress[];
};

// One student's whole course: every unit, each part's status and the final result
export async function getStudentProgress(studentId: string): Promise<StudentProgressDTO | null> {
  const student = await getStudent(studentId);
  const course = student ? await getCourse(student.course) : null;
  if (!student || !course) return null;

  const [assessments, submissions, results, ownDue] = await Promise.all([
    listCourseAssessments(course.code),
    listStudentSubmissions(student.studentId, course.code),
    listStudentResults(student.studentId, course.code),
    listStudentDueDates(student.studentId, course.code),
  ]);

  return {
    student: { studentId: student.studentId, name: student.name, email: student.email, status: student.status },
    course: { code: course.code, name: course.name },
    units: course.units.map((u) => ({
      code: u.code,
      title: u.title,
      setUp: assessments[u.code] ? summarise(assessments[u.code]) : null,
      statuses: Object.fromEntries(submissions.filter((s) => s.unitCode === u.code).map((s) => [s.part, s.status])),
      dueAt: ownDue[u.code] ?? assessments[u.code]?.dueAt ?? null,
      unitDueAt: assessments[u.code]?.dueAt ?? null,
      extended: !!ownDue[u.code],
      outcome: results.find((r) => r.unitCode === u.code) ?? null,
      photos: submissions
        .filter((s) => s.unitCode === u.code && s.photo)
        .map((s) => ({ part: s.part, fileId: s.photo!.id, submittedAt: s.submittedAt })),
    })),
  };
}

// Students with how many units they've passed, for the trainer's list
export async function listStudentsWithResults() {
  const students = await listStudents();
  return Promise.all(
    students.map(async (s) => {
      const [course, results] = await Promise.all([getCourse(s.course), listStudentResults(s.studentId, s.course)]);
      return {
        studentId: s.studentId,
        name: s.name,
        email: s.email,
        status: s.status,
        courseCode: s.course,
        units: course?.units.length ?? 0,
        passed: results.filter((r) => r.result === "Pass").length,
        graded: results.length,
      };
    }),
  );
}
