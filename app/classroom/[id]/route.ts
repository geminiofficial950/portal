import { getClassLink } from "@/lib/classroom";
import { getMeeting } from "@/lib/meetings";
import { meetingEnd } from "@/lib/meetings-meta";
import { getSession } from "@/lib/session";
import { logStudent } from "@/lib/student-logs";
import { getStudent, hasCourse } from "@/lib/students";

// "Join": a class link or a scheduled meeting. Checks the student is in the course (and, for a one-to-one meeting,
// that it's theirs), notes it in their activity log, then sends them to Google Meet. Staff can open it too (to try the link).
export async function GET(req: Request, ctx: RouteContext<"/classroom/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return Response.redirect(new URL("/", req.url), 303);

  const [link, meeting] = await Promise.all([getClassLink(id), getMeeting(id)]);
  const target = link ?? meeting;
  if (!target) return new Response("This class or meeting was removed. Go back to Classroom for the current ones.", { status: 404 });

  if (session.role === "student") {
    const student = await getStudent(session.sub);
    const allowed =
      student?.status === "Active" && hasCourse(student, target.courseCode) && (!meeting?.studentId || meeting.studentId === student.studentId);
    if (!allowed) return new Response("This isn’t for you.", { status: 403 });
    if (meeting && Date.now() >= meetingEnd(meeting)) return new Response("This meeting has ended.", { status: 410 });
    await logStudent(
      { studentId: student.studentId, studentName: student.name, courseCode: target.courseCode, action: meeting ? "Joined meeting" : "Joined class", detail: target.title },
      60,
    );
  }
  return new Response(null, { status: 303, headers: { Location: target.url, "Cache-Control": "no-store" } });
}
