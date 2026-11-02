"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { MailIcon, PlusIcon, ShieldIcon, TrashIcon } from "../../dashboard/_components/icons";
import CredentialsCard, { type Credentials } from "../_components/CredentialsCard";
import Toggle from "../_components/Toggle";
import type { AdminDTO } from "@/lib/admin-meta";
import { initials } from "@/lib/format";
import { generatePassword } from "@/lib/password";
import { addAdminAction, deleteAdminAction, resetAdminPasswordAction, setAdminActiveAction } from "./actions";

export default function AdminsClient({ initialAdmins }: { initialAdmins: AdminDTO[] }) {
  const [list, setList] = useState(initialAdmins);
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
      const res = await addAdminAction(form);
      if (!res.ok) return void toast.error(res.error);
      setList((l) => [...l, res.admin]);
      setCredentials({
        title: `${res.admin.name} added`,
        idLabel: "Admin ID",
        id: res.admin.adminId,
        email: res.admin.email,
        password: form.password,
      });
      setForm({ name: "", email: "", password: "" });
      setAdding(false);
    });
  };

  const resetPassword = (a: AdminDTO) => {
    if (!window.confirm(`Set a new password for ${a.name}? Their old password will stop working.`)) return;
    const password = generatePassword();
    run(a.adminId, () => resetAdminPasswordAction(a.adminId, password), () =>
      setCredentials({ title: `New password for ${a.name}`, idLabel: "Admin ID", id: a.adminId, email: a.email, password }),
    );
  };

  const inputClass = "rounded-xl bg-white px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/10 placeholder:text-ink/60 focus:ring-plum/30";

  return (
    <div className="animate-fade-up space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-ink sm:text-[1.65rem]">Admins</h1>
          <p className="mt-1 text-sm text-ink">
            Admins can do everything in this panel except change dates (due dates and submitted dates).
          </p>
        </div>
        <button
          onClick={() => {
            setAdding((v) => !v);
            setForm((f) => ({ ...f, password: f.password || generatePassword() }));
          }}
          className="inline-flex items-center gap-2 rounded-full bg-plum px-5 py-3 text-sm font-medium text-white transition hover:bg-plum-light"
        >
          <PlusIcon className="h-4 w-4" />
          Add admin
        </button>
      </div>

      {credentials && <CredentialsCard credentials={credentials} onClose={() => setCredentials(null)} />}

      {adding && (
        <form onSubmit={add} className="grid gap-3 rounded-[1.75rem] bg-lilac/80 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-center">
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className={inputClass} />
          <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Work email" className={inputClass} />
          <div className="flex items-center gap-2 rounded-xl bg-white pl-4 pr-1.5 ring-1 ring-ink/10 focus-within:ring-plum/30">
            <input
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Password (min 8)"
              aria-label="Password"
              className="min-w-0 flex-1 bg-transparent py-3 font-mono text-sm text-ink outline-none placeholder:font-sans placeholder:text-ink/60"
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
          {list.map((a) => {
            const busy = busyId === a.adminId;
            return (
              <li
                key={a.adminId}
                className={`rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] transition ${
                  busy ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-plum text-sm font-bold text-white">
                    {initials(a.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{a.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink">
                      <MailIcon className="h-3.5 w-3.5 shrink-0" />
                      {a.email}
                    </p>
                    {!a.active && (
                      <span className="mt-2 inline-block rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700">
                        Access switched off
                      </span>
                    )}
                  </div>
                  <Toggle
                    checked={a.active}
                    label={`${a.name} access`}
                    onChange={(next) =>
                      run(a.adminId, () => setAdminActiveAction(a.adminId, next), () => {
                        setList((l) => l.map((x) => (x.adminId === a.adminId ? { ...x, active: next } : x)));
                        toast.success(`${a.name} ${next ? "is active again" : "access switched off"}`);
                      })
                    }
                  />
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4">
                  <button
                    onClick={() => resetPassword(a)}
                    className="rounded-full bg-lilac px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-plum/10 hover:text-plum"
                  >
                    Reset password
                  </button>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-ink">
                      {a.adminId} · added {a.added}
                    </p>
                    <button
                      onClick={() => {
                        if (!window.confirm(`Remove ${a.name}? They won’t be able to log in any more.`)) return;
                        run(a.adminId, () => deleteAdminAction(a.adminId), () => {
                          setList((l) => l.filter((x) => x.adminId !== a.adminId));
                          toast.success(`${a.name} removed`);
                        });
                      }}
                      aria-label={`Remove ${a.name}`}
                      className="rounded-full p-1.5 text-ink transition hover:bg-rose-50 hover:text-rose-600"
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
          <ShieldIcon className="h-8 w-8 text-plum" />
          <p className="mt-3 text-sm text-ink">No admins yet — click Add admin to add the first one.</p>
        </div>
      )}
    </div>
  );
}
