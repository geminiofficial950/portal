import { getAdmin } from "@/lib/admins";
import { SUPER_ADMIN_ID } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { readUpload } from "@/lib/student-import";

const MAX_BYTES = 5 * 1024 * 1024;

// Admin: reads an uploaded student sheet and says, row by row, what would be created and what's wrong — nothing is saved
export async function POST(req: Request) {
  const session = await getSession();
  const isAdmin = session?.role === "admin" && (session.sub === SUPER_ADMIN_ID || !!(await getAdmin(session.sub))?.active);
  if (!isAdmin) return Response.json({ error: "You can’t upload students." }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "The file is too big (5 MB max)." }, { status: 400 });
  try {
    const res = await readUpload(file.name, Buffer.from(await file.arrayBuffer()));
    return Response.json(res, { status: "error" in res ? 400 : 200 });
  } catch (err) {
    console.error("student import preview failed:", err);
    return Response.json({ error: "Couldn’t read this file. Save it as .xlsx or .csv and try again." }, { status: 400 });
  }
}
