import { requireAdmin } from "@/lib/auth";
import { getDeclaration } from "@/lib/declaration-store";
import { listResultOptions } from "@/lib/result-options";
import { getSettings } from "@/lib/settings";
import DeclarationEditor from "./DeclarationEditor";
import ResultOptions from "./ResultOptions";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  await requireAdmin();
  const [settings, resultOptions, declaration] = await Promise.all([getSettings(), listResultOptions(), getDeclaration()]);
  return (
    <div className="space-y-8">
      <SettingsClient initialSettings={settings} />
      <ResultOptions initialOptions={resultOptions} />
      <DeclarationEditor initial={declaration} />
    </div>
  );
}
