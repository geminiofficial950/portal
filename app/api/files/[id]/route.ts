import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { findAssessmentFile } from "@/lib/assessments";
import { findPlacementFile } from "@/lib/documents";
import { isUnitHidden } from "@/lib/hidden-units";
import { trainerCanSee, trainerTeachesUnit } from "@/lib/trainer-access";
import { isUnitOpenFor } from "@/lib/unit-records";
import { getUpload } from "@/lib/files";
import { getSession } from "@/lib/session";
import { logStudent } from "@/lib/student-logs";
import { getStudent, hasCourse } from "@/lib/students";
import { findSubmissionWithFile } from "@/lib/submissions";
import { getTrainer } from "@/lib/trainers";
import { findResourceFile } from "@/lib/unit-content";

// Who may download a file:
// - Super Admin: anything
// - a student: their own uploads, and resources, task documents and placement forms of their own courses
// - an active trainer: work of students currently in their batch for their assigned units, and documents of units they teach
// `?inline=1` shows a PDF or image in the page (the unit viewer) instead of downloading it.
export async function GET(req: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return new Response("Please log in.", { status: 401 });

  const file = await getUpload(id);
  if (!file) return new Response("File not found.", { status: 404 });

  let allowed = session.role === "admin";
  let logged: { courseCode: string; unitCode: string | null; studentName: string } | null = null; // a college file a student opened
  if (!allowed && session.role === "student") {
    if (file.ownerId === session.sub) allowed = true;
    else {
      const [resource, task, placement] = await Promise.all([findResourceFile(id), findAssessmentFile(id), findPlacementFile(id)]);
      const unitFile = resource ?? task;
      const courseCode = unitFile?.courseCode ?? placement?.courseCode;
      const student = courseCode ? await getStudent(session.sub) : null;
      allowed = !!courseCode && student?.status === "Active" && hasCourse(student, courseCode);
      if (allowed && unitFile) {
        allowed =
          !(await isUnitHidden(session.sub, unitFile.courseCode, unitFile.unitCode)) &&
          // unit Active AND opened by admin (or released)
          (await isUnitOpenFor(session.sub, unitFile.courseCode, unitFile.unitCode));
      }
      if (allowed && courseCode) logged = { courseCode, unitCode: unitFile?.unitCode ?? null, studentName: student!.name };
    }
  }
  // A trainer: student work only for students currently in their batch, in units assigned to them; unit
  // documents only for units they are assigned to in some batch. Old batches give no access after a transfer.
  if (!allowed && session.role === "trainer") {
    const trainer = await getTrainer(session.sub);
    if (trainer?.active) {
      const sub = await findSubmissionWithFile(id);
      if (sub) allowed = await trainerCanSee(trainer.trainerId, sub.studentId, sub.unitCode);
      else {
        const unitFile = (await findResourceFile(id)) ?? (await findAssessmentFile(id));
        allowed = !!unitFile && (await trainerTeachesUnit(trainer.trainerId, unitFile.courseCode, unitFile.unitCode));
      }
    }
  }
  if (!allowed) return new Response("You can’t open this file.", { status: 403 });

  const inline =
    req.nextUrl.searchParams.get("inline") === "1" && (file.contentType === "application/pdf" || file.contentType.startsWith("image/"));
  if (logged) {
    await logStudent({ studentId: session.sub, ...logged, action: inline ? "Opened file" : "Downloaded file", detail: file.name }, 60);
  }
  return new Response(Readable.toWeb(file.open()) as ReadableStream, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "X-Frame-Options": "SAMEORIGIN",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
