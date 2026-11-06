import "server-only";
import { randomUUID } from "node:crypto";
import type { ObjectId } from "mongodb";
import type { ExtensionRequestDTO, ExtensionStatus } from "./deadline-meta";
import { getDb } from "./db";

// Per-student module deadlines (exceptions to a module's default date), every change logged, and extension requests.
type DueDoc = { _id?: ObjectId; studentId: string; courseCode: string; unitCode: string; moduleId: string; dueAt: Date; setAt: Date; setBy: string };
type LogDoc = {
  _id?: ObjectId;
  studentId: string;
  courseCode: string;
  unitCode: string;
  moduleId: string;
  oldDue: Date | null;
  newDue: Date | null;
  by: string;
  role: "admin" | "trainer";
  reason: string;
  at: Date;
};
type RequestDoc = Omit<ExtensionRequestDTO, "proposedDue" | "decidedAt" | "newDue" | "createdAt"> & {
  _id?: ObjectId;
  proposedDue: Date;
  decidedAt: Date | null;
  newDue: Date | null;
  createdAt: Date;
};

export type DeadlineLogDTO = { moduleId: string; unitCode: string; oldDue: string | null; newDue: string | null; by: string; role: string; reason: string; at: string };

let ready: Promise<unknown> | undefined;

async function cols() {
  const db = await getDb();
  const dues = db.collection<DueDoc>("moduleDueDates");
  const log = db.collection<LogDoc>("deadlineLog");
  const requests = db.collection<RequestDoc>("extensionRequests");
  ready ??= Promise.all([
    dues.createIndex({ studentId: 1, courseCode: 1, unitCode: 1, moduleId: 1 }, { unique: true }),
    log.createIndex({ studentId: 1, courseCode: 1, at: -1 }),
    requests.createIndexes([
      { key: { requestId: 1 }, unique: true },
      // one pending request per student and module: a retry or double click can't make a second
      { key: { studentId: 1, courseCode: 1, unitCode: 1, moduleId: 1 }, unique: true, partialFilterExpression: { status: "Pending" }, name: "one_pending" },
      { key: { status: 1, createdAt: 1 } },
    ]),
  ]).catch((err) => {
    ready = undefined;
    throw err;
  });
  await ready;
  return { dues, log, requests };
}

const key = (unitCode: string, moduleId: string) => `${unitCode}/${moduleId}`;

/** "UNIT/MODULE" → this student's own deadline, for every module where they have one */
export async function listModuleDues(studentId: string, courseCode: string): Promise<Record<string, string>> {
  const docs = await (await cols()).dues.find({ studentId, courseCode }).toArray();
  return Object.fromEntries(docs.map((d) => [key(d.unitCode, d.moduleId), d.dueAt.toISOString()]));
}

export async function getModuleDue(studentId: string, courseCode: string, unitCode: string, moduleId: string) {
  const doc = await (await cols()).dues.findOne({ studentId, courseCode, unitCode, moduleId });
  return doc ? doc.dueAt.toISOString() : null;
}

/**
 * Gives these students their own deadline for one module (an individual or group exception), logging who, role,
 * reason, old and new date for each. Other students keep theirs; students added later get the module's default.
 * `oldDueOf` is each student's deadline before the change (for the log).
 */
export async function setModuleDues(
  studentIds: string[],
  where: { courseCode: string; unitCode: string; moduleId: string },
  dueAt: Date,
  by: { name: string; role: "admin" | "trainer"; reason: string },
  oldDueOf: (studentId: string) => string | null,
) {
  if (!studentIds.length) return;
  const { dues, log } = await cols();
  const at = new Date();
  await dues.bulkWrite(
    studentIds.map((studentId) => ({
      updateOne: { filter: { studentId, ...where }, update: { $set: { dueAt, setAt: at, setBy: by.name } }, upsert: true },
    })),
  );
  await log.insertMany(
    studentIds.map((studentId) => {
      const old = oldDueOf(studentId);
      return { studentId, ...where, oldDue: old ? new Date(old) : null, newDue: dueAt, by: by.name, role: by.role, reason: by.reason, at };
    }),
  );
}

export async function listDeadlineLog(studentId: string, courseCode: string): Promise<DeadlineLogDTO[]> {
  const docs = await (await cols()).log.find({ studentId, courseCode }).sort({ at: -1 }).limit(200).toArray();
  return docs.map((d) => ({
    moduleId: d.moduleId,
    unitCode: d.unitCode,
    oldDue: d.oldDue?.toISOString() ?? null,
    newDue: d.newDue?.toISOString() ?? null,
    by: d.by,
    role: d.role,
    reason: d.reason,
    at: d.at.toISOString(),
  }));
}

// ---------- Extension requests ----------

