import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { getAdmin } from "./admins";
import { getSession } from "./session";
import { getTrainer } from "./trainers";

export const SUPER_ADMIN_ID = "superadmin";

// Data-access guard: call at the top of every admin page and server action.
// Lets in Super Admin (.env) and active Admin accounts (A001…). Switching an Admin off ends their session.
export async function requireAdmin() {
  const session = await getSession();
  if (session?.role !== "admin") redirect("/");
  const isSuper = session.sub === SUPER_ADMIN_ID;
  if (!isSuper && !(await getAdmin(session.sub))?.active) redirect("/logout");
  return { ...session, isSuper, label: isSuper ? "Super Admin" : `${session.name} (Admin)` };
}

// For route handlers (no redirect): is the caller Super Admin or an active Admin?
export async function isAdminRequest() {
  const session = await getSession();
  if (session?.role !== "admin") return false;
  return session.sub === SUPER_ADMIN_ID || !!(await getAdmin(session.sub))?.active;
}

// Only the .env Super Admin: managing Admin accounts
export async function requireSuperAdmin() {
  const admin = await requireAdmin();
  if (!admin.isSuper) redirect("/superadmin");
  return admin;
}

// Who to name in the activity log for the signed-in Super Admin / Admin
export async function adminActor() {
  return (await requireAdmin()).label;
}

// Admins can do everything except change dates
export const DATES_SUPER_ADMIN_ONLY = "Only Super Admin can change dates.";

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

// Super Admin / Admin, or an active trainer — for actions both can do (e.g. giving a unit result)
export async function requireStaff() {
  const session = await getSession();
  if (session?.role === "admin") {
    const admin = await requireAdmin();
    return { role: "admin" as const, id: admin.sub, name: admin.label };
  }
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
