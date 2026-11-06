import "server-only";
import type { ObjectId } from "mongodb";
import { getDb } from "./db";
import { listResultOptions } from "./result-options";
import { resolveResult } from "./result-meta";
import { isUnitStatus, unitAccess, type UnitRecord, type UnitStatus } from "./unit-status-meta";
import { listUnlockedUnits, setUnitsUnlocked } from "./unit-unlocks";

// A student's record for each unit of their course (LMS guide "Student course record"):
//   status   — Active / Inactive / Withdrawn / Cancelled / Deferred / Competent / Not Yet Competent (default Active)
//   opened   — admin opened it (stored as a "unitUnlocks" row, as before)
//   release  — a scheduled release time (opens by itself)
//   feedback — unit-level feedback, separate from module feedback
// Older final results (Pass / Fail / Withdrawn) are read as a status until a status is set.
type HistoryRow = { status: UnitStatus; by: string; role: "admin" | "trainer"; at: Date; note: string };
type RecordDoc = {
  _id?: ObjectId;
  studentId: string;
  courseCode: string;
  unitCode: string;
  status?: UnitStatus;
  releaseAt?: Date | null;
  feedback?: string;
  decidedBy?: string | null;
  decidedAt?: Date | null;
  history?: HistoryRow[];
};

export type FullUnitRecord = UnitRecord & { feedback: string; decidedBy: string | null; decidedAt: string | null };

let indexesReady: Promise<unknown> | undefined;

async function collection() {
  const col = (await getDb()).collection<RecordDoc>("unitRecords");
  indexesReady ??= col.createIndexes([{ key: { studentId: 1, courseCode: 1, unitCode: 1 }, unique: true }, { key: { courseCode: 1, unitCode: 1 } }]);
  await indexesReady;
  return col;
}

// Older final results → a unit status
async function legacyStatuses(studentIds: string[], courseCode: string) {
  const [docs, options] = await Promise.all([
    (await getDb()).collection<{ studentId: string; unitCode: string; result: string; feedback: string; decidedBy: string; decidedAt: Date }>("unitResults").find({ studentId: { $in: studentIds }, courseCode }).toArray(),
    listResultOptions(),
  ]);
  return docs.map((d) => {
    const r = resolveResult(d.result, options);
    const status: UnitStatus = isUnitStatus(r.label) ? r.label : r.kind === "pass" ? "Competent" : r.kind === "fail" ? "Not Yet Competent" : "Withdrawn";
    return { studentId: d.studentId, unitCode: d.unitCode, status, feedback: d.feedback, decidedBy: d.decidedBy, decidedAt: d.decidedAt };
  });
}

const merge = (doc: RecordDoc | undefined, opened: boolean, legacy: Awaited<ReturnType<typeof legacyStatuses>>[number] | undefined): FullUnitRecord => ({
  status: doc?.status ?? legacy?.status ?? "Active",
  opened,
  releaseAt: doc?.releaseAt ? doc.releaseAt.toISOString() : null,
  feedback: doc?.status ? (doc.feedback ?? "") : (legacy?.feedback ?? doc?.feedback ?? ""),
  decidedBy: doc?.status ? (doc.decidedBy ?? null) : (legacy?.decidedBy ?? null),
  decidedAt: doc?.status ? (doc.decidedAt?.toISOString() ?? null) : (legacy?.decidedAt?.toISOString() ?? null),
});

/** Every unit record of one student in one course, by unit code (units never touched are simply absent: Active, not opened) */
export async function listUnitRecords(studentId: string, courseCode: string): Promise<Record<string, FullUnitRecord>> {
  const [docs, opened, legacy] = await Promise.all([
    (await collection()).find({ studentId, courseCode }).toArray(),
    listUnlockedUnits(studentId, courseCode),
    legacyStatuses([studentId], courseCode),
  ]);
  const units = new Set([...docs.map((d) => d.unitCode), ...opened, ...legacy.map((l) => l.unitCode)]);
  return Object.fromEntries(
    [...units].map((u) => [u, merge(docs.find((d) => d.unitCode === u), opened.has(u), legacy.find((l) => l.unitCode === u))]),
  );
}

export async function getUnitRecord(studentId: string, courseCode: string, unitCode: string): Promise<FullUnitRecord> {
  return (await listUnitRecords(studentId, courseCode))[unitCode] ?? merge(undefined, false, undefined);
}

/** The server-side access check: Active AND (opened OR released). Used by pages, actions and file downloads. */
export async function isUnitOpenFor(studentId: string, courseCode: string, unitCode: string, now = Date.now()) {
  return unitAccess(await getUnitRecord(studentId, courseCode, unitCode), now).open;
}

/** Records of one unit for many students (for batch planning and bulk previews) */
export async function listUnitRecordsFor(studentIds: string[], courseCode: string, unitCode: string): Promise<Record<string, FullUnitRecord>> {
  if (!studentIds.length) return {};
  const db = await getDb();
  const [docs, unlocks, legacy] = await Promise.all([
    (await collection()).find({ studentId: { $in: studentIds }, courseCode, unitCode }).toArray(),
    db.collection<{ studentId: string }>("unitUnlocks").find({ studentId: { $in: studentIds }, courseCode, unitCode }).toArray(),
    legacyStatuses(studentIds, courseCode),
  ]);
  const opened = new Set(unlocks.map((u) => u.studentId));
  return Object.fromEntries(
    studentIds.map((id) => [
      id,
      merge(
        docs.find((d) => d.studentId === id),
        opened.has(id),
        legacy.find((l) => l.studentId === id && l.unitCode === unitCode),
      ),
    ]),
  );
}

/** Records a unit status (and unit feedback). Work, module statuses and results are never touched: reactivating restores everything. */
export async function setUnitStatus(
  studentId: string,
  courseCode: string,
  unitCode: string,
  status: UnitStatus,
  by: { name: string; role: "admin" | "trainer" },
  feedback?: string,
) {
  const at = new Date();
  await (await collection()).updateOne(
    { studentId, courseCode, unitCode },
    {
      $set: { status, decidedBy: by.name, decidedAt: at, ...(feedback !== undefined && { feedback }) },
      $push: { history: { status, by: by.name, role: by.role, at, note: feedback ?? "" } },
    },
    { upsert: true },
  );
}

/**
 * Admin opens a unit for these students now, schedules it (`releaseAt`), or closes it again (`open: false`).
 * Status is not changed here — a non-active unit stays hidden even when opened.
 */
export async function setUnitOpening(studentIds: string[], courseCode: string, unitCode: string, change: { open: boolean; releaseAt?: Date | null }, by: string) {
  if (!studentIds.length) return;
  const col = await collection();
  await Promise.all(
    studentIds.map(async (studentId) => {
      await setUnitsUnlocked(studentId, courseCode, [unitCode], change.open, by);
      await col.updateOne({ studentId, courseCode, unitCode }, { $set: { releaseAt: change.open ? null : (change.releaseAt ?? null) } }, { upsert: true });
    }),
  );
}
