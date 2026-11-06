import "server-only";
import { listBatches } from "./groups";
import { getStudent, listStudents } from "./students";
import { trainerCanAccess } from "./unit-status-meta";

// Trainer visibility (LMS guide): a trainer may see a student's unit only while the student is CURRENTLY in a batch
// where that trainer is assigned to that unit. Applied to lists, submissions, downloads, feedback and direct URLs.

export async function trainerCanSee(trainerId: string, studentId: string, unitCode: string) {
  const [student, batches] = await Promise.all([getStudent(studentId), listBatches()]);
  return !!student && trainerCanAccess(trainerId, student.batchIds, unitCode, batches);
}

/** Everything a trainer may see: per student, the units (and course) they cover for that student right now */
export async function trainerScope(trainerId: string) {
  const [students, batches] = await Promise.all([listStudents(), listBatches()]);
  const units = new Map<string, Set<string>>(); // studentId → unit codes
  for (const b of batches) {
    const mine = b.trainers.find((t) => t.trainerId === trainerId)?.unitCodes ?? [];
    if (!mine.length) continue;
    for (const s of students.filter((x) => x.batchIds.includes(b.batchId))) {
      const set = units.get(s.studentId) ?? new Set<string>();
      mine.forEach((u) => set.add(u));
      units.set(s.studentId, set);
    }
  }
  return {
    batches: batches.filter((b) => b.trainers.some((t) => t.trainerId === trainerId)),
    students: students.filter((s) => units.has(s.studentId)),
    can: (studentId: string, unitCode: string) => !!units.get(studentId)?.has(unitCode),
    unitsOf: (studentId: string) => units.get(studentId) ?? new Set<string>(),
  };
}

/** Is the trainer assigned to this unit of this course in any batch? (for unit documents, not student work) */
export async function trainerTeachesUnit(trainerId: string, courseCode: string, unitCode: string) {
  return (await listBatches({ trainerId })).some((b) => b.courseCode === courseCode && b.trainers.some((t) => t.trainerId === trainerId && t.unitCodes.includes(unitCode)));
}
