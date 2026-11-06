import "server-only";
import { getCourse, listCourses } from "@/lib/courses";
import { getBatch, listBatches } from "@/lib/groups";
import { listStudents } from "@/lib/students";
import { listTrainers } from "@/lib/trainers";
import { listSessions } from "@/lib/class-sessions";
import { listCourseAssessments } from "@/lib/assessments";
import { markableModules } from "@/lib/module-meta";
import { listUnitRecordsFor } from "@/lib/unit-records";
import { unitAccess } from "@/lib/unit-status-meta";
import type { BatchDetailData } from "./BatchDetail";

// Everything the batch page needs: details, the training plan (each unit: who covers it, how many students it's open for,
// any scheduled release, non-active statuses), the students, who could join, other batches of the course and the trainers.
export async function loadBatchDetail(batchId: string, now = Date.now()): Promise<BatchDetailData | null> {
  const batch = await getBatch(batchId);
  if (!batch) return null;
  const [course, students, trainers, batches, courses] = await Promise.all([
    batch.courseCode ? getCourse(batch.courseCode) : null,
    listStudents(),
    listTrainers(),
    listBatches(),
    listCourses(),
  ]);
  const byId = new Map(batches.map((b) => [b.batchId, b]));
  const trainerName = (id: string) => trainers.find((t) => t.trainerId === id)?.name ?? id;
  const members = students.filter((s) => s.batchIds.includes(batch.batchId));
  const row = (s: (typeof students)[number]) => ({
    studentId: s.studentId,
    name: s.name,
    email: s.email,
    account: s.status,
    courseStatus: s.courses.find((c) => c.code === batch.courseCode)?.status ?? "Active",
    enrolled: s.courses.some((c) => c.code === batch.courseCode), // false: in the batch but not enrolled in its course (older data)
    currentBatch: s.batchIds.map((id) => byId.get(id)).find((b) => b && b.courseCode === batch.courseCode && b.batchId !== batch.batchId)?.name ?? null,
  });

  const plan = await Promise.all(
    (course?.units ?? []).map(async (u, i) => {
      const recs = batch.courseCode ? await listUnitRecordsFor(members.map((m) => m.studentId), batch.courseCode, u.code) : {};
      const list = Object.values(recs);
      const releases = list.filter((r) => r.status === "Active" && !r.opened && r.releaseAt && Date.parse(r.releaseAt) > now).map((r) => r.releaseAt!);
      return {
        n: i + 1,
        code: u.code,
        title: u.title,
        assigned: batch.units.includes(u.code),
        trainers: batch.trainers.filter((t) => t.unitCodes.includes(u.code)).map((t) => trainerName(t.trainerId)),
        open: list.filter((r) => unitAccess(r, now).open).length,
        scheduled: releases.sort()[0] ?? null,
        nonActive: list.filter((r) => r.status !== "Active").length,
      };
    }),
  );

  return {
    batch,
    courseName: course?.name ?? null,
    plan,
    trainers: trainers.filter((t) => t.active).map((t) => ({ trainerId: t.trainerId, name: t.name })),
    members: members.map(row),
    candidates: students.filter((s) => batch.courseCode && s.courses.some((c) => c.code === batch.courseCode) && !s.batchIds.includes(batch.batchId)).map(row),
    otherBatches: batches.filter((b) => b.courseCode && b.courseCode === batch.courseCode && b.batchId !== batch.batchId).map((b) => ({ batchId: b.batchId, name: b.name })),
    courses: courses.map((c) => ({ code: c.code, name: c.name })),
    sessions: await listSessions([batch.batchId]),
    // marked modules of each unit with their default due date (for the Deadlines tab)
    modules: batch.courseCode
      ? Object.fromEntries(
          Object.entries(await listCourseAssessments(batch.courseCode)).map(([unit, a]) => [unit, markableModules(a.modules).map((m) => ({ id: m.id, title: m.title, dueAt: m.dueAt }))]),
        )
      : {},
  };
}
