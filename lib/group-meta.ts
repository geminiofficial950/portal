// Shared by server code and client components (no server-only imports here).

export type GroupDTO = { groupId: string; name: string; students: number };

export const GROUP_NAME_MAX = 60;

// Student IDs typed by Super Admin: letters, digits and dashes. "T" + digits (trainers) and "A" + digits (Admins)
// are kept for staff, because login tries staff IDs first.
export const STUDENT_ID_MAX = 20;
export function checkStudentId(raw: string): { id: string } | { error: string } {
  const id = raw.trim().toUpperCase();
  if (id.length < 2 || id.length > STUDENT_ID_MAX) return { error: `Student ID must be 2–${STUDENT_ID_MAX} characters.` };
  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(id)) return { error: "Student ID can only use letters, numbers and dashes." };
  if (/^T\d+$/.test(id)) return { error: "IDs like T001 are for trainers. Pick a different student ID." };
  if (/^A\d+$/.test(id)) return { error: "IDs like A001 are for Admins. Pick a different student ID." };
  return { id };
}
