import { getSession as getClassSession } from "@/lib/class-sessions";
import { getSession } from "@/lib/session";
import { sessionIcs } from "@/lib/session-meta";
import { getSettings } from "@/lib/settings";
import { getStudent } from "@/lib/students";

// "Add to calendar": the class session as an .ics file — for a student of that batch, or staff
export async function GET(_req: Request, ctx: RouteContext<"/api/calendar/[id]">) {
  const auth = await getSession();
  if (!auth) return new Response("Please log in.", { status: 401 });
  const s = await getClassSession((await ctx.params).id);
  if (!s) return new Response("This class was removed.", { status: 404 });
  if (auth.role === "student") {
    const student = await getStudent(auth.sub);
    if (!student || student.status !== "Active" || !student.batchIds.includes(s.batchId)) return new Response("This class isn’t for you.", { status: 403 });
  }
  const { college } = await getSettings();
  return new Response(sessionIcs(s, college.name || "Stella College"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="class-${s.sessionId.slice(0, 8)}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
