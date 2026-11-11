// Shared by server code and client components (no server-only imports here).

export type GroupDTO = { groupId: string; name: string; students: number };

export const GROUP_NAME_MAX = 60;

// Student IDs typed by Super Admin: letters, digits and dashes. "T" + digits (trainers) and "A" + digits (Admins)
// are kept for staff, because login tries staff IDs first.
// Trainer IDs (T001… by default; Super Admin may change one): same characters as student IDs, never an Admin-style ID
export function checkTrainerId(raw: string): { id: string } | { error: string } {
  const id = raw.trim().toUpperCase();
  if (id.length < 2 || id.length > STUDENT_ID_MAX) return { error: `Trainer ID must be 2–${STUDENT_ID_MAX} characters.` };
  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(id)) return { error: "Trainer ID can only use letters, numbers and dashes." };
  if (/^A\d+$/.test(id)) return { error: "IDs like A001 are for Admins. Pick a different trainer ID." };
  return { id };
}

// A login email (students and trainers sign in with their email or their ID)
export function checkLoginEmail(raw: string): { email: string } | { error: string } {
  const email = raw.trim().toLowerCase();
  if (!email || email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  return { email };
}

export const STUDENT_ID_MAX = 20;
export function checkStudentId(raw: string): { id: string } | { error: string } {
  const id = raw.trim().toUpperCase();
  if (id.length < 2 || id.length > STUDENT_ID_MAX) return { error: `Student ID must be 2–${STUDENT_ID_MAX} characters.` };
  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(id)) return { error: "Student ID can only use letters, numbers and dashes." };
  if (/^T\d+$/.test(id)) return { error: "IDs like T001 are for trainers. Pick a different student ID." };
  if (/^A\d+$/.test(id)) return { error: "IDs like A001 are for Admins. Pick a different student ID." };
  return { id };
}
