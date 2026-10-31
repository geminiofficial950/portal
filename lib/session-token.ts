// Token sign/verify only — no `server-only` import so proxy.ts can use it too.
import { SignJWT, jwtVerify } from "jose";

export type Role = "admin" | "trainer" | "student";

export type SessionPayload = {
  sub: string; // "superadmin", a trainer ID (T001) or a student ID (S1001)
  role: Role;
  name: string;
};

export const SESSION_COOKIE = "stella_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set in .env");
  return new TextEncoder().encode(secret);
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key());
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, key(), { algorithms: ["HS256"] });
    return ["admin", "trainer", "student"].includes(payload.role) ? payload : null;
  } catch {
    return null;
  }
}
