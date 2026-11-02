"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import type { AdminDTO } from "@/lib/admin-meta";
import { createAdmin, deleteAdmin, DuplicateAdminEmailError, resetAdminPassword, setAdminActive } from "@/lib/admins";
import { requireSuperAdmin } from "@/lib/auth";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only Super Admin manages Admin accounts
export async function addAdminAction(input: {
  name: string;
  email: string;
  password: string;
}): Promise<Result<{ admin: AdminDTO }>> {
  await requireSuperAdmin();
  const name = input.name.trim();
  const email = input.email.trim();
  if (!name) return { ok: false, error: "Enter a name." };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email." };
  if (input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  try {
    const admin = await createAdmin({ name, email, password: input.password });
    await logActivity("Super Admin", `added admin ${admin.name} (${admin.adminId})`, "settings");
    revalidatePath("/superadmin", "layout");
    return { ok: true, admin };
  } catch (err) {
    if (err instanceof DuplicateAdminEmailError) return { ok: false, error: "An admin with this email already exists." };
    console.error("createAdmin failed:", err);
    return { ok: false, error: "Couldn’t save. Try again." };
  }
}

export async function setAdminActiveAction(adminId: string, active: boolean): Promise<Result> {
  await requireSuperAdmin();
  const doc = await setAdminActive(adminId, active);
  if (!doc) return { ok: false, error: "Admin not found." };
  await logActivity("Super Admin", `${active ? "turned on" : "switched off"} admin access for ${doc.name}`, "settings");
  revalidatePath("/superadmin", "layout");
  return { ok: true };
}

export async function resetAdminPasswordAction(adminId: string, password: string): Promise<Result> {
  await requireSuperAdmin();
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  const found = await resetAdminPassword(adminId, password);
  if (!found) return { ok: false, error: "Admin not found." };
  await logActivity("Super Admin", `reset the password for ${adminId}`, "settings");
  return { ok: true };
}

export async function deleteAdminAction(adminId: string): Promise<Result> {
  await requireSuperAdmin();
  const doc = await deleteAdmin(adminId);
  if (!doc) return { ok: false, error: "Admin not found." };
  await logActivity("Super Admin", `removed admin ${doc.name}`, "settings");
  revalidatePath("/superadmin", "layout");
  return { ok: true };
}
