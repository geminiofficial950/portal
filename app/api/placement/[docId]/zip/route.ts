import JSZip from "jszip";
import type { NextRequest } from "next/server";
import { getAdmin } from "@/lib/admins";
import { SUPER_ADMIN_ID } from "@/lib/auth";
import { getPlacementDoc, listSignedForDoc } from "@/lib/documents";
import { getUpload } from "@/lib/files";
import { getSession } from "@/lib/session";
import { getStudent } from "@/lib/students";

// Strip characters Windows / macOS don't allow in file and folder names
const safe = (s: string) => s.replace(/[\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "file";

async function readAll(stream: NodeJS.ReadableStream) {
  const parts: Buffer[] = [];
  for await (const chunk of stream) parts.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
  return Buffer.concat(parts);
}

// Admin: every student's signed copies of one placement form in one ZIP — a folder per student ("Name (ID)").
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/placement/[docId]/zip">) {
  const session = await getSession();
  const isAdmin = session?.role === "admin" && (session.sub === SUPER_ADMIN_ID || !!(await getAdmin(session.sub))?.active);
  if (!isAdmin) return new Response("You can’t download these files.", { status: 403 });

  const { docId } = await ctx.params;
  const doc = await getPlacementDoc(String(docId));
  if (!doc) return new Response("Document not found.", { status: 404 });
  const copies = await listSignedForDoc(doc.docId);
  if (!copies.length) return new Response("No signed copies yet.", { status: 404 });

  const zip = new JSZip();
  for (const c of copies) {
    const name = (await getStudent(c.studentId))?.name ?? c.studentId;
    const folder = zip.folder(safe(`${name} (${c.studentId})`))!;
    const used = new Set<string>();
    for (const u of c.uploads) {
      const file = await getUpload(u.file.id);
      if (!file) continue;
      // two files with the same name in one folder get a number instead of overwriting each other
      let fileName = safe(file.name);
      for (let i = 2; used.has(fileName.toLowerCase()); i++) fileName = safe(file.name).replace(/(\.[^.]*)?$/, ` (${i})$1`);
      used.add(fileName.toLowerCase());
      folder.file(fileName, await readAll(file.open()));
    }
  }
  const body = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const zipName = safe(`${doc.courseCode} - ${doc.title} - signed copies.zip`);
  return new Response(body as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
      "Cache-Control": "no-store",
    },
  });
}
