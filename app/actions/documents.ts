"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { logStudent } from "@/lib/student-logs";
import { adminActor, requireAdmin, requireStaff, requireStudent } from "@/lib/auth";
import { trainerScope } from "@/lib/trainer-access";
import { getCourse, setPlacementText } from "@/lib/courses";
import {
  checkDocReview,
  cleanLine,
  DOC_NOTE_MAX,
  DOC_TITLE_MAX,
  PLACEMENT_DOC_TYPES,
  PLACEMENT_TEXT_MAX,
  type DocumentRequestDTO,
  type PlacementDocDTO,
  SIGNED_UPLOADS_MAX,
  type SignedDocDTO,
} from "@/lib/document-meta";
import {
  addPlacementDoc,
  createRequest,
  deleteRequest,
  fulfilRequest,
  getPlacementDoc,
  getRequest,
  listPlacementDocs,
  addSignedDoc,
  removePlacementDoc,
  reviewRequest,
  reviewSignedDoc,
  TooManySignedError,
} from "@/lib/documents";
import { ownedUploads } from "@/lib/files";
import { getStudent, hasCourse } from "@/lib/students";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const refresh = (studentId?: string) => {
  revalidatePath("/dashboard/course");
  revalidatePath("/superadmin/courses", "layout");
  if (studentId) revalidatePath(`/superadmin/students/${studentId}`);
};

// ---------- Super Admin: placement documents and text per course ----------

// `section`: "course" = a course document students download; "placement" = a placement-pack form they complete and upload back
export async function addPlacementDocAction(
  courseCode: string,
  titleIn: string,
  fileId: string,
  extra: { section?: "course" | "placement"; instructions?: string } = {},
): Promise<Result<{ doc: PlacementDocDTO }>> {
  const session = await requireAdmin();
  const title = cleanLine(titleIn, DOC_TITLE_MAX);
  if (!title) return { ok: false, error: "Pick which document this is." };
  if (!(await getCourse(courseCode))) return { ok: false, error: "Course not found." };
  const section = extra.section === "course" ? "course" : "placement";
  const instructions = String(extra.instructions ?? "").trim().slice(0, DOC_NOTE_MAX);
  // Each document name is used once per course
  const existing = await listPlacementDocs([courseCode]);
  if (existing.some((d) => d.title.toLowerCase() === title.toLowerCase())) {
    const standard = PLACEMENT_DOC_TYPES.some((t) => t.toLowerCase() === title.toLowerCase());
    return { ok: false, error: `${title} is already uploaded${standard ? " — remove it first to upload a new one" : ". Use a different name"}.` };
  }
  const [file] = await ownedUploads([String(fileId)], session.sub);
  if (!file) return { ok: false, error: "Upload the document first." };
  const doc = await addPlacementDoc(courseCode, title, file, { section, instructions });
  await logActivity(await adminActor(), `added the placement document “${title}” to ${courseCode}`, "course");
  refresh();
  return { ok: true, doc };
}

export async function removePlacementDocAction(docId: string): Promise<Result> {
  await requireAdmin();
  if (!(await removePlacementDoc(docId))) return { ok: false, error: "Document not found." };
  refresh();
  return { ok: true };
}

export async function savePlacementTextAction(courseCode: string, textIn: string): Promise<Result<{ text: string }>> {
  await requireAdmin();
  const text = String(textIn ?? "").trim().slice(0, PLACEMENT_TEXT_MAX);
  if (!(await setPlacementText(courseCode, text))) return { ok: false, error: "Course not found." };
  refresh();
  return { ok: true, text };
}

// ---------- Super Admin: ask one student for a document ----------

export async function requestDocumentAction(studentId: string, nameIn: string, noteIn: string, dueIn?: string | null): Promise<Result<{ request: DocumentRequestDTO }>> {
  await requireAdmin();
  const name = cleanLine(nameIn, DOC_TITLE_MAX);
  if (!name) return { ok: false, error: "Write which document you need." };
  const student = await getStudent(studentId);
  if (!student) return { ok: false, error: "Student not found." };
  let dueAt: Date | null = null;
  if (dueIn) {
    dueAt = new Date(dueIn);
    if (Number.isNaN(dueAt.getTime())) return { ok: false, error: "Choose a valid due date." };
  }
  const request = await createRequest(student.studentId, name, cleanLine(noteIn, DOC_NOTE_MAX), dueAt);
  await logActivity(await adminActor(), `asked ${student.name} for “${name}”`, "student");
  refresh(student.studentId);
  return { ok: true, request };
}

