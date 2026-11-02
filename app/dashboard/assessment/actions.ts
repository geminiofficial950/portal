"use server";

import { revalidatePath } from "next/cache";
import { getDeclaration } from "@/lib/declaration-store";
import { logActivity } from "@/lib/activity";
import { ASSESSMENT_PARTS, isPastDue, type AssessmentPart } from "@/lib/assessment-meta";
import { getAssessment } from "@/lib/assessments";
import { getSettings } from "@/lib/settings";
import { requireStudent } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { getStudentDueDate } from "@/lib/due-dates";
import { isUnitHidden } from "@/lib/hidden-units";
import { deleteUploads, ownedUploads } from "@/lib/files";
import { scoreQuiz } from "@/lib/quiz";
import { logStudent } from "@/lib/student-logs";
import { FILE_RULES, type SubmissionContent, type SubmissionDTO } from "@/lib/submission-meta";
import { LockedError, saveWork } from "@/lib/submissions";
import { getStudent, hasCourse } from "@/lib/students";
import { getUnitResult } from "@/lib/unit-results";

type Result = { ok: true; submission: SubmissionDTO } | { ok: false; error: string };

// The submit photo, when camera proctoring is on: it must be an image this student just uploaded
async function submitPhoto(photoId: string | null | undefined, studentId: string) {
  const required = (await getSettings()).switches.proctoring;
  if (!photoId) return required ? ({ error: "Take a photo with your camera to submit." } as const) : ({ photo: null } as const);
  const [photo] = await ownedUploads([String(photoId)], studentId);
  if (!photo || !/\.(jpe?g|png)$/i.test(photo.name)) return { error: "Your photo didn’t upload — take it again." } as const;
  return { photo } as const;
}

// One of the student's courses, the unit and that unit's assessment — or an error message
async function load(courseCode: string, unitCode: string) {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  if (!student || student.status !== "Active") return { error: "Your account isn’t active." } as const;
  const course = hasCourse(student, courseCode) ? await getCourse(courseCode) : null;
  const unit = course?.units.find((u) => u.code === unitCode);
  if (!course || !unit || (await isUnitHidden(student.studentId, course.code, unit.code))) {
    return { error: "This unit isn’t in your course." } as const;
  }
  const outcome = await getUnitResult(student.studentId, course.code, unit.code);
  if (outcome) return { error: `This unit is finalised (${outcome.label}), so it can’t be changed.` } as const;
  const [assessment, ownDue] = await Promise.all([
    getAssessment(course.code, unit.code),
    getStudentDueDate(student.studentId, course.code, unit.code),
  ]);
  if (isPastDue(ownDue ?? assessment.dueAt)) return { error: "The due date has passed. Ask the college to extend it." } as const;
  return { student, course, unit, assessment } as const;
}

const refresh = (unitCode: string) => {
  revalidatePath("/dashboard/assessment", "layout");
  revalidatePath(`/dashboard/assessment/${unitCode}`);
  revalidatePath("/trainer", "layout");
};

