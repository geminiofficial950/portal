import { notFound } from "next/navigation";
import UnitWork, { type OutlineUnit } from "../assessment/[unit]/UnitWork";
import { ASSESSMENT_PARTS, emptyAssessment, forStudent, isPastDue, summarise, type AssessmentPart } from "@/lib/assessment-meta";
import { listCourseAssessments } from "@/lib/assessments";
import { requireStudent } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { getDeclaration } from "@/lib/declaration-store";
import { getStudentDueDate } from "@/lib/due-dates";
import { listHiddenUnits } from "@/lib/hidden-units";
import { getSettings } from "@/lib/settings";
import type { SubmissionDTO } from "@/lib/submission-meta";
import { getStudent, hasCourse } from "@/lib/students";
import { listStudentSubmissions } from "@/lib/submissions";
import { getUnitContent, listCourseOutline } from "@/lib/unit-content";
import { getUnitResult } from "@/lib/unit-results";

// One unit of one of the signed-in student's courses, in a course-player layout:
// the selected item on the left, every unit of the course on the right. Each unit is:
// 1. Quiz and Activities  2. Resources  3. Theory Task  4. Workplacement Task.
// `courseCode` comes from the link; without it, the first of their courses that has the unit. `item` picks what to open.
export default async function StudentUnitPage({
  unitCode,
  courseCode,
  item,
}: {
  unitCode: string;
  courseCode?: string;
  item?: string;
}) {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  if (!student) notFound();
  const codes = courseCode && hasCourse(student, courseCode) ? [courseCode] : student.courses.map((c) => c.code);
  const courses = await Promise.all(codes.map((c) => getCourse(c)));
  const course = courses.find((c) => c?.units.some((u) => u.code === unitCode));
  const unit = course?.units.find((u) => u.code === unitCode);
  if (!course || !unit) notFound();

  const [hidden, assessments, outline, submissions, settings, content, outcome, ownDue, declaration] = await Promise.all([
    listHiddenUnits(student.studentId, course.code),
    listCourseAssessments(course.code),
    listCourseOutline(course.code),
    listStudentSubmissions(student.studentId, course.code),
    getSettings(),
    getUnitContent(course.code, unit.code),
    getUnitResult(student.studentId, course.code, unit.code),
    getStudentDueDate(student.studentId, course.code, unit.code),
    getDeclaration(),
  ]);
  if (hidden.has(unit.code)) notFound();

  const statusOf = (u: string, p: AssessmentPart) => submissions.find((s) => s.unitCode === u && s.part === p)?.status;

  // Every unit the student can see, with what's inside it, for the sidebar
  const units: OutlineUnit[] = course.units
    .filter((u) => !hidden.has(u.code))
    .map((u) => {
      const set = assessments[u.code] ? summarise(assessments[u.code]) : null;
      return {
        code: u.code,
        title: u.title,
        hasOverview: outline[u.code]?.hasOverview ?? false,
        resources: outline[u.code]?.resources ?? [],
        parts: ASSESSMENT_PARTS.filter((p) => set?.[p.key]).map((p) => ({ key: p.key, status: statusOf(u.code, p.key) ?? "Not started" })),
      };
    });

  // Course progress: assessment parts marked Satisfactory out of all parts set up
  const allParts = units.flatMap((u) => u.parts);
  const percent = allParts.length ? Math.round((allParts.filter((p) => p.status === "Accepted").length / allParts.length) * 100) : 0;

  // A due date Super Admin set for this student replaces the unit's
  const unitAssessment = assessments[unit.code] ?? emptyAssessment();
  const assessment = { ...unitAssessment, dueAt: ownDue ?? unitAssessment.dueAt };
  const byPart: Partial<Record<AssessmentPart, SubmissionDTO>> = Object.fromEntries(
    submissions.filter((s) => s.unitCode === unit.code).map((s) => [s.part, s]),
  );

  return (
    <div className="animate-fade-up">
      <UnitWork
        key={`${unit.code}:${item ?? ""}`}
        course={{ code: course.code, name: course.name }}
        unit={unit}
        units={units}
        percent={percent}
        initialItem={item}
        assessment={forStudent(assessment)}
        initialSubmissions={byPart}
        pastDue={isPastDue(assessment.dueAt)}
        photoRequired={settings.switches.proctoring}
        declaration={declaration}
        overview={content.overview}
        resources={content.resources}
        outcome={outcome}
      />
    </div>
  );
}
