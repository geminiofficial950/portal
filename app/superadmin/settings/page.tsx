import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  await requireAdmin();
  return <SettingsClient initialSettings={await getSettings()} />;
}
