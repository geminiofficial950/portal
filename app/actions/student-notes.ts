"use server";

import { requireStaff } from "@/lib/auth";
import { addStudentNote, NOTE_MAX, trainersOfStudent, type StudentNoteDTO } from "@/lib/student-notes";
import { getStudent } from "@/lib/students";
import { trainerScope } from "@/lib/trainer-access";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Admin or trainer adds a note about a student. Admins pick which of the student's trainers can see it;
// a trainer's note goes to the Admins.
export async function addStudentNoteAction(studentId: string, text: string, trainerIds: string[] = []): Promise<Result<{ note: StudentNoteDTO }>> {
  const staff = await requireStaff();
  const body = String(text ?? "").trim();
  if (!body) return { ok: false, error: "Write the note first." };
  if (body.length > NOTE_MAX) return { ok: false, error: `Keep the note under ${NOTE_MAX} characters.` };
  const student = await getStudent(String(studentId));
  if (!student) return { ok: false, error: "Student not found." };

  if (staff.role === "trainer") {
    const scope = await trainerScope(staff.id);
    if (!scope.unitsOf(student.studentId).size) return { ok: false, error: "This student isn’t in your batches." };
    const note = await addStudentNote({ studentId: student.studentId, text: body, byRole: "trainer", byId: staff.id, byName: staff.name, trainerIds: [], trainerNames: [] });
    return { ok: true, note };
  }

  const options = await trainersOfStudent(student.studentId);
  const picked = [...new Set((Array.isArray(trainerIds) ? trainerIds : []).map(String))];
  const chosen = options.filter((t) => picked.includes(t.trainerId));
  if (chosen.length !== picked.length) return { ok: false, error: "A chosen trainer isn’t one of this student’s trainers." };
  if (options.length && !chosen.length) return { ok: false, error: "Choose at least one trainer to see the note." };
  const note = await addStudentNote({
    studentId: student.studentId,
    text: body,
    byRole: "admin",
    byId: staff.id,
    byName: staff.name,
    trainerIds: chosen.map((t) => t.trainerId),
    trainerNames: chosen.map((t) => t.name),
  });
  return { ok: true, note };
}
