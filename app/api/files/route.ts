import type { NextRequest } from "next/server";
import { saveUpload, UploadError } from "@/lib/files";
import { getSession } from "@/lib/session";

// Students upload their assessment work here, and Super Admin uploads unit reading resources.
// The returned id is then attached to a submission or a resource.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session?.role !== "student" && session?.role !== "admin") {
    return Response.json({ error: "Please log in again." }, { status: 401 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return Response.json({ error: "Upload failed. Try again." }, { status: 400 });
  }
  if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });

  try {
    return Response.json(await saveUpload(file, session.sub));
  } catch (err) {
    if (err instanceof UploadError) return Response.json({ error: err.message }, { status: 400 });
    console.error("upload failed:", err);
    return Response.json({ error: "Upload failed. Try again." }, { status: 500 });
  }
}
