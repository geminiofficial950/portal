"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import Toggle from "../_components/Toggle";
import { COLLEGE_FIELDS, PERMISSIONS, SWITCHES, type PortalSettings } from "@/lib/settings-meta";
import { saveSettingsAction } from "./actions";

export default function SettingsClient({ initialSettings }: { initialSettings: PortalSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [saved, setSaved] = useState(initialSettings);
  const [saving, startSaving] = useTransition();
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);

  const save = () =>
    startSaving(async () => {
      const res = await saveSettingsAction(settings);
      if (!res.ok) return void toast.error(res.error);
      setSaved(settings);
      toast.success("Settings saved");
    });

  return (
    <div className="animate-fade-up space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-ink sm:text-[1.65rem]">Portal settings</h1>
          <p className="mt-1 text-sm text-ink">College details, portal switches and what each role can do.</p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <button
              onClick={() => setSettings(saved)}
              className="rounded-full px-5 py-3 text-sm font-medium text-ink transition hover:bg-lilac"
            >
              Discard
            </button>
          )}
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-full bg-plum px-6 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {saved.switches.maintenance && (
        <p className="rounded-2xl bg-rose-50 px-5 py-3 text-sm text-rose-700">
          Maintenance mode is on — students and trainers can’t log in until you switch it off.
        </p>
      )}

      <div className="grid gap-8 xl:grid-cols-2">
        <section className="rounded-[1.75rem] bg-lilac/70 p-5 sm:p-6">
          <h2 className="text-lg font-medium text-ink">College details</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {COLLEGE_FIELDS.map(({ key, label }) => (
              <label key={key} className="block">
                <span className="text-[11px] font-medium text-ink">{label}</span>
                <input
                  value={settings.college[key]}
                  onChange={(e) => setSettings({ ...settings, college: { ...settings.college, [key]: e.target.value } })}
                  className="mt-1 w-full rounded-xl bg-white px-4 py-3 text-sm outline-none ring-1 ring-ink/5 focus:ring-plum/30"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] sm:p-6">
          <h2 className="text-lg font-medium text-ink">Portal switches</h2>
          <ul className="mt-2 divide-y divide-ink/5">
            {SWITCHES.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className={`text-sm font-medium ${s.key === "maintenance" && settings.switches.maintenance ? "text-rose-600" : "text-ink"}`}>
                    {s.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink">{s.hint}</p>
                </div>
                <Toggle
                  checked={settings.switches[s.key]}
                  label={s.label}
                  onChange={(next) => setSettings({ ...settings, switches: { ...settings.switches, [s.key]: next } })}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-[1.75rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] sm:p-6">
        <h2 className="text-lg font-medium text-ink">What trainers can do</h2>
        <p className="mt-0.5 text-xs text-ink">Super Admin can always do everything. Students only see their own portal.</p>
        <ul className="mt-2 grid gap-x-10 divide-y divide-ink/5 sm:grid-cols-2 sm:divide-y-0">
          {PERMISSIONS.map((p) => (
            <li key={p.key} className="flex items-center justify-between gap-4 py-4 sm:border-b sm:border-ink/5">
              <p className="text-sm font-medium text-ink">{p.label}</p>
              <Toggle
                checked={settings.trainerPermissions[p.key]}
                label={`Trainers: ${p.label}`}
                onChange={(next) =>
                  setSettings({ ...settings, trainerPermissions: { ...settings.trainerPermissions, [p.key]: next } })
                }
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
