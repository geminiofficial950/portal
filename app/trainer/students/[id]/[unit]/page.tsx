import Link from "next/link";
import { notFound } from "next/navigation";
import { BackIcon } from "../../../../dashboard/_components/icons";
import UnitWorkReview from "../../../../dashboard/_components/UnitWorkReview";
import type { AssessmentPart } from "@/lib/assessment-meta";
import { getAssessment } from "@/lib/assessments";
import { requireTrainer } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import type { SubmissionDTO } from "@/lib/submission-meta";
import { getStudent, pickCourse } from "@/lib/students";
import { listStudentSubmissions } from "@/lib/submissions";
import { getUnitRecord } from "@/lib/unit-records";
import { trainerCanSee } from "@/lib/trainer-access";

// Trainer: a student's work for one unit, part by part (submit photos are Super Admin only)
export default async function TrainerStudentUnitPage(props: PageProps<"/trainer/students/[id]/[unit]">) {
  const trainer = await requireTrainer();
  const [{ id, unit: unitParam }, { course: courseParam }] = await Promise.all([props.params, props.searchParams]);
  const student = await getStudent(decodeURIComponent(id));
  const picked = student ? pickCourse(student, typeof courseParam === "string" ? courseParam : null) : null;
  const course = picked ? await getCourse(picked.code) : null;
  const unit = course?.units.find((u) => u.code === decodeURIComponent(unitParam));
  if (!student || !course || !unit) notFound();
  if (!(await trainerCanSee(trainer.trainerId, student.studentId, unit.code))) notFound();

  const [assessment, submissions, outcome] = await Promise.all([
    getAssessment(course.code, unit.code),
    listStudentSubmissions(student.studentId, course.code),
    getUnitRecord(student.studentId, course.code, unit.code),
  ]);
  const byPart: Partial<Record<AssessmentPart, SubmissionDTO>> = Object.fromEntries(
    submissions.filter((s) => s.unitCode === unit.code).map((s) => [s.part, { ...s, photo: null }]),
  );

  return (
    <div className="animate-fade-up space-y-6">
      <Link href={`/trainer/students/${student.studentId}?course=${encodeURIComponent(course.code)}`} className="inline-flex items-center gap-2 text-sm text-ink transition hover:text-plum">
        <BackIcon className="h-4 w-4" />
        {student.name}’s progress
      </Link>
      <UnitWorkReview
        student={{ studentId: student.studentId, name: student.name }}
        course={{ code: course.code, name: course.name }}
        unit={unit}
        assessment={assessment}
        submissions={byPart}
        unitRecord={outcome}
        reviewBase="/trainer/marking"
      />
    </div>
  );
}
