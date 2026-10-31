"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/auth";
import { saveSettings } from "@/lib/settings";
import { COLLEGE_FIELDS, PERMISSIONS, SWITCHES, type PortalSettings } from "@/lib/settings-meta";

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
  await requireAdmin();
  const settings = clean(input);
  if (!settings.college.name) return { ok: false, error: "College name can’t be empty." };
  await saveSettings(settings);
  await logActivity(
    "Super Admin",
    settings.switches.maintenance ? "saved settings — maintenance mode is ON" : "updated portal settings",
    "settings",
  );
  revalidatePath("/superadmin", "layout");
  return { ok: true };
}
