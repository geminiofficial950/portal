import "server-only";
import { getDb } from "./db";

// Changing a student's or trainer's login email or ID (Super Admin only — see the actions). An ID is the key every
// record uses, so a new ID is carried across all of them: nothing of their work is left behind under the old ID.

// Collections that hold a student's ID in `studentId`
const STUDENT_REFS = [
  "submissions", "unitRecords", "unitUnlocks", "unitResults", "documentRequests", "placementSigned", "studentLogs",
  "studentNotifications", "extensionRequests", "moduleDueDates", "deadlineLog", "hiddenUnits", "studentDueDates", "tickets", "meetings",
];

export class IdentityTakenError extends Error {
  constructor(public what: "id" | "email") {
    super(what === "id" ? "That ID is already used by someone else." : "That email is already used by someone else.");
  }
}

// One ID / one email per person across students, trainers and Admins (login accepts either, so they must not clash)
async function assertFree(kind: "student" | "trainer", currentId: string, next: { id: string; email: string }) {
  const db = await getDb();
  const idTaken =
    (kind === "student" ? await db.collection("students").findOne({ studentId: next.id }) : await db.collection("trainers").findOne({ trainerId: next.id })) ??
    (kind === "student" ? await db.collection("trainers").findOne({ trainerId: next.id }) : await db.collection("students").findOne({ studentId: next.id })) ??
    (await db.collection("admins").findOne({ adminId: next.id }));
  if (next.id !== currentId && idTaken) throw new IdentityTakenError("id");
  const own = kind === "student" ? { studentId: currentId } : { trainerId: currentId };
  for (const col of ["students", "trainers", "admins"]) {
    const other = await db.collection(col).findOne({ email: next.email });
    if (!other) continue;
    const isSelf = (col === "students" && kind === "student" && other.studentId === own.studentId) || (col === "trainers" && kind === "trainer" && other.trainerId === own.trainerId);
    if (!isSelf) throw new IdentityTakenError("email");
  }
}

const isDup = (err: unknown) => (err as { code?: number }).code === 11000;

/** Returns null if the student doesn't exist; `moved` = how many related records were re-keyed to the new ID. */
export async function changeStudentLogin(studentId: string, next: { id: string; email: string }) {
  const db = await getDb();
  const doc = await db.collection("students").findOne({ studentId });
  if (!doc) return null;
  await assertFree("student", studentId, next);
  try {
    await db.collection("students").updateOne({ studentId }, { $set: { studentId: next.id, email: next.email } });
  } catch (err) {
    if (isDup(err)) throw new IdentityTakenError(String((err as Error).message).includes("email") ? "email" : "id");
    throw err;
  }
  let moved = 0;
  if (next.id !== studentId) {
    for (const col of STUDENT_REFS) moved += (await db.collection(col).updateMany({ studentId }, { $set: { studentId: next.id } })).modifiedCount;
    moved += (await db.collection("uploads.files").updateMany({ "metadata.ownerId": studentId }, { $set: { "metadata.ownerId": next.id } })).modifiedCount;
  }
  return { before: { id: studentId, email: String(doc.email) }, moved };
}

/** Returns null if the trainer doesn't exist; re-keys batch assignments, class sessions and their uploads. */
export async function changeTrainerLogin(trainerId: string, next: { id: string; email: string }) {
  const db = await getDb();
  const doc = await db.collection("trainers").findOne({ trainerId });
  if (!doc) return null;
  await assertFree("trainer", trainerId, next);
  try {
    await db.collection("trainers").updateOne({ trainerId }, { $set: { trainerId: next.id, email: next.email } });
  } catch (err) {
    if (isDup(err)) throw new IdentityTakenError(String((err as Error).message).includes("email") ? "email" : "id");
    throw err;
  }
  let moved = 0;
  if (next.id !== trainerId) {
    moved += (
      await db
        .collection("studentGroups")
        .updateMany({ "trainers.trainerId": trainerId }, { $set: { "trainers.$[t].trainerId": next.id } }, { arrayFilters: [{ "t.trainerId": trainerId }] })
    ).modifiedCount;
    moved += (await db.collection("classSessions").updateMany({ trainerId }, { $set: { trainerId: next.id } })).modifiedCount;
    moved += (await db.collection("uploads.files").updateMany({ "metadata.ownerId": trainerId }, { $set: { "metadata.ownerId": next.id } })).modifiedCount;
  }
  return { before: { id: trainerId, email: String(doc.email) }, moved };
}
