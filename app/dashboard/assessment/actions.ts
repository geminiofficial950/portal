"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { isPastDue } from "@/lib/assessment-meta";
import { getAssessment } from "@/lib/assessments";
import { requireStudent } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { getDeclaration } from "@/lib/declaration-store";
import { studentModuleDues } from "@/lib/deadlines";
import { deleteUploads, ownedUploads } from "@/lib/files";
import { isUnitHidden } from "@/lib/hidden-units";
import { cleanResponses, isAnswered, liveModules, needsSubmission, type ActivityAnswer } from "@/lib/module-meta";
import { getSettings } from "@/lib/settings";
import { logStudent } from "@/lib/student-logs";
import { FILE_RULES, type SubmissionContent, type SubmissionDTO } from "@/lib/submission-meta";
import { getSubmission, LockedError, respondToFeedback, ResponseError, saveWork } from "@/lib/submissions";
import { getStudent, hasCourse } from "@/lib/students";
import { getUnitRecord } from "@/lib/unit-records";
import { unitAccess } from "@/lib/unit-status-meta";

type Result = { ok: true; submission: SubmissionDTO } | { ok: false; error: string };

// The submit photo, when camera proctoring is on: it must be an image this student just uploaded
async function submitPhoto(photoId: string | null | undefined, studentId: string) {
  const required = (await getSettings()).switches.proctoring;
  if (!photoId) return required ? ({ error: "Take a photo with your camera to submit." } as const) : ({ photo: null } as const);
  const [photo] = await ownedUploads([String(photoId)], studentId);
  if (!photo || !/\.(jpe?g|png)$/i.test(photo.name)) return { error: "Your photo didn’t upload — take it again." } as const;
  return { photo } as const;
}

// One of the student's courses, the unit and the module — or why it can't be worked on
async function load(courseCode: string, unitCode: string, moduleId: string) {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  if (!student || student.status !== "Active") return { error: "Your account isn’t active." } as const;
  const course = hasCourse(student, courseCode) ? await getCourse(courseCode) : null;
  const unit = course?.units.find((u) => u.code === unitCode);
  if (!course || !unit || (await isUnitHidden(student.studentId, course.code, unit.code))) return { error: "This unit isn’t in your course." } as const;
  // Unit status first (any non-active status closes everything), then admin opening / release
  const access = unitAccess(await getUnitRecord(student.studentId, course.code, unit.code));
  if (!access.open) return { error: `${access.reason}. ${access.next}` } as const;
  const [assessment, dues] = await Promise.all([getAssessment(course.code, unit.code), studentModuleDues(student.studentId, course.code)]);
  const mod = liveModules(assessment.modules).find((m) => m.id === moduleId);
  if (!mod || !needsSubmission(mod)) return { error: "This module has nothing to submit." } as const;
  // The student's deadline for this module (their own date from an extension or request, else the module's)
  if (isPastDue(dues[`${unit.code}/${mod.id}`] ?? null)) {
    return { error: "The due date has passed, so this module is locked. Request an extension." } as const;
  }
  return { student, course, unit, mod } as const;
}

/**
 * Save or submit a module: answers to its online activities and/or uploaded files.
 * A draft is only saved. Submitting needs every activity answered, every named upload filled, the declaration ticked,
 * a signature and (when switched on) a photo — and it always gives "Pending marking". Nothing is scored.
 */
