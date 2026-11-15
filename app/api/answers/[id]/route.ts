import type { NextRequest } from "next/server";
import { buildAnswersPdf } from "@/lib/answers-pdf";
import { getAssessment } from "@/lib/assessments";
import { getCourse } from "@/lib/courses";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getStudent } from "@/lib/students";
import { getSubmission } from "@/lib/submissions";
import { trainerCanSee } from "@/lib/trainer-access";
import { getTrainer } from "@/lib/trainers";

// Downloads a student's online answers for one module (a quiz and other online activities) as a PDF.
// Staff only — Super Admin, Admins and the active trainers who can see the student — since it shows the
// reference answers admin set. Only handed-in work (never a draft in progress).
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/answers/[id]">) {
  const session = await getSession();
  if (!session) return new Response("Please log in.", { status: 401 });
  const sub = await getSubmission((await ctx.params).id);
  if (!sub || sub.status === "Draft" || !sub.submittedAt) return new Response("Submitted work not found.", { status: 404 });

  const allowed =
    session.role === "admin" ||
    (session.role === "trainer" && !!(await getTrainer(session.sub))?.active && (await trainerCanSee(session.sub, sub.studentId, sub.unitCode)));
  if (!allowed) return new Response("You can’t download this student’s answers.", { status: 403 });

  const [student, course, { college }, assessment] = await Promise.all([
    getStudent(sub.studentId),
    getCourse(sub.courseCode),
    getSettings(),
    getAssessment(sub.courseCode, sub.unitCode),
  ]);
  const mod = assessment.modules.find((m) => m.id === sub.part);
  if (!mod?.activities.length) return new Response("This module has no online answers to download.", { status: 404 });

  const bytes = await buildAnswersPdf(sub, mod, {
    studentName: student?.name ?? sub.studentName,
    courseName: course?.name ?? sub.courseCode,
    college,
  });
  const name = `${mod.title} Answers - ${sub.studentId} - ${sub.unitCode}.pdf`.replace(/[\/:*?"<>|]/g, "_");
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
