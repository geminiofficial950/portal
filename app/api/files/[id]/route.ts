import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { getUpload } from "@/lib/files";
import { getSession } from "@/lib/session";
import { getStudent } from "@/lib/students";
import { findSubmissionWithFile } from "@/lib/submissions";
import { getTrainer } from "@/lib/trainers";
import { findResourceFile } from "@/lib/unit-content";

// Who may download a file:
// - Super Admin: anything
// - a student: their own uploads, and reading resources of their own course
// - an active trainer: files attached to a submission, and any reading resource
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return new Response("Please log in.", { status: 401 });

  const file = await getUpload(id);
  if (!file) return new Response("File not found.", { status: 404 });

  let allowed = session.role === "admin";
  if (!allowed && session.role === "student") {
    if (file.ownerId === session.sub) allowed = true;
    else {
      const resource = await findResourceFile(id);
      const student = resource ? await getStudent(session.sub) : null;
      allowed = !!resource && student?.status === "Active" && student.course === resource.courseCode;
    }
  }
  if (!allowed && session.role === "trainer") {
    const trainer = await getTrainer(session.sub);
    allowed = !!trainer?.active && (!!(await findSubmissionWithFile(id)) || !!(await findResourceFile(id)));
  }
  if (!allowed) return new Response("You can’t open this file.", { status: 403 });

  return new Response(Readable.toWeb(file.open()) as ReadableStream, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
