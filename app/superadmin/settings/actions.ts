"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { adminActor, requireAdmin } from "@/lib/auth";
import { checkDeclaration, type DeclarationText } from "@/lib/declaration";
import { saveDeclaration } from "@/lib/declaration-store";
import { checkResultOption, type ResultOption } from "@/lib/result-meta";
import { addResultOption, listResultOptions, removeResultOption, updateResultOption } from "@/lib/result-options";
import { saveSettings } from "@/lib/settings";
import { COLLEGE_FIELDS, PERMISSIONS, SWITCHES, type PortalSettings } from "@/lib/settings-meta";
import { countResultsUsing } from "@/lib/unit-results";

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
  await requireAdmin();
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

// ---------- Final unit result options (Super Admin and Admins) ----------

const refreshResults = () => {
  revalidatePath("/superadmin", "layout");
  revalidatePath("/trainer", "layout");
  revalidatePath("/dashboard", "layout");
};

export async function addResultOptionAction(input: { label: string; kind: string; tone: string }): Promise<OptionResult<{ option: ResultOption }>> {
  await requireAdmin();
  const checked = checkResultOption(input);
  if ("error" in checked) return { ok: false, error: checked.error };
  if ((await listResultOptions()).some((o) => o.label.toLowerCase() === checked.label.toLowerCase())) {
    return { ok: false, error: `There’s already a result called ${checked.label}.` };
  }
  const option = await addResultOption(checked);
  await logActivity(await adminActor(), `added the final result option “${option.label}”`, "settings");
  refreshResults();
  return { ok: true, option };
}

export async function updateResultOptionAction(id: string, input: { label: string; kind: string; tone: string }): Promise<OptionResult<{ option: ResultOption }>> {
  await requireAdmin();
  const checked = checkResultOption(input);
  if ("error" in checked) return { ok: false, error: checked.error };
  const options = await listResultOptions();
  const before = options.find((o) => o.id === id);
  if (!before) return { ok: false, error: "That result option no longer exists." };
  if (options.some((o) => o.id !== id && o.label.toLowerCase() === checked.label.toLowerCase())) {
    return { ok: false, error: `There’s already a result called ${checked.label}.` };
  }
  const option = (await updateResultOption(id, checked))!;
  await logActivity(
    await adminActor(),
    before.label === option.label ? `edited the final result option “${option.label}”` : `renamed the final result “${before.label}” to “${option.label}”`,
    "settings",
  );
  refreshResults();
  return { ok: true, option };
}

export async function deleteResultOptionAction(id: string): Promise<OptionResult> {
  await requireAdmin();
  const options = await listResultOptions();
  const option = options.find((o) => o.id === id);
  if (!option) return { ok: false, error: "That result option no longer exists." };
  if (options.length === 1) return { ok: false, error: "Keep at least one result option." };
  const inUse = await countResultsUsing(id);
  if (inUse) {
    return {
      ok: false,
      error: `${inUse} ${inUse === 1 ? "unit has" : "units have"} the result ${option.label}. Change or remove those results first, or just rename this option.`,
    };
  }
  await removeResultOption(id);
  await logActivity(await adminActor(), `deleted the final result option “${option.label}”`, "settings");
  refreshResults();
  return { ok: true };
}

// ---------- Declaration students tick on Theory / Workplacement Tasks (Super Admin and Admins) ----------

export async function saveDeclarationAction(input: DeclarationText): Promise<OptionResult<{ declaration: DeclarationText }>> {
  await requireAdmin();
  const checked = checkDeclaration(input);
  if ("error" in checked) return { ok: false, error: checked.error };
  await saveDeclaration(checked);
  await logActivity(await adminActor(), `updated the student declaration (${checked.points.length} points)`, "settings");
  revalidatePath("/superadmin/settings");
  revalidatePath("/dashboard", "layout");
  return { ok: true, declaration: checked };
}