export async function deleteRequestAction(requestId: string): Promise<Result> {
  await requireAdmin();
  const request = await getRequest(requestId);
  if (!request || !(await deleteRequest(requestId))) return { ok: false, error: "Request not found." };
  refresh(request.studentId);
  return { ok: true };
}

// ---------- Staff: review a student's uploaded document ----------
// Approver: admin, or a trainer who currently has the student in one of their batches (default until the college decides)

async function reviewer(studentId: string) {
  const staff = await requireStaff();
  if (staff.role === "trainer" && !(await trainerScope(staff.id)).unitsOf(studentId).size) return null;
  return staff.role === "admin" ? staff.name : `${staff.name} · Trainer`;
}

export async function reviewSignedDocAction(studentId: string, docId: string, status: string, comment: string): Promise<Result<{ signed: SignedDocDTO }>> {
  const by = await reviewer(String(studentId));
  if (!by) return { ok: false, error: "This student isn’t in your batches." };
  const checked = checkDocReview(status, comment);
  if (!checked.ok) return checked;
  const signed = await reviewSignedDoc(String(studentId), String(docId), { status: checked.status, comment: checked.comment, by });
  if (!signed) return { ok: false, error: "Nothing uploaded to review." };
  refresh(String(studentId));
  return { ok: true, signed };
}

export async function reviewRequestAction(requestId: string, status: string, comment: string): Promise<Result<{ request: DocumentRequestDTO }>> {
  const current = await getRequest(String(requestId));
  if (!current) return { ok: false, error: "Request not found." };
  const by = await reviewer(current.studentId);
  if (!by) return { ok: false, error: "This student isn’t in your batches." };
  const checked = checkDocReview(status, comment);
  if (!checked.ok) return checked;
  const request = await reviewRequest(current.requestId, { status: checked.status, comment: checked.comment, by });
  if (!request) return { ok: false, error: "Nothing uploaded to review." };
  refresh(current.studentId);
  return { ok: true, request };
}

// ---------- Student: upload a signed placement form or a requested document ----------

async function activeStudent() {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  return student?.status === "Active" ? student : null;
}

export async function uploadSignedDocAction(docId: string, fileId: string): Promise<Result<{ signed: SignedDocDTO }>> {
  const student = await activeStudent();
  if (!student) return { ok: false, error: "Your account isn’t active." };
  const doc = await getPlacementDoc(docId);
  if (!doc || !hasCourse(student, doc.courseCode)) return { ok: false, error: "This document isn’t for your course." };
  if (doc.section === "course") return { ok: false, error: "This course document is for reading only." };
  const [file] = await ownedUploads([String(fileId)], student.studentId);
  if (!file) return { ok: false, error: "Your file didn’t upload — try again." };
  let signed: SignedDocDTO;
  try {
    signed = await addSignedDoc(student.studentId, doc, file);
  } catch (err) {
    if (err instanceof TooManySignedError) return { ok: false, error: `You can upload up to ${SIGNED_UPLOADS_MAX} files for one form.` };
    throw err;
  }
  await logActivity(student.name, `uploaded the signed “${doc.title}”`, "student");
  await logStudent({ studentId: student.studentId, studentName: student.name, courseCode: doc.courseCode, action: "Uploaded signed document", detail: `${doc.title} · ${file.name}` });
  refresh(student.studentId);
  return { ok: true, signed };
}

export async function uploadRequestedDocAction(requestId: string, fileId: string): Promise<Result<{ request: DocumentRequestDTO }>> {
  const student = await activeStudent();
  if (!student) return { ok: false, error: "Your account isn’t active." };
  const request = await getRequest(requestId);
  if (!request || request.studentId !== student.studentId) return { ok: false, error: "This request isn’t for you." };
  const [file] = await ownedUploads([String(fileId)], student.studentId);
  if (!file) return { ok: false, error: "Your file didn’t upload — try again." };
  const saved = await fulfilRequest(requestId, file);
  if (!saved) return { ok: false, error: "This request isn’t for you." };
  await logActivity(student.name, `uploaded the requested “${request.name}”`, "student");
  await logStudent({ studentId: student.studentId, studentName: student.name, action: "Uploaded requested document", detail: `${request.name} · ${file.name}` });
  refresh(student.studentId);
  return { ok: true, request: saved };
}
