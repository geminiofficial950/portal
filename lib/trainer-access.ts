import "server-only";
import { listBatches } from "./groups";
import { getStudent, listStudents } from "./students";
import { trainerCanAccess } from "./unit-status-meta";
import { imageUrl } from "./display-image-meta";

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

export type StudentTrainer = { trainerId: string; name: string; email: string; batch: string; unitCodes: string[]; photo: string | null };

/**
 * The trainers a student sees on My courses: active trainers of the student's CURRENT batches for this course,
 * each with the units they cover. One entry per trainer (units merged across batches).
 */
export async function studentCourseTrainers(batchIds: string[], courseCode: string): Promise<StudentTrainer[]> {
  if (!batchIds.length) return [];
  const [{ listTrainers }, batches] = await Promise.all([import("./trainers"), listBatches()]);
  const trainers = new Map((await listTrainers()).filter((t) => t.active).map((t) => [t.trainerId, t]));
  const out = new Map<string, StudentTrainer>();
  for (const b of batches) {
    if (b.courseCode !== courseCode || !batchIds.includes(b.batchId)) continue;
    for (const a of b.trainers) {
      const t = trainers.get(a.trainerId);
      if (!t) continue;
      const row = out.get(t.trainerId) ?? { trainerId: t.trainerId, name: t.name, email: t.email, batch: b.name, unitCodes: [], photo: imageUrl(t.photo) };
      row.unitCodes = [...new Set([...row.unitCodes, ...a.unitCodes])];
      out.set(t.trainerId, row);
    }
  }
  return [...out.values()];
}

/** Is the trainer assigned to this unit of this course in any batch? (for unit documents, not student work) */
export async function trainerTeachesUnit(trainerId: string, courseCode: string, unitCode: string) {
  return (await listBatches({ trainerId })).some((b) => b.courseCode === courseCode && b.trainers.some((t) => t.trainerId === trainerId && t.unitCodes.includes(unitCode)));
}