export async function submitQuizAction(courseCode: string, unitCode: string, answers: number[], photoId?: string | null): Promise<Result> {
  const ctx = await load(courseCode, unitCode);
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const { student, course, unit, assessment } = ctx;
  const marked = scoreQuiz(assessment.quiz.questions, answers, assessment.quiz.passMark);
  if (!marked.ok) return marked;
  // The score is saved for staff; Trainer / Admin / Super Admin set the status
  const { correct, total, percent } = marked.score;
  const snap = await submitPhoto(photoId, student.studentId);
  if ("error" in snap) return { ok: false, error: snap.error! };

  try {
    const { saved, previousPhoto } = await saveWork(
      { studentId: student.studentId, courseCode: course.code, unitCode: unit.code, part: "quiz" },
      { studentName: student.name, unitTitle: unit.title },
      {
        status: "Submitted",
        content: { quizAnswers: answers, score: { correct, total, percent } },
        files: [],
        photo: snap.photo,
      },
    );
    if (previousPhoto && previousPhoto.id !== snap.photo?.id) await deleteUploads([previousPhoto.id]);
    await logActivity(student.name, `submitted the ${unit.code} quiz (scored ${percent}%)`, "student");
    await logStudent({
      studentId: student.studentId,
      studentName: student.name,
      courseCode: course.code,
      unitCode: unit.code,
      action: saved.attempt > 1 ? "Resubmitted" : "Submitted",
      detail: `Quiz and Activities · scored ${correct}/${total} (${percent}%)`,
    });
    refresh(unit.code);
    return { ok: true, submission: saved };
  } catch (err) {
    if (err instanceof LockedError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function saveWorkAction(
  courseCode: string,
  unitCode: string,
  part: Exclude<AssessmentPart, "quiz">,
  input: {
    theory?: { questionId: string; html: string; fileIds?: string[] }[];
    html?: string;
    supervisor?: string;
    evidence?: { evidenceId: string; fileIds?: string[] }[];
    fileIds: string[];
  },
  mode: "draft" | "submit",
  photoId?: string | null,
  declared?: boolean, // the student ticked the declaration (required to submit)
): Promise<Result> {
  if (!["theory", "workplace"].includes(part)) return { ok: false, error: "Unknown part." };
  const ctx = await load(courseCode, unitCode);
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const { student, course, unit, assessment } = ctx;
  const label = ASSESSMENT_PARTS.find((p) => p.key === part)!.label;

  // The task is the document(s) Super Admin uploaded; the student's work is the files they upload
  const task = part === "theory" ? assessment.theory.files : assessment.workplace.files;
  if (!task.length) return { ok: false, error: `${label} isn’t set up for this unit yet.` };

  const ids = Array.isArray(input?.fileIds) ? input.fileIds.slice(0, FILE_RULES.maxFiles).map(String) : [];
  const files = await ownedUploads(ids, student.studentId);
  const content: SubmissionContent = {};
  if (mode === "submit" && files.length === 0) return { ok: false, error: "Upload your completed work first." };
  if (mode === "submit") {
    if (declared !== true) return { ok: false, error: "Tick the declaration before you submit." };
    content.declaration = { agreedAt: new Date().toISOString(), ...(await getDeclaration()) };
  }

  let photo = null;
  if (mode === "submit") {
    const snap = await submitPhoto(photoId, student.studentId);
    if ("error" in snap) return { ok: false, error: snap.error! };
    photo = snap.photo;
  }

  try {
    const { saved, previousFiles, previousPhoto } = await saveWork(
      { studentId: student.studentId, courseCode: course.code, unitCode: unit.code, part },
      { studentName: student.name, unitTitle: unit.title },
      { status: mode === "submit" ? "Submitted" : "Draft", content, files, photo },
    );
    // Files the student removed (and a replaced photo) are no longer needed
    const kept = new Set(files.map((f) => f.id));
    await deleteUploads(previousFiles.filter((f) => !kept.has(f.id)).map((f) => f.id));
    if (previousPhoto && previousPhoto.id !== photo?.id) await deleteUploads([previousPhoto.id]);
    if (mode === "submit") await logActivity(student.name, `submitted ${label.toLowerCase()} for ${unit.code}`, "student");
    const names = files.map((f) => f.name).join(", ") || "no files";
    await logStudent({
      studentId: student.studentId,
      studentName: student.name,
      courseCode: course.code,
      unitCode: unit.code,
      action: mode === "draft" ? "Saved draft" : saved.attempt > 1 ? "Resubmitted" : "Submitted",
      detail: mode === "draft" ? `${label} · ${names}` : `${label} · ${names} · declaration agreed`,
    });
    refresh(unit.code);
    return { ok: true, submission: saved };
  } catch (err) {
    if (err instanceof LockedError) return { ok: false, error: err.message };
    throw err;
  }
}

// The student opened an item of a unit (Quiz and Activities, Resources, Theory Task, Workplacement Task) — for the activity log
export async function logUnitViewAction(courseCode: string, unitCode: string, itemKey: string): Promise<void> {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  const course = student && hasCourse(student, courseCode) ? await getCourse(courseCode) : null;
  const unit = course?.units.find((u) => u.code === unitCode);
  if (!student || !course || !unit) return;
  const part = itemKey.startsWith("part:") ? ASSESSMENT_PARTS.find((p) => `part:${p.key}` === itemKey) : null;
  const label = part?.label ?? (itemKey === "resources" ? "Resources" : null);
  if (!label) return;
  await logStudent(
    { studentId: student.studentId, studentName: student.name, courseCode: course.code, unitCode: unit.code, action: "Viewed", detail: label },
    30,
  );
}
