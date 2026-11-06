import "server-only";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { decrypt, encrypt, SESSION_COOKIE, SESSION_MAX_AGE, type SessionPayload } from "./session-token";

export async function createSession(payload: SessionPayload) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await encrypt(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

// The signed cookie only, without checking the account (lib/auth uses it to send a disabled student to /logout)
export async function readSessionCookie() {
  return decrypt((await cookies()).get(SESSION_COOKIE)?.value);
}

// A student whose account was disabled (or removed) loses access at once, even with a session cookie from before —
// every page, action and file download goes through here (trainers and admins are re-checked in lib/auth.ts).
export async function getSession() {
  const session = await readSessionCookie();
  if (session?.role === "student") {
    const student = await (await getDb()).collection("students").findOne({ studentId: session.sub }, { projection: { status: 1 } });
    if (!student || student.status === "Suspended") return null;
  }
  return session;
}
