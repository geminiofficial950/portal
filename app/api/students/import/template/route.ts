import type { NextRequest } from "next/server";
import { getAdmin } from "@/lib/admins";
import { SUPER_ADMIN_ID } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { buildTemplate } from "@/lib/student-import";

// Admin: the bulk student upload template — ?format=xlsx (default, with a Help sheet) or ?format=csv
export async function GET(req: NextRequest) {
  const session = await getSession();
  const isAdmin = session?.role === "admin" && (session.sub === SUPER_ADMIN_ID || !!(await getAdmin(session.sub))?.active);
  if (!isAdmin) return new Response("You can’t download this.", { status: 403 });
  const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const body = await buildTemplate(format);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="students-template.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
