import Link from "next/link";
import { notFound } from "next/navigation";
import UnitWork from "../assessment/[unit]/UnitWork";
import { BackIcon } from "./icons";
import { forStudent, isPastDue, type AssessmentPart } from "@/lib/assessment-meta";
import { getAssessment } from "@/lib/assessments";
import { requireStudent } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { getStudentDueDate } from "@/lib/due-dates";
import { getSettings } from "@/lib/settings";
import type { SubmissionDTO } from "@/lib/submission-meta";
import { getStudent } from "@/lib/students";
import { listStudentSubmissions } from "@/lib/submissions";
import { getUnitContent } from "@/lib/unit-content";
import { getUnitResult } from "@/lib/unit-results";

// One unit of the signed-in student's course: Main unit → Resources → Assessment.
// Opened from both the Course page and the Assessment list.
export default async function StudentUnitPage({ unitCode, back }: { unitCode: string; back: { href: string; label: string } }) {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  const course = student ? await getCourse(student.course) : null;
  const unit = course?.units.find((u) => u.code === unitCode);
  if (!student || !course || !unit) notFound();

  const [unitAssessment, submissions, settings, content, outcome, ownDue] = await Promise.all([
    getAssessment(course.code, unit.code),
    listStudentSubmissions(student.studentId, course.code),
    getSettings(),
    getUnitContent(course.code, unit.code),
    getUnitResult(student.studentId, course.code, unit.code),
    getStudentDueDate(student.studentId, course.code, unit.code),
  ]);
  // A due date Super Admin set for this student replaces the unit's
  const assessment = { ...unitAssessment, dueAt: ownDue ?? unitAssessment.dueAt };
  const byPart: Partial<Record<AssessmentPart, SubmissionDTO>> = Object.fromEntries(
    submissions.filter((s) => s.unitCode === unit.code).map((s) => [s.part, s]),
  );

  return (
    <div className="animate-fade-up space-y-6">
      <Link href={back.href} className="inline-flex items-center gap-2 text-sm text-ink/55 transition hover:text-plum">
        <BackIcon className="h-4 w-4" />
        {back.label}
      </Link>
      <UnitWork
        course={{ code: course.code, name: course.name }}
        unit={unit}
        assessment={forStudent(assessment)}
        initialSubmissions={byPart}
        pastDue={isPastDue(assessment.dueAt)}
        photoRequired={settings.switches.proctoring}
        overview={content.overview}
        resources={content.resources}
        outcome={outcome}
      />
    </div>
  );
}
