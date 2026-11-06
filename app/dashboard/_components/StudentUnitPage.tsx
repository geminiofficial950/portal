import { notFound } from "next/navigation";
import UnitWork, { type OutlineUnit } from "../assessment/[unit]/UnitWork";
import { emptyAssessment, forStudent } from "@/lib/assessment-meta";
import { listCourseAssessments } from "@/lib/assessments";
import { requireStudent } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { getDeclaration } from "@/lib/declaration-store";
import { listExtensionRequests, studentModuleDues } from "@/lib/deadlines";
import { listHiddenUnits } from "@/lib/hidden-units";
import { liveModules, markableModules, needsSubmission } from "@/lib/module-meta";
import { getSettings } from "@/lib/settings";
import { forStudentSub, type SubmissionDTO } from "@/lib/submission-meta";
import { getStudent, hasCourse } from "@/lib/students";
import { listStudentSubmissions } from "@/lib/submissions";
import { getUnitContent, listCourseOutline } from "@/lib/unit-content";
import { listUnitRecords } from "@/lib/unit-records";
import { unitAccess } from "@/lib/unit-status-meta";

// One unit of one of the signed-in student's courses: an overview of its modules, Resources, then each module,
// with every unit of the course on the right. `courseCode` comes from the link; without it, the first of their
// courses that has the unit. `item` picks what to open.
export default async function StudentUnitPage({ unitCode, courseCode, item }: { unitCode: string; courseCode?: string; item?: string }) {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  if (!student) notFound();
  const codes = courseCode && hasCourse(student, courseCode) ? [courseCode] : student.courses.map((c) => c.code);
  const courses = await Promise.all(codes.map((c) => getCourse(c)));
  const course = courses.find((c) => c?.units.some((u) => u.code === unitCode));
  const unit = course?.units.find((u) => u.code === unitCode);
  if (!course || !unit) notFound();

  const [hidden, records, assessments, outline, submissions, settings, content, allDues, declaration, extensions] = await Promise.all([
    listHiddenUnits(student.studentId, course.code),
    listUnitRecords(student.studentId, course.code),
    listCourseAssessments(course.code),
    listCourseOutline(course.code),
    listStudentSubmissions(student.studentId, course.code),
    getSettings(),
    getUnitContent(course.code, unit.code),
    studentModuleDues(student.studentId, course.code),
    getDeclaration(),
    listExtensionRequests({ studentId: student.studentId, courseCode: course.code }),
  ]);
  if (hidden.has(unit.code)) notFound();

  const statusOf = (u: string, p: string) => submissions.find((s) => s.unitCode === u && s.part === p)?.status;
  // Unit status is the highest access rule: Active AND opened by admin (or released). Anything else hides every module.
  const accessOf = (u: string) => unitAccess(records[u] ?? null);

  // Every unit the student can see, with its modules, for the sidebar
  const units: OutlineUnit[] = course.units
    .filter((u) => !hidden.has(u.code))
    .map((u) => ({
      code: u.code,
      title: u.title,
      hasOverview: outline[u.code]?.hasOverview ?? false,
      resources: outline[u.code]?.resources ?? [],
      parts: liveModules(assessments[u.code]?.modules ?? []).map((m) => ({
        key: m.id,
        label: m.title,
        status: statusOf(u.code, m.id) ?? "Not started",
        marked: needsSubmission(m),
      })),
      unlocked: accessOf(u.code).open,
      note: accessOf(u.code).reason,
    }));

  // A unit that isn't open shows only its name, its status and why — none of its content, modules or dates is sent
  const access = accessOf(unit.code);
  const locked = !access.open;
  const record = records[unit.code] ?? null;

  // Course progress: marked modules Satisfactory out of all marked modules
  const marked = units.flatMap((u) => u.parts.filter((p) => p.marked));
  const percent = marked.length ? Math.round((marked.filter((p) => p.status === "Accepted").length / marked.length) * 100) : 0;

  const assessment = assessments[unit.code] ?? emptyAssessment();
  // Each module's deadline for this student: their own (extension / request), else the module's
  const dues = Object.fromEntries(markableModules(assessment.modules).map((m) => [m.id, allDues[`${unit.code}/${m.id}`] ?? null]));
  // never the trainer's unpublished marking
  const byPart: Record<string, SubmissionDTO> = Object.fromEntries(submissions.filter((s) => s.unitCode === unit.code).map((s) => [s.part, forStudentSub(s)]));
  const myRequests = extensions.filter((r) => r.unitCode === unit.code);

  return (
    <div className="animate-fade-up">
      <UnitWork
        key={`${unit.code}:${item ?? ""}`}
        course={{ code: course.code, name: course.name }}
        unit={unit}
        units={units}
        percent={percent}
        initialItem={item}
        assessment={forStudent(locked ? emptyAssessment() : assessment)}
        initialSubmissions={locked ? {} : byPart}
        dues={locked ? {} : dues}
        extensions={locked ? [] : myRequests}
        photoRequired={settings.switches.proctoring}
        declaration={declaration}
        resources={locked ? [] : content.resources}
        unitStatus={record && record.status !== "Active" ? record : null}
        locked={locked}
        lockNote={locked ? `${access.reason}. ${access.next}` : null}
      />
    </div>
  );
}