const reqDTO = (d: RequestDoc): ExtensionRequestDTO => ({
  requestId: d.requestId,
  studentId: d.studentId,
  studentName: d.studentName,
  courseCode: d.courseCode,
  unitCode: d.unitCode,
  moduleId: d.moduleId,
  moduleTitle: d.moduleTitle,
  reason: d.reason,
  proposedDue: d.proposedDue.toISOString(),
  status: d.status,
  decidedBy: d.decidedBy,
  decidedAt: d.decidedAt?.toISOString() ?? null,
  decisionReason: d.decisionReason,
  newDue: d.newDue?.toISOString() ?? null,
  createdAt: d.createdAt.toISOString(),
});

export class DuplicateRequestError extends Error {}

export async function createExtensionRequest(input: {
  studentId: string;
  studentName: string;
  courseCode: string;
  unitCode: string;
  moduleId: string;
  moduleTitle: string;
  reason: string;
  proposedDue: Date;
}) {
  const doc: RequestDoc = { requestId: randomUUID(), ...input, status: "Pending", decidedBy: null, decidedAt: null, decisionReason: "", newDue: null, createdAt: new Date() };
  try {
    await (await cols()).requests.insertOne(doc);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new DuplicateRequestError();
    throw err;
  }
  return reqDTO(doc);
}

export async function listExtensionRequests(filter: { studentId?: string; courseCode?: string; status?: ExtensionStatus } = {}) {
  const docs = await (await cols()).requests.find(filter).sort({ createdAt: -1 }).limit(500).toArray();
  return docs.map(reqDTO);
}

export async function getExtensionRequest(requestId: string) {
  const doc = await (await cols()).requests.findOne({ requestId: String(requestId) });
  return doc ? reqDTO(doc) : null;
}

/** Records the decision once (only a Pending request changes — a second click does nothing) */
export async function decideExtensionRequest(requestId: string, d: { approve: boolean; newDue: Date | null; reason: string; by: string }) {
  const doc = await (await cols()).requests.findOneAndUpdate(
    { requestId, status: "Pending" },
    { $set: { status: d.approve ? "Approved" : "Declined", newDue: d.newDue, decisionReason: d.reason, decidedBy: d.by, decidedAt: new Date() } },
    { returnDocument: "after" },
  );
  return doc ? reqDTO(doc) : null;
}

/**
 * Each module's deadline for one student in one course, "UNIT/MODULE" → ISO | null: their own module date, else an
 * older per-unit date Super Admin gave them, else the module's default.
 */
export async function studentModuleDues(studentId: string, courseCode: string): Promise<Record<string, string | null>> {
  const [{ listCourseAssessments }, { listStudentDueDates }] = await Promise.all([import("./assessments"), import("./due-dates")]);
  const [assessments, unitOverrides, moduleOverrides] = await Promise.all([
    listCourseAssessments(courseCode),
    listStudentDueDates(studentId, courseCode),
    listModuleDues(studentId, courseCode),
  ]);
  const out: Record<string, string | null> = {};
  for (const [unitCode, a] of Object.entries(assessments)) {
    for (const m of a.modules) out[key(unitCode, m.id)] = moduleOverrides[key(unitCode, m.id)] ?? unitOverrides[unitCode] ?? m.dueAt;
  }
  return out;
}

/** Log a change to a module's DEFAULT due date (applies to every student without their own date) */
export async function logDefaultDueChange(
  where: { courseCode: string; unitCode: string; moduleId: string },
  oldDue: string | null,
  newDue: string | null,
  by: { name: string; role: "admin" | "trainer"; reason: string },
) {
  await (await cols()).log.insertOne({
    studentId: "ALL",
    ...where,
    oldDue: oldDue ? new Date(oldDue) : null,
    newDue: newDue ? new Date(newDue) : null,
    by: by.name,
    role: by.role,
    reason: `Default date for every student without their own: ${by.reason}`,
    at: new Date(),
  });
}

/**
 * Staff explicitly chose to reset students' own dates for these modules (LMS guide: keep exceptions unless staff
 * chooses to reset them). Each removed exception is logged. Returns how many were reset.
 */
export async function resetModuleDues(courseCode: string, unitCode: string, moduleIds: string[], by: { name: string; role: "admin" | "trainer"; reason: string }, newDueOf: (moduleId: string) => string | null) {
  if (!moduleIds.length) return 0;
  const { dues, log } = await cols();
  const rows = await dues.find({ courseCode, unitCode, moduleId: { $in: moduleIds } }).toArray();
  if (!rows.length) return 0;
  await dues.deleteMany({ _id: { $in: rows.map((r) => r._id!) } });
  await log.insertMany(
    rows.map((r) => {
      const nd = newDueOf(r.moduleId);
      return { studentId: r.studentId, courseCode, unitCode, moduleId: r.moduleId, oldDue: r.dueAt, newDue: nd ? new Date(nd) : null, by: by.name, role: by.role, reason: `Own date reset to the module default: ${by.reason}`, at: new Date() };
    }),
  );
  return rows.length;
}
