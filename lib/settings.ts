import "server-only";
import { getDb } from "./db";
import { DEFAULT_SETTINGS, type PortalSettings } from "./settings-meta";

type SettingsDoc = PortalSettings & { _id: "portal"; updatedAt: Date };

async function collection() {
  return (await getDb()).collection<SettingsDoc>("settings");
}

// Stored values layered over defaults, so newly added keys always have a value
export async function getSettings(): Promise<PortalSettings> {
  const doc = await (await collection()).findOne({ _id: "portal" });
  const d = DEFAULT_SETTINGS;
  return {
    college: { ...d.college, ...doc?.college },
    switches: { ...d.switches, ...doc?.switches },
    trainerPermissions: { ...d.trainerPermissions, ...doc?.trainerPermissions },
  };
}

export async function saveSettings(settings: PortalSettings) {
  await (await collection()).updateOne(
    { _id: "portal" },
    { $set: { ...settings, updatedAt: new Date() } },
    { upsert: true },
  );
}
