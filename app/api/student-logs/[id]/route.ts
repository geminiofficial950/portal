import type { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { logsToCsv } from "@/lib/student-log-csv";
import { listStudentLogs } from "@/lib/student-logs";

// One student's activity log as a CSV file (Admins and Super Admin). `?course=` narrows it to one course.
export async function GET(req: NextRequest, ctx: RouteContext<"/api/student-logs/[id]">) {
  if (!(await isAdminRequest())) return new Response("Only Admins can download logs.", { status: 403 });
  const studentId = decodeURIComponent((await ctx.params).id);
  const course = req.nextUrl.searchParams.get("course");
  const logs = await listStudentLogs(studentId, { courseCode: course, limit: 50000 });
  const name = `Activity log - ${studentId}${course ? ` - ${course}` : ""}.csv`;
  return new Response(logsToCsv(logs), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
