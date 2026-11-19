"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { changeStudentLoginAction, updateStudentProfileAction } from "../actions";
import { initials } from "@/lib/format";
import { AU_STATES } from "@/lib/student-profile-meta";
import type { StudentDTO } from "@/lib/students";

const accountTone: Record<StudentDTO["status"], string> = {
  Active: "bg-emerald-100 text-emerald-800",
  Pending: "bg-amber-100 text-amber-900",
  Suspended: "bg-rose-100 text-rose-800",
};
const accountWord: Record<StudentDTO["status"], string> = { Active: "Enabled", Pending: "Pending", Suspended: "Disabled" };
const day = (v: string | null) => (v ? new Date(`${v}T12:00:00Z`).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—");
const field = "w-full rounded-xl bg-white px-3.5 py-2.5 text-base font-normal text-ink outline-none ring-1 ring-ink/15 focus:ring-2 focus:ring-plum/40 disabled:bg-lilac/40";

// The student's details at the top of their profile, with Edit details.
// Admins edit name, phone, state and notes; Student ID and email (their login) are changed by Super Admin only.
export default function StudentProfileCard({ student, batchNames, canEditLogin }: { student: StudentDTO; batchNames: string[]; canEditLogin: boolean }) {
  const router = useRouter();
  const [s, setS] = useState(student);
  const [editing, setEditing] = useState(false);
  const blank = () => ({ studentId: s.studentId, firstName: s.firstName, lastName: s.lastName, email: s.email, phone: s.phone, state: s.state, notes: s.notes });
  const [form, setForm] = useState(blank);
  const [saving, start] = useTransition();
  const set = (k: keyof ReturnType<typeof blank>) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await updateStudentProfileAction(s.studentId, form);
      if (!res.ok) return void toast.error(res.error);
      let next = res.student;
      const newId = form.studentId.trim().toUpperCase();
      const newEmail = form.email.trim().toLowerCase();
      if (canEditLogin && (newId !== s.studentId || newEmail !== s.email)) {
        const changes = [newId !== s.studentId ? `Student ID: ${s.studentId} → ${newId}` : "", newEmail !== s.email ? `Email: ${s.email} → ${newEmail}` : ""].filter(Boolean).join("\n");
        if (!window.confirm(`Change ${next.name}’s login?\n\n${changes}\n\nAll their work moves with them and they are signed out; the password stays.`)) {
          toast.success("Details saved (login not changed)");
        } else {
          const login = await changeStudentLoginAction(s.studentId, { email: newEmail, studentId: newId });
          if (!login.ok) return void toast.error(login.error);
          next = login.student;
          if (next.studentId !== s.studentId) {
            toast.success("Details and login saved");
            router.replace(`./${encodeURIComponent(next.studentId)}`);
            return;
          }
        }
      }
      setS(next);
      setEditing(false);
      toast.success("Details saved");
      router.refresh();
    });
  };

  const details: [string, string][] = [
    ["Student ID", s.studentId],
    ["First name", s.firstName || "—"],
    ["Last name", s.lastName || "—"],
    ["Email", s.email],
    ["Phone number", s.phone || "—"],
    ["State", s.state || "—"],
    ["Start date", day(s.startDate)],
    ["End date", day(s.endDate)],
    ["Enrolled", s.enrolled],
    ["Courses", s.courses.map((c) => c.code).join(", ")],
    ["Batch", batchNames.join(", ") || "No batch"],
    // other details kept from a bulk upload's extra columns
    ...Object.entries(s.extra),
  ];

  return (
    <section aria-label="Student details" className="rounded-[1.5rem] border border-ink/10 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-plum text-xl font-bold text-white">{initials(s.name)}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-ink">{s.name}</h1>
          <p className="text-sm text-ink">{s.studentId}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${accountTone[s.status]}`}>Account {accountWord[s.status]}</span>
        {!editing && (
          <button
            type="button"
            onClick={() => (setForm(blank()), setEditing(true))}
            className="rounded-xl border border-plum/40 bg-white px-4 py-2 text-sm font-semibold text-plum transition hover:bg-lilac"
          >
            Edit details
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Edit student details">
          <label className="space-y-1 text-sm font-semibold text-ink">
            Student ID
            <input value={form.studentId} onChange={set("studentId")} disabled={!canEditLogin} maxLength={20} className={`${field} font-mono`} />
          </label>
          <label className="space-y-1 text-sm font-semibold text-ink">
            First name *
            <input required value={form.firstName} onChange={set("firstName")} maxLength={60} className={field} />
          </label>
          <label className="space-y-1 text-sm font-semibold text-ink">
            Last name *
            <input required value={form.lastName} onChange={set("lastName")} maxLength={60} className={field} />
          </label>
          <label className="space-y-1 text-sm font-semibold text-ink">
            Email
            <input type="email" value={form.email} onChange={set("email")} disabled={!canEditLogin} className={field} />
          </label>
          <label className="space-y-1 text-sm font-semibold text-ink">
            Phone number *
            <input required type="tel" value={form.phone} onChange={set("phone")} maxLength={20} className={field} />
          </label>
          <label className="space-y-1 text-sm font-semibold text-ink">
            State (optional)
            <select value={form.state} onChange={set("state")} className={field}>
              <option value="">—</option>
              {AU_STATES.map((st) => (
                <option key={st}>{st}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold text-ink sm:col-span-2 lg:col-span-3">
            Notes (optional)
            <textarea value={form.notes} onChange={set("notes")} maxLength={1000} rows={3} className={`${field} resize-y`} />
          </label>
          {!canEditLogin && <p className="text-sm text-ink sm:col-span-2 lg:col-span-3">Student ID and email are the student’s login — please contact the college to change them.</p>}
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={saving} className="rounded-xl bg-plum px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-plum-light disabled:opacity-60">
              {saving ? "Saving…" : "Save details"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-ink/20 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-lilac">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {details.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-sm font-semibold text-ink">{label}</dt>
              <dd className="break-words text-base text-ink">{value}</dd>
            </div>
          ))}
          <div className="min-w-0 sm:col-span-2 lg:col-span-3">
            <dt className="text-sm font-semibold text-ink">Notes</dt>
            <dd className="whitespace-pre-wrap break-words text-base text-ink">{s.notes || "—"}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
