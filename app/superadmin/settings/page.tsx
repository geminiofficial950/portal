import { requireAdmin } from "@/lib/auth";
import { getDeclaration } from "@/lib/declaration-store";
import { getSettings } from "@/lib/settings";
import DeclarationEditor from "./DeclarationEditor";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  await requireAdmin();
  // (the old Pass / Fail “final result options” are gone: a unit's result is now its unit status — Competent, Not Yet Competent…)
  const [settings, declaration] = await Promise.all([getSettings(), getDeclaration()]);
  return (
    <div className="space-y-8">
      <SettingsClient initialSettings={settings} />
      <DeclarationEditor initial={declaration} />
    </div>
  );
}
