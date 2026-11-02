"use server";

import { redirect } from "next/navigation";
import { verifyAdminLogin } from "@/lib/admins";
import { isSuperAdmin, SUPER_ADMIN_ID } from "@/lib/auth";
import { createSession, deleteSession, getSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { logStudent } from "@/lib/student-logs";
import { verifyStudentLogin } from "@/lib/students";
import { verifyTrainerLogin } from "@/lib/trainers";

export type LoginState = { error?: string; username?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) return { error: "Enter your ID and password.", username };

  if (isSuperAdmin(username, password)) {
    await createSession({ sub: SUPER_ADMIN_ID, role: "admin", name: "Super Admin" });
    redirect("/superadmin");
  }

  // Admin accounts (A001… or their email) — not blocked by maintenance mode
  let adminLogin;
  try {
    adminLogin = await verifyAdminLogin(username, password);
  } catch (err) {
    console.error("Login failed:", err);
    return { error: "Can’t reach the server right now. Please try again.", username };
  }
  if (adminLogin) {
    if (!adminLogin.ok) {
      return { error: adminLogin.reason === "inactive" ? "Your admin access is switched off. Please contact Super Admin." : "Wrong ID or password.", username };
    }
    await createSession({ sub: adminLogin.admin.adminId, role: "admin", name: adminLogin.admin.name });
    redirect("/superadmin");
  }

  let trainer, result;
  try {
    if ((await getSettings()).switches.maintenance) {
      return { error: "The portal is under maintenance. Please try again later.", username };
    }
    trainer = await verifyTrainerLogin(username, password);
    if (!trainer) result = await verifyStudentLogin(username, password);
  } catch (err) {
    console.error("Login failed:", err);
    return { error: "Can’t reach the server right now. Please try again.", username };
  }

  if (trainer) {
    if (!trainer.ok) {
      return {
        error: trainer.reason === "inactive" ? "Your trainer access is switched off. Please contact admin." : "Wrong ID or password.",
        username,
      };
    }
    await createSession({ sub: trainer.trainer.trainerId, role: "trainer", name: trainer.trainer.name });
    redirect("/trainer");
  }
  if (!result) return { error: "Wrong ID or password.", username };

  if (!result.ok) {
    const error =
      result.reason === "Suspended"
        ? "Your account is suspended. Please contact admin."
        : result.reason === "Pending"
          ? "Your account isn’t active yet. Please contact admin."
          : "Wrong ID or password.";
    return { error, username };
  }

  await createSession({ sub: result.student.studentId, role: "student", name: result.student.name });
  await logStudent({ studentId: result.student.studentId, studentName: result.student.name, action: "Logged in" });
  redirect("/dashboard");
}

export async function logout() {
  const session = await getSession();
  if (session?.role === "student") await logStudent({ studentId: session.sub, studentName: session.name, action: "Logged out" });
  await deleteSession();
  redirect("/");
}
