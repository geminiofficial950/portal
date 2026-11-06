import "server-only";
import { getDb } from "./db";

// What a deletion would touch — shown to Super Admin before they confirm (LMS guide: show affected records first,
// never cascade silently). Records are kept: deleting a student removes their login and profile only.

export type AffectedRecords = { label: string; count: number }[];

export async function studentRecords(studentId: string): Promise<AffectedRecords> {
  const db = await getDb();
  const n = (col: string, filter: object) => db.collection(col).countDocuments(filter);
  const [subs, units, ext, signed, requests, logs] = await Promise.all([
    n("submissions", { studentId }),
    n("unitRecords", { studentId }),
    n("extensionRequests", { studentId }),
    n("placementSigned", { studentId }),
    n("documentRequests", { studentId }),
    n("studentLogs", { studentId }),
  ]);
  return [
    { label: "submissions (with declarations, photos and signatures)", count: subs },
    { label: "unit statuses and feedback", count: units },
    { label: "extension requests", count: ext },
    { label: "signed placement documents", count: signed },
    { label: "requested documents", count: requests },
    { label: "activity log entries", count: logs },
  ];
}

export async function unitRecords(courseCode: string, unitCode: string): Promise<AffectedRecords> {
  const db = await getDb();
  const n = (col: string, filter: object) => db.collection(col).countDocuments(filter);
  const [subs, students, ext] = await Promise.all([
    n("submissions", { courseCode, unitCode }),
    n("unitRecords", { courseCode, unitCode }),
    n("extensionRequests", { courseCode, unitCode }),
  ]);
  return [
    { label: "student submissions", count: subs },
    { label: "student unit statuses", count: students },
    { label: "extension requests", count: ext },
  ];
}
