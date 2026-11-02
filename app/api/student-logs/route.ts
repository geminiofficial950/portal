import { isAdminRequest } from "@/lib/auth";
import { logsToCsv } from "@/lib/student-log-csv";
import { listAllStudentLogs } from "@/lib/student-logs";

// Every student's activity log as one CSV file (Admins and Super Admin)
export async function GET() {
  if (!(await isAdminRequest())) return new Response("Only Admins can download logs.", { status: 403 });
  const logs = await listAllStudentLogs();
  return new Response(logsToCsv(logs), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("Activity log - all students.csv")}`,
      "Cache-Control": "private, no-store",
    },
  });
}
