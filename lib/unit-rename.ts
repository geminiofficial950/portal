import "server-only";
import { getDb } from "./db";

// Fixing a unit's code or name on a course (e.g. a typo). The name can always change. The code can only change while
// no student has anything in the unit — their work, statuses, results and dates are filed under the code, and
// evidence is never re-filed behind their back. When the code changes, the unit's own content follows it:
// modules, resources, batch plans / trainer assignments and scheduled class sessions.

const STUDENT_COLLECTIONS = ["submissions", "unitRecords", "unitResults", "unitUnlocks", "extensionRequests", "hiddenUnits", "studentDueDates", "moduleDueDates", "deadlineLog"];

/** How many student records sit under this unit (any of them blocks a code change) */
export async function studentRecordsInUnit(courseCode: string, unitCode: string) {
  const db = await getDb();
  const counts = await Promise.all(STUDENT_COLLECTIONS.map((c) => db.collection(c).countDocuments({ courseCode, unitCode })));
  return counts.reduce((a, b) => a + b, 0);
}

export type UnitEdit = "ok" | "not-found" | "duplicate" | "has-records";

export async function editUnit(courseCode: string, from: string, next: { code: string; title: string }): Promise<UnitEdit> {
  const db = await getDb();
  const courses = db.collection("courses");
  const course = await courses.findOne({ code: courseCode, "units.code": from });
  if (!course) return "not-found";
  const codeChanges = next.code !== from;
  if (codeChanges) {
    if ((course.units as { code: string }[]).some((u) => u.code === next.code)) return "duplicate";
    if ((await studentRecordsInUnit(courseCode, from)) > 0) return "has-records";
  }
  await courses.updateOne({ code: courseCode, "units.code": from }, { $set: { "units.$.code": next.code, "units.$.title": next.title } });
  if (!codeChanges) return "ok";

  const to = next.code;
  await Promise.all([
    db.collection("assessments").updateMany({ courseCode, unitCode: from }, { $set: { unitCode: to } }),
    db.collection("unitContent").updateMany({ courseCode, unitCode: from }, { $set: { unitCode: to } }),
    db.collection("classSessions").updateMany({ courseCode, unitCode: from }, { $set: { unitCode: to } }),
    db.collection("studentGroups").updateMany({ courseCode, units: from }, { $set: { "units.$[u]": to } }, { arrayFilters: [{ u: from }] }),
    db.collection("studentGroups").updateMany({ courseCode, "trainers.unitCodes": from }, { $set: { "trainers.$[].unitCodes.$[x]": to } }, { arrayFilters: [{ x: from }] }),
  ]);
  return "ok";
}
