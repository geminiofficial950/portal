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
    (session.role === "trainer" && !!(await getTrainer(session.sub))?.active);
  if (!allowed) return new Response("You can’t open this declaration.", { status: 403 });

  const [student, course, { college }] = await Promise.all([getStudent(sub.studentId), getCourse(sub.courseCode), getSettings()]);
  const bytes = await buildDeclarationPdf(sub, {
    studentName: student?.name ?? sub.studentName,
    courseName: course?.name ?? sub.courseCode,
    withPhoto: true,
    college,
  });
  const name = `${sub.part === "workplace" ? "Workplacement" : "Theory"} Declaration - ${sub.studentId} - ${sub.unitCode}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
