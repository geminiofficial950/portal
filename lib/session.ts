import "server-only";
import { cookies } from "next/headers";
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

export async function getSession() {
  return decrypt((await cookies()).get(SESSION_COOKIE)?.value);
}
