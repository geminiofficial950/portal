import { buffer } from "node:stream/consumers";
import { isUnitHidden } from "@/lib/hidden-units";
import { isUnitOpenFor } from "@/lib/unit-records";
import { getUpload } from "@/lib/files";
import { getSession } from "@/lib/session";
import { logStudent } from "@/lib/student-logs";
import { getStudent, hasCourse } from "@/lib/students";
import { getTrainer } from "@/lib/trainers";
import { getUnitContent } from "@/lib/unit-content";
import { makeZip } from "@/lib/zip";

// The whole Supporting Document folder of a unit as one ZIP ("Download all").
// Same rules as single files: Super Admin / Admin, an active trainer, or an active student of the course who can see the unit.
export async function GET(_req: Request, ctx: RouteContext<"/api/supporting/[course]/[unit]">) {
  const { course, unit } = await ctx.params;
  const session = await getSession();
  if (!session) return new Response("Please log in.", { status: 401 });

  let studentName: string | null = null;
  let allowed = session.role === "admin";
  if (session.role === "student") {
    const student = await getStudent(session.sub);
    allowed =
      student?.status === "Active" &&
      hasCourse(student, course) &&
      !(await isUnitHidden(session.sub, course, unit)) &&
      (await isUnitOpenFor(session.sub, course, unit));
    studentName = student?.name ?? null;
  } else if (session.role === "trainer") {
    allowed = !!(await getTrainer(session.sub))?.active;
  }
  if (!allowed) return new Response("You can’t open this folder.", { status: 403 });

  const files = (await getUnitContent(course, unit)).resources.flatMap((r) => (r.kind === "file" && r.slot === "supporting" ? [r] : []));
  if (!files.length) return new Response("There are no supporting documents for this unit.", { status: 404 });

  const entries = [];
  for (const r of files) {
    const f = await getUpload(r.file.id);
    if (f) entries.push({ name: r.title || f.name, data: await buffer(f.open()) });
  }
  const zip = makeZip(entries);
  if (studentName) {
    await logStudent({ studentId: session.sub, courseCode: course, unitCode: unit, studentName, action: "Downloaded file", detail: `Supporting Document folder (${entries.length} files)` }, 60);
  }
  const name = `${unit} Supporting Documents.zip`;
  return new Response(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(zip.length),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
