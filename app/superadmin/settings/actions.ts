"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { adminActor, requireSuperAdmin } from "@/lib/auth";
import { checkDeclaration, type DeclarationText } from "@/lib/declaration";
import { saveDeclaration } from "@/lib/declaration-store";
import { saveSettings } from "@/lib/settings";
import { COLLEGE_FIELDS, PERMISSIONS, SWITCHES, type PortalSettings } from "@/lib/settings-meta";

type OptionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Rebuild from known keys only, so a tampered payload can't store extra fields
function clean(input: PortalSettings): PortalSettings {
  return {
    college: Object.fromEntries(COLLEGE_FIELDS.map(({ key }) => [key, String(input.college?.[key] ?? "").trim()])) as PortalSettings["college"],
    switches: Object.fromEntries(SWITCHES.map(({ key }) => [key, input.switches?.[key] === true])) as PortalSettings["switches"],
    trainerPermissions: Object.fromEntries(
      PERMISSIONS.map(({ key }) => [key, input.trainerPermissions?.[key] === true]),
    ) as PortalSettings["trainerPermissions"],
  };
}

export async function saveSettingsAction(input: PortalSettings): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperAdmin();
  const settings = clean(input);
  if (!settings.college.name) return { ok: false, error: "College name can’t be empty." };
  await saveSettings(settings);
  await logActivity(
    await adminActor(),
    settings.switches.maintenance ? "saved settings — maintenance mode is ON" : "updated portal settings",
    "settings",
  );
  revalidatePath("/superadmin", "layout");
  return { ok: true };
}

// ---------- Declaration students tick on Theory / Workplacement Tasks (Super Admin and Admins) ----------

export async function saveDeclarationAction(input: DeclarationText): Promise<OptionResult<{ declaration: DeclarationText }>> {
  await requireSuperAdmin();
  const checked = checkDeclaration(input);
  if ("error" in checked) return { ok: false, error: checked.error };
  await saveDeclaration(checked);
  await logActivity(await adminActor(), `updated the student declaration (${checked.points.length} points)`, "settings");
  revalidatePath("/superadmin/settings");
  revalidatePath("/dashboard", "layout");
  return { ok: true, declaration: checked };
}