export async function submitModuleAction(
  courseCode: string,
  unitCode: string,
  moduleId: string,
  input: { responses?: Record<string, ActivityAnswer>; fileIds?: string[]; slots?: { slotId: string; fileIds: string[] }[] },
  mode: "draft" | "submit",
  photoId?: string | null,
  declared?: boolean,
  signature?: { fileId: string; method: "drawn" | "uploaded" } | null,
): Promise<Result> {
  const ctx = await load(courseCode, unitCode, String(moduleId));
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const { student, course, unit, mod } = ctx;

  const content: SubmissionContent = {};
  if (mod.activities.length) {
    content.responses = cleanResponses(mod.activities, input?.responses);
    const missing = mod.activities.findIndex((a) => !isAnswered(a, content.responses![a.id]));
    if (mode === "submit" && missing >= 0) return { ok: false, error: `Answer activity ${missing + 1} before you submit.` };
  }

  let files: Awaited<ReturnType<typeof ownedUploads>> = [];
  if (mod.upload.enabled) {
    const asked = mod.upload.slots;
    if (asked.length) {
      const sent = Array.isArray(input?.slots) ? input.slots : [];
      const picked = asked.map((slot) => ({
        slot,
        ids: [...new Set((sent.find((x) => x?.slotId === slot.id)?.fileIds ?? []).map(String))].slice(0, FILE_RULES.maxPerSlot),
      }));
      files = await ownedUploads(picked.flatMap((p) => p.ids), student.studentId);
      const owned = new Set(files.map((f) => f.id));
      content.slots = picked.map(({ slot, ids }) => ({ slotId: slot.id, label: slot.label, fileIds: ids.filter((i) => owned.has(i)) }));
      const empty = content.slots.find((s) => !s.fileIds.length);
      if (mode === "submit" && empty) return { ok: false, error: `Upload “${empty.label}” before you submit.` };
    } else {
      const ids = Array.isArray(input?.fileIds) ? input.fileIds.slice(0, FILE_RULES.maxFiles).map(String) : [];
      files = await ownedUploads(ids, student.studentId);
      if (mode === "submit" && !files.length) return { ok: false, error: "Upload your completed work first." };
    }
  }

  let photo = null;
  if (mode === "submit") {
    if (declared !== true) return { ok: false, error: "Tick the declaration before you submit." };
    const [sig] = signature?.fileId ? await ownedUploads([String(signature.fileId)], student.studentId) : [];
    if (!sig || !/\.(png|jpe?g)$/i.test(sig.name)) return { ok: false, error: "Sign the declaration before you submit." };
    const snap = await submitPhoto(photoId, student.studentId);
    if ("error" in snap) return { ok: false, error: snap.error! };
    photo = snap.photo;
    content.declaration = {
      agreedAt: new Date().toISOString(),
      ...(await getDeclaration()),
      signature: { file: sig, method: signature?.method === "uploaded" ? "uploaded" : "drawn" },
    };
  }

  try {
    const { saved, previousFiles, previousPhoto } = await saveWork(
      { studentId: student.studentId, courseCode: course.code, unitCode: unit.code, part: mod.id },
      { studentName: student.name, unitTitle: unit.title },
      { status: mode === "submit" ? "Submitted" : "Draft", content, files, photo },
    );
    // Files the student took off a draft (and a replaced photo) are no longer needed
    const kept = new Set(files.map((f) => f.id));
    await deleteUploads(previousFiles.filter((f) => !kept.has(f.id)).map((f) => f.id));
    if (previousPhoto && previousPhoto.id !== photo?.id && mode === "submit") await deleteUploads([previousPhoto.id]);
    if (mode === "submit") await logActivity(student.name, `submitted “${mod.title}” for ${unit.code}`, "student");
    await logStudent({
      studentId: student.studentId,
      studentName: student.name,
      courseCode: course.code,
      unitCode: unit.code,
      action: mode === "draft" ? "Saved draft" : saved.attempt > 1 ? "Resubmitted" : "Submitted",
      detail: `${mod.title} · ${files.map((f) => f.name).join(", ") || (mod.activities.length ? `${mod.activities.length} activities` : "no files")}${mode === "submit" ? " · declaration signed" : ""}`,
    });
    revalidatePath("/dashboard", "layout");
    revalidatePath("/trainer", "layout");
    revalidatePath("/superadmin", "layout");
    return { ok: true, submission: saved };
  } catch (err) {
    if (err instanceof LockedError) return { ok: false, error: err.message };
    throw err;
  }
}

// The student opened Resources or a module of a unit — for the activity log
export async function logUnitViewAction(courseCode: string, unitCode: string, itemKey: string): Promise<void> {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  const course = student && hasCourse(student, courseCode) ? await getCourse(courseCode) : null;
  const unit = course?.units.find((u) => u.code === unitCode);
  if (!student || !course || !unit) return;
  let label: string | null = itemKey === "resources" ? "Resources" : null;
  if (itemKey.startsWith("part:")) label = (await getAssessment(course.code, unit.code)).modules.find((m) => `part:${m.id}` === itemKey)?.title ?? null;
  if (!label) return;
  await logStudent(
    { studentId: student.studentId, studentName: student.name, courseCode: course.code, unitCode: unit.code, action: "Viewed", detail: label },
    30,
  );
}

/**
 * The student's response to published feedback: accept it with a signature, or ask for a review with a comment
 * (sent to the trainer currently assigned to that unit). It never changes the module result.
 */
export async function respondToFeedbackAction(
  submissionId: string,
  input: { state: "accepted" | "review"; comment?: string; signatureId?: string },
): Promise<Result> {
  const session = await requireStudent();
  const sub = await getSubmission(String(submissionId));
  if (!sub || sub.studentId !== session.sub) return { ok: false, error: "Work not found." };
  const comment = String(input?.comment ?? "").trim().slice(0, 2000);
  let signature = null;
  if (input?.state === "accepted") {
    const [sig] = input.signatureId ? await ownedUploads([String(input.signatureId)], session.sub) : [];
    if (!sig || !/\.(png|jpe?g)$/i.test(sig.name)) return { ok: false, error: "Sign to accept the feedback." };
    signature = sig;
  } else if (input?.state === "review") {
    if (!comment) return { ok: false, error: "Write what you’d like your trainer to review." };
  } else return { ok: false, error: "Choose accept or request review." };
  try {
    const saved = await respondToFeedback(sub.submissionId, session.sub, { state: input.state, comment, signature });
    await logActivity(sub.studentName, `${input.state === "accepted" ? "accepted the feedback on" : "asked for a review of"} ${sub.unitCode}`, "student");
    revalidatePath("/dashboard", "layout");
    revalidatePath("/trainer", "layout");
    return { ok: true, submission: saved };
  } catch (err) {
    if (err instanceof ResponseError) return { ok: false, error: err.message };
    throw err;
  }
}
