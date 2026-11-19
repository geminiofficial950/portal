import { getSession } from "@/lib/session";
import { listStudentNotifications } from "@/lib/student-notifications";

export async function GET() {
  const session = await getSession();
  if (session?.role !== "student") return new Response(null, { status: 401 });

  return Response.json(await listStudentNotifications(session.sub), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
