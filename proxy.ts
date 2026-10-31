import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session-token";

const homeFor = { admin: "/superadmin", trainer: "/trainer", student: "/dashboard" } as const;

// Optimistic cookie check only — admin data is re-checked in lib/auth.ts
export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const session = await decrypt(req.cookies.get(SESSION_COOKIE)?.value);

  const needs = path.startsWith("/superadmin")
    ? "admin"
    : path.startsWith("/trainer")
      ? "trainer"
      : path.startsWith("/dashboard")
        ? "student"
        : null;

  if (needs && session?.role !== needs) {
    return NextResponse.redirect(new URL(session ? homeFor[session.role] : "/", req.nextUrl));
  }

  // Already logged in: skip the login screen
  if (path === "/" && session) {
    return NextResponse.redirect(new URL(homeFor[session.role], req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/superadmin/:path*", "/trainer/:path*"],
};
