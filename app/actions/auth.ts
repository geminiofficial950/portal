"use server";

import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/lib/auth";
import { createSession, deleteSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { verifyStudentLogin } from "@/lib/students";
import { verifyTrainerLogin } from "@/lib/trainers";

export type LoginState = { error?: string; username?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) return { error: "Enter your ID and password.", username };

  if (isSuperAdmin(username, password)) {
    await createSession({ sub: "superadmin", role: "admin", name: "Super Admin" });
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
  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
