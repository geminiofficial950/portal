"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { ASSESSMENT_PARTS, isPastDue, type AssessmentPart } from "@/lib/assessment-meta";
import { getAssessment } from "@/lib/assessments";
import { getSettings } from "@/lib/settings";
import { requireStudent } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { getStudentDueDate } from "@/lib/due-dates";
import { deleteUploads, ownedUploads } from "@/lib/files";
import { scoreQuiz } from "@/lib/quiz";
import { cleanEditorHtml } from "@/lib/sanitize";
import { FILE_RULES, type SubmissionContent, type SubmissionDTO } from "@/lib/submission-meta";
import { LockedError, saveWork } from "@/lib/submissions";
import { getStudent } from "@/lib/students";
import { getUnitResult } from "@/lib/unit-results";

type Result = { ok: true; submission: SubmissionDTO } | { ok: false; error: string };

const isEmptyHtml = (html: string) => !html.replace(/<[^>]*>|&nbsp;|\s/g, "");

// The submit photo, when camera proctoring is on: it must be an image this student just uploaded
async function submitPhoto(photoId: string | null | undefined, studentId: string) {
  const required = (await getSettings()).switches.proctoring;
  if (!photoId) return required ? ({ error: "Take a photo with your camera to submit." } as const) : ({ photo: null } as const);
  const [photo] = await ownedUploads([String(photoId)], studentId);
  if (!photo || !/\.(jpe?g|png)$/i.test(photo.name)) return { error: "Your photo didn’t upload — take it again." } as const;
  return { photo } as const;
}

