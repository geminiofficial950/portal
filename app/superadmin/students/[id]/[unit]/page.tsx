import Link from "next/link";
import { notFound } from "next/navigation";
import { BackIcon } from "../../../../dashboard/_components/icons";
import UnitWorkReview from "../../../../dashboard/_components/UnitWorkReview";
import type { AssessmentPart } from "@/lib/assessment-meta";
import { getAssessment } from "@/lib/assessments";
import { requireAdmin } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import type { SubmissionDTO } from "@/lib/submission-meta";
import { getStudent, pickCourse } from "@/lib/students";
import { listStudentSubmissions } from "@/lib/submissions";
import { getUnitResult } from "@/lib/unit-results";

// Super Admin: everything a student handed in for one unit
export default async function AdminStudentUnitPage(props: PageProps<"/superadmin/students/[id]/[unit]">) {
  const admin = await requireAdmin();
  const [{ id, unit: unitParam }, { course: courseParam }] = await Promise.all([props.params, props.searchParams]);
  const student = await getStudent(decodeURIComponent(id));
  const picked = student ? pickCourse(student, typeof courseParam === "string" ? courseParam : null) : null;
  const course = picked ? await getCourse(picked.code) : null;
  const unit = course?.units.find((u) => u.code === decodeURIComponent(unitParam));
  if (!student || !course || !unit) notFound();

  const [assessment, submissions, outcome] = await Promise.all([
    getAssessment(course.code, unit.code),
    listStudentSubmissions(student.studentId, course.code),
    getUnitResult(student.studentId, course.code, unit.code),
  ]);
  const byPart: Partial<Record<AssessmentPart, SubmissionDTO>> = Object.fromEntries(
    submissions.filter((s) => s.unitCode === unit.code).map((s) => [s.part, s]),
  );

  return (
    <div className="animate-fade-up space-y-6">
      <Link href={`/superadmin/students/${student.studentId}?course=${encodeURIComponent(course.code)}`} className="inline-flex items-center gap-2 text-sm text-ink/55 transition hover:text-plum">
        <BackIcon className="h-4 w-4" />
        {student.name}’s progress
      </Link>
      <UnitWorkReview
        student={{ studentId: student.studentId, name: student.name }}
        course={{ code: course.code, name: course.name }}
        unit={unit}
        assessment={assessment}
        submissions={byPart}
        outcome={outcome}
        reviewBase="/superadmin/marking"
        canEditDate={admin.isSuper}
      />
    </div>
  );
}
