import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE, type SessionPayload } from "@/lib/session-token";

// The .env Super Admin's session id (same as SUPER_ADMIN_ID in lib/auth.ts, which is server-only)
const SUPER_ADMIN_ID = "superadmin";

// Super Admin works under /superadmin; Admin accounts see the same pages under /admin
const homeOf = (s: SessionPayload) =>
  s.role === "admin" ? (s.sub === SUPER_ADMIN_ID ? "/superadmin" : "/admin") : s.role === "trainer" ? "/trainer" : "/dashboard";

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

// Optimistic cookie check only — admin data is re-checked in lib/auth.ts
export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const session = await decrypt(req.cookies.get(SESSION_COOKIE)?.value);
  const to = (pathname: string) => {
    const url = req.nextUrl.clone();
    url.pathname = pathname;
    return url;
  };

  // Admin pages: /superadmin for Super Admin, /admin (shown in the address bar) for Admin accounts
  if (under(path, "/admin") || under(path, "/superadmin")) {
    if (session?.role !== "admin") return NextResponse.redirect(new URL(session ? homeOf(session) : "/", req.nextUrl));
    const rest = path.replace(/^\/(super)?admin/, "");
    if (session.sub === SUPER_ADMIN_ID) {
      return under(path, "/admin") ? NextResponse.redirect(to(`/superadmin${rest}`)) : NextResponse.next();
    }
    // an Admin account: never show "superadmin" in the address bar; /admin/… serves the /superadmin/… page
    return under(path, "/superadmin") ? NextResponse.redirect(to(`/admin${rest}`)) : NextResponse.rewrite(to(`/superadmin${rest}`));
  }

  const needs = under(path, "/trainer") ? "trainer" : under(path, "/dashboard") ? "student" : null;
  if (needs && session?.role !== needs) {
    return NextResponse.redirect(new URL(session ? homeOf(session) : "/", req.nextUrl));
  }

  // Already logged in: skip the login screen
  if (path === "/" && session) {
    return NextResponse.redirect(new URL(homeOf(session), req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/superadmin/:path*", "/admin/:path*", "/trainer/:path*"],
};
