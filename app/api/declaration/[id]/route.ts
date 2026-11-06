import { trainerCanSee } from "@/lib/trainer-access";
import { partLabel } from "@/lib/assessment-meta";
import { getAssessment } from "@/lib/assessments";
import type { NextRequest } from "next/server";
import { getCourse } from "@/lib/courses";
import { buildDeclarationPdf } from "@/lib/declaration-pdf";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getStudent } from "@/lib/students";
import { getSubmission } from "@/lib/submissions";
import { getTrainer } from "@/lib/trainers";

// Downloads a declaration certificate as a PDF file (with the submit photo).
// Allowed: the student it belongs to, Super Admin, Admins and active trainers.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/declaration/[id]">) {
  const session = await getSession();
  if (!session) return new Response("Please log in.", { status: 401 });
  const sub = await getSubmission((await ctx.params).id);
  if (!sub?.content.declaration) return new Response("Declaration not found.", { status: 404 });

  const allowed =
    session.role === "admin" ||
    (session.role === "student" && session.sub === sub.studentId) ||
    (session.role === "trainer" && !!(await getTrainer(session.sub))?.active && (await trainerCanSee(session.sub, sub.studentId, sub.unitCode)));
  if (!allowed) return new Response("You can’t open this declaration.", { status: 403 });

  const [student, course, { college }, assessment] = await Promise.all([
    getStudent(sub.studentId),
    getCourse(sub.courseCode),
    getSettings(),
    getAssessment(sub.courseCode, sub.unitCode),
  ]);
  const moduleTitle = partLabel(assessment, sub.part);
  const bytes = await buildDeclarationPdf(sub, {
    studentName: student?.name ?? sub.studentName,
    courseName: course?.name ?? sub.courseCode,
    withPhoto: true,
    moduleTitle,
    college,
  });
  const name = `${moduleTitle} Declaration - ${sub.studentId} - ${sub.unitCode}.pdf`.replace(/[\/:*?"<>|]/g, "_");
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
