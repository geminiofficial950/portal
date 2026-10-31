import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { getSession } from "./session";
import { getTrainer } from "./trainers";

// Data-access guard: call at the top of every admin page and server action.
export async function requireAdmin() {
  const session = await getSession();
  if (session?.role !== "admin") redirect("/");
  return session;
}

export async function requireStudent() {
  const session = await getSession();
  if (session?.role !== "student") redirect("/");
  return session;
}

// Also re-checks the database, so switching a trainer off ends their session straight away
export async function requireTrainer() {
  const session = await getSession();
  if (session?.role !== "trainer") redirect("/");
  const trainer = await getTrainer(session.sub);
  if (!trainer?.active) redirect("/logout");
  return trainer;
}

// Super Admin, or an active trainer — for actions both can do (e.g. giving a unit result)
export async function requireStaff() {
  const session = await getSession();
  if (session?.role === "admin") return { role: "admin" as const, id: session.sub, name: "Super Admin" };
  if (session?.role === "trainer") {
    const trainer = await getTrainer(session.sub);
    if (trainer?.active) return { role: "trainer" as const, id: trainer.trainerId, name: trainer.name };
  }
  redirect("/");
}

const digest = (s: string) => createHash("sha256").update(s).digest();

export function isSuperAdmin(id: string, password: string) {
  const envId = process.env.SUPERADMIN_ID;
  const envPassword = process.env.SUPERADMIN_PASSWORD;
  if (!envId || !envPassword) return false;
  // Constant-time compare so response timing doesn't leak the password
  const idOk = timingSafeEqual(digest(id.toLowerCase()), digest(envId.toLowerCase()));
  const passwordOk = timingSafeEqual(digest(password), digest(envPassword));
  return idOk && passwordOk;
}