// The student's course, unit and that unit's assessment — or an error message
async function load(unitCode: string) {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  if (!student || student.status !== "Active") return { error: "Your account isn’t active." } as const;
  const course = await getCourse(student.course);
  const unit = course?.units.find((u) => u.code === unitCode);
  if (!course || !unit) return { error: "This unit isn’t in your course." } as const;
  const outcome = await getUnitResult(student.studentId, course.code, unit.code);
  if (outcome) return { error: `This unit is finalised (${outcome.result}), so it can’t be changed.` } as const;
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

export async function submitQuizAction(unitCode: string, answers: number[], photoId?: string | null): Promise<Result> {
  const ctx = await load(unitCode);
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const { student, course, unit, assessment } = ctx;
  const marked = scoreQuiz(assessment.quiz.questions, answers, assessment.quiz.passMark);
  if (!marked.ok) return marked;
  const { correct, total, percent, passed, feedback } = marked.score;
  const snap = await submitPhoto(photoId, student.studentId);
  if ("error" in snap) return { ok: false, error: snap.error! };

  try {
    const { saved, previousPhoto } = await saveWork(
      { studentId: student.studentId, courseCode: course.code, unitCode: unit.code, part: "quiz" },
      { studentName: student.name, unitTitle: unit.title },
      {
        status: passed ? "Accepted" : "Rejected",
        content: { quizAnswers: answers, score: { correct, total, percent } },
        files: [],
        photo: snap.photo,
        feedback,
        decidedBy: "Auto-marked",
      },
    );
    if (previousPhoto && previousPhoto.id !== snap.photo?.id) await deleteUploads([previousPhoto.id]);
    await logActivity(student.name, `${passed ? "passed" : "did not pass"} the ${unit.code} quiz (${percent}%)`, "student");
    refresh(unit.code);
    return { ok: true, submission: saved };
  } catch (err) {
    if (err instanceof LockedError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function saveWorkAction(
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
): Promise<Result> {
  if (!["theory", "rolePlay", "workplace"].includes(part)) return { ok: false, error: "Unknown part." };
  const ctx = await load(unitCode);
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const { student, course, unit, assessment } = ctx;
  const label = ASSESSMENT_PARTS.find((p) => p.key === part)!.label;

  const ready =
    part === "theory" ? assessment.theory.questions.length > 0 : part === "rolePlay" ? !!assessment.rolePlay.scenario : !!assessment.workplace.task;
  if (!ready) return { ok: false, error: `${label} isn’t set up for this unit yet.` };

  const ids = Array.isArray(input?.fileIds) ? input.fileIds.slice(0, FILE_RULES.maxFiles).map(String) : [];
  const files = await ownedUploads(ids, student.studentId);

  const content: SubmissionContent = {};
  if (part === "theory") {
    const given = new Map((Array.isArray(input?.theory) ? input.theory : []).map((t) => [String(t?.questionId), t]));
    // Each question may have its own uploaded documents — only this student's own uploads count
    const askedIds = [...given.values()].flatMap((t) => (Array.isArray(t?.fileIds) ? t.fileIds.slice(0, FILE_RULES.maxFiles).map(String) : []));
    const owned = new Map((await ownedUploads(askedIds, student.studentId)).map((f) => [f.id, f]));
    content.theory = assessment.theory.questions.map((q) => {
      const t = given.get(q.id);
      const qFiles = (Array.isArray(t?.fileIds) ? t.fileIds.slice(0, FILE_RULES.maxFiles) : [])
        .map((id) => owned.get(String(id)))
        .filter((f) => !!f);
      return { questionId: q.id, html: cleanEditorHtml(t?.html), files: qFiles };
    });
  } else {
    content.html = cleanEditorHtml(input?.html);
    if (part === "workplace") {
      content.supervisor = String(input?.supervisor ?? "").trim().slice(0, 120);
      // Files for each evidence item the college asked for — only this student's own uploads count
      const given = new Map((Array.isArray(input?.evidence) ? input.evidence : []).map((e) => [String(e?.evidenceId), e]));
      const askedIds = [...given.values()].flatMap((e) => (Array.isArray(e?.fileIds) ? e.fileIds.slice(0, FILE_RULES.maxFiles).map(String) : []));
      const owned = new Map((await ownedUploads(askedIds, student.studentId)).map((f) => [f.id, f]));
      content.evidence = assessment.workplace.evidence.map((item) => ({
        evidenceId: item.id,
        files: (given.get(item.id)?.fileIds ?? [])
          .slice(0, FILE_RULES.maxFiles)
          .map((id) => owned.get(String(id)))
          .filter((f) => !!f),
      }));
    }
  }

  if (mode === "submit") {
    if (part === "theory") {
      // Every question needs an answer: typed, a document for that question, or (older drafts) a document for the whole part
      const missing = content.theory!.findIndex((t) => isEmptyHtml(t.html) && !t.files?.length);
      if (missing >= 0 && !files.length) {
        return { ok: false, error: `Answer question ${missing + 1} — type your answer or upload a document for it.` };
      }
    } else if (part === "workplace" && content.evidence!.length > 0) {
      // Each evidence item needs at least one file
      const missing = content.evidence!.findIndex((e) => e.files.length === 0);
      if (missing >= 0) {
        return { ok: false, error: `Upload your evidence for: ${assessment.workplace.evidence[missing].text}` };
      }
    } else if (isEmptyHtml(content.html ?? "") && !files.length) {
      return { ok: false, error: "Write your response or upload a document first." };
    }
    if (part === "workplace" && assessment.workplace.supervisorSignOff && !content.supervisor) {
      return { ok: false, error: "Add your workplace supervisor’s name — they need to sign off this task." };
    }
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
    const kept = new Set(
      [...files, ...(content.theory?.flatMap((t) => t.files ?? []) ?? []), ...(content.evidence?.flatMap((e) => e.files) ?? [])].map((f) => f.id),
    );
    await deleteUploads(previousFiles.filter((f) => !kept.has(f.id)).map((f) => f.id));
    if (previousPhoto && previousPhoto.id !== photo?.id) await deleteUploads([previousPhoto.id]);
    if (mode === "submit") await logActivity(student.name, `submitted ${label.toLowerCase()} for ${unit.code}`, "student");
    refresh(unit.code);
    return { ok: true, submission: saved };
  } catch (err) {
    if (err instanceof LockedError) return { ok: false, error: err.message };
    throw err;
  }
}
