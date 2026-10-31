import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-token";

// Ends a session from a plain redirect (e.g. a trainer whose access was switched off).
// Server components can't delete cookies, and proxy.ts would bounce "/" straight back while the cookie exists.
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.nextUrl));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
