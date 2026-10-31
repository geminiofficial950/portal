"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { MailIcon, PlusIcon, TrashIcon, UserPlusIcon } from "../../dashboard/_components/icons";
import CredentialsCard, { type Credentials } from "../_components/CredentialsCard";
import Toggle from "../_components/Toggle";
import { initials } from "@/lib/format";
import { generatePassword } from "@/lib/password";
import type { TrainerDTO } from "@/lib/trainer-meta";
import { addTrainerAction, deleteTrainerAction, resetTrainerPasswordAction, setTrainerActiveAction } from "./actions";

export default function TrainersClient({ initialTrainers }: { initialTrainers: TrainerDTO[] }) {
  const [list, setList] = useState(initialTrainers);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [saving, startSaving] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<{ ok: boolean; error?: string }>, onOk: () => void) => {
    setBusyId(id);
    try {
      const res = await action();
      if (res.ok) onOk();
      else toast.error(res.error ?? "Something went wrong");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    startSaving(async () => {
      const res = await addTrainerAction(form);
      if (!res.ok) return void toast.error(res.error);
      setList((l) => [...l, res.trainer]);
      setCredentials({
        title: `${res.trainer.name} added`,
        idLabel: "Trainer ID",
        id: res.trainer.trainerId,
        email: res.trainer.email,
        password: form.password,
      });
      setForm({ name: "", email: "", password: "" });
      setAdding(false);
    });
  };

  const resetPassword = (t: TrainerDTO) => {
    if (!window.confirm(`Set a new password for ${t.name}? Their old password will stop working.`)) return;
    const password = generatePassword();
    run(t.trainerId, () => resetTrainerPasswordAction(t.trainerId, password), () =>
      setCredentials({ title: `New password for ${t.name}`, idLabel: "Trainer ID", id: t.trainerId, email: t.email, password }),
    );
  };

  const active = list.filter((t) => t.active).length;
  const inputClass = "rounded-xl bg-white px-4 py-3 text-sm outline-none ring-1 ring-ink/5 placeholder:text-ink/35 focus:ring-plum/30";

  return (
    <div className="animate-fade-up space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-ink sm:text-[1.65rem]">Trainers</h1>
          <p className="mt-1 text-sm text-ink/55">Create trainer logins, switch their access on or off, and assign them tickets.</p>
        </div>
        <button
          onClick={() => {
            setAdding((v) => !v);
            setForm((f) => ({ ...f, password: f.password || generatePassword() }));
          }}
          className="inline-flex items-center gap-2 rounded-full bg-plum px-5 py-3 text-sm font-medium text-white transition hover:bg-plum-light"
        >
          <PlusIcon className="h-4 w-4" />
          Add trainer
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Trainers", value: list.length, tone: "bg-lilac" },
          { label: "Active", value: active, tone: "bg-emerald-50" },
          { label: "Switched off", value: list.length - active, tone: "bg-lilac/70" },
        ].map((c) => (
          <div key={c.label} className={`rounded-[1.5rem] px-5 py-4 ${c.tone}`}>
            <p className="text-2xl font-medium text-ink">{c.value}</p>
            <p className="mt-1 text-xs text-ink/50">{c.label}</p>
          </div>
        ))}
      </div>

      {credentials && <CredentialsCard credentials={credentials} onClose={() => setCredentials(null)} />}

      {adding && (
        <form onSubmit={add} className="grid gap-3 rounded-[1.75rem] bg-lilac/80 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-center">
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className={inputClass} />
          <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Work email" className={inputClass} />
          <div className="flex items-center gap-2 rounded-xl bg-white pl-4 pr-1.5 ring-1 ring-ink/5 focus-within:ring-plum/30">
            <input
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Password (min 8)"
              aria-label="Password"
              className="min-w-0 flex-1 bg-transparent py-3 font-mono text-sm outline-none placeholder:font-sans placeholder:text-ink/35"
            />
            <button
              type="button"
              onClick={() => setForm({ ...form, password: generatePassword() })}
              className="shrink-0 rounded-lg bg-lilac px-2.5 py-1.5 text-[11px] font-medium text-plum hover:bg-plum/10"
            >
              Generate
            </button>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="whitespace-nowrap rounded-full bg-plum px-5 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Saving…" : "Create login"}
          </button>
        </form>
      )}

      {list.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((t) => {
            const busy = busyId === t.trainerId;
            return (
              <li
                key={t.trainerId}
                className={`rounded-[1.75rem] border border-ink/5 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] transition ${
                  t.active ? "" : "opacity-60"
                } ${busy ? "pointer-events-none opacity-50" : ""}`}
              >
                <div className="flex items-start gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-peach text-sm font-bold text-white">
                    {initials(t.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{t.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-ink/45">
                      <MailIcon className="h-3.5 w-3.5 shrink-0" />
                      {t.email}
                    </p>
                  </div>
                  <Toggle
                    checked={t.active}
                    label={`${t.name} access`}
                    onChange={(next) =>
                      run(t.trainerId, () => setTrainerActiveAction(t.trainerId, next), () => {
                        setList((l) => l.map((x) => (x.trainerId === t.trainerId ? { ...x, active: next } : x)));
                        toast.success(`${t.name} ${next ? "is active again" : "access switched off"}`);
                      })
                    }
                  />
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink/5 pt-4">
                  <button
                    onClick={() => resetPassword(t)}
                    className="rounded-full bg-lilac px-3 py-1.5 text-[11px] font-medium text-ink/70 transition hover:bg-plum/10 hover:text-plum"
                  >
                    Reset password
                  </button>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] text-ink/45">
                      {t.trainerId} · added {t.added}
                    </p>
                    <button
                      onClick={() => {
                        if (!window.confirm(`Remove ${t.name}?`)) return;
                        run(t.trainerId, () => deleteTrainerAction(t.trainerId), () => {
                          setList((l) => l.filter((x) => x.trainerId !== t.trainerId));
                          toast.success(`${t.name} removed`);
                        });
                      }}
                      aria-label={`Remove ${t.name}`}
                      className="rounded-full p-1.5 text-ink/35 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="grid place-items-center rounded-[1.75rem] bg-lilac/70 px-6 py-12 text-center">
          <UserPlusIcon className="h-8 w-8 text-plum/40" />
          <p className="mt-3 text-sm text-ink/55">No trainers yet — click Add trainer to add the first one.</p>
        </div>
      )}
    </div>
  );
}
