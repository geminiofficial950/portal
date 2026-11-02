"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { CheckIcon, PlusIcon, SearchIcon, TrashIcon } from "../../dashboard/_components/icons";
import CredentialsCard, { type Credentials } from "../_components/CredentialsCard";
import GroupsPanel from "./GroupsPanel";
import { initials } from "@/lib/format";
import { STUDENT_ID_MAX, type GroupDTO } from "@/lib/group-meta";
import { generatePassword } from "@/lib/password";
import type { StudentDTO, StudentStatus } from "@/lib/students";
import {
  createStudentAction,
  deleteStudentAction,
  resetPasswordAction,
  setStudentGroupAction,
  setStudentStatusAction,
} from "./actions";

const statusStyle: Record<StudentStatus, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Pending: "bg-amber-100 text-amber-700",
  Suspended: "bg-rose-100 text-rose-700",
};

const filters = ["All", "Active", "Pending", "Suspended"] as const;

const NO_GROUP = "none";

export default function StudentsClient({
  initialStudents,
  courses,
  initialGroups,
}: {
  initialStudents: StudentDTO[];
  courses: { code: string; title: string }[];
  initialGroups: GroupDTO[];
}) {
  const emptyForm = { name: "", email: "", courses: [] as string[], password: "", studentId: "", groupId: "" };
  const [list, setList] = useState(initialStudents);
  const [groups, setGroups] = useState(initialGroups);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [groupFilter, setGroupFilter] = useState<string>("All"); // "All", NO_GROUP or a groupId
  const [adding, setAdding] = useState(false);
  const [managingGroups, setManagingGroups] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [saving, startSaving] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const visible = list.filter(
    (s) =>
      (filter === "All" || s.status === filter) &&
      (groupFilter === "All" || (groupFilter === NO_GROUP ? !s.groupId : s.groupId === groupFilter)) &&
      (!q || s.name.toLowerCase().includes(q) || s.email.includes(q) || s.studentId.toLowerCase().includes(q)),
  );

  const addStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.courses.length === 0) return void toast.error("Pick at least one course.");
    startSaving(async () => {
      const res = await createStudentAction(form);
      if (!res.ok) return void toast.error(res.error);
      setList((l) => [res.student, ...l]);
      setCredentials({
        title: `${res.student.name} added`,
        idLabel: "Student ID",
        id: res.student.studentId,
        email: res.student.email,
        password: form.password,
      });
      setForm(emptyForm);
      if (res.student.groupId) {
        setGroups((g) => g.map((x) => (x.groupId === res.student.groupId ? { ...x, students: x.students + 1 } : x)));
      }
      setAdding(false);
    });
  };

  const run = async (studentId: string, action: () => Promise<{ ok: boolean; error?: string }>, onOk: () => void) => {
    setBusyId(studentId);
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

  const setStatus = (s: StudentDTO, status: StudentStatus) =>
    run(s.studentId, () => setStudentStatusAction(s.studentId, status), () => {
      setList((l) => l.map((x) => (x.studentId === s.studentId ? { ...x, status } : x)));
      toast.success(`${s.name} ${status === "Active" ? "activated" : status.toLowerCase()}`);
    });

  const resetPassword = (s: StudentDTO) => {
    if (!window.confirm(`Set a new password for ${s.name}? Their old password will stop working.`)) return;
    const password = generatePassword();
    run(s.studentId, () => resetPasswordAction(s.studentId, password), () =>
      setCredentials({ title: `New password for ${s.name}`, idLabel: "Student ID", id: s.studentId, email: s.email, password }),
    );
  };

  const groupName = (id: string | null) => (id ? groups.find((g) => g.groupId === id)?.name : undefined);

  const moveToGroup = (s: StudentDTO, groupId: string | null) =>
    run(s.studentId, () => setStudentGroupAction(s.studentId, groupId), () => {
      setList((l) => l.map((x) => (x.studentId === s.studentId ? { ...x, groupId } : x)));
      setGroups((g) =>
        g.map((x) => ({ ...x, students: x.students + (x.groupId === groupId ? 1 : 0) - (x.groupId === s.groupId ? 1 : 0) })),
      );
      toast.success(groupId ? `${s.name} moved to ${groupName(groupId)}` : `${s.name} removed from the group`);
    });

  const remove = (s: StudentDTO) => {
    if (!window.confirm(`Delete ${s.name}? They won’t be able to log in again.`)) return;
    run(s.studentId, () => deleteStudentAction(s.studentId), () => {
      setList((l) => l.filter((x) => x.studentId !== s.studentId));
      toast.success(`${s.name} deleted`);
    });
  };

  const inputClass =
    "rounded-xl bg-white px-4 py-3 text-sm outline-none ring-1 ring-ink/5 placeholder:text-ink/35 focus:ring-plum/30";

  return (
    <div className="animate-fade-up space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-ink sm:text-[1.65rem]">Students</h1>
          <p className="mt-1 text-sm text-ink/55">Create student logins, manage access and track progress.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a file download, not a page */}
          <a
            href="/api/student-logs"
            className="rounded-full bg-lilac px-5 py-3 text-sm font-medium text-plum transition hover:bg-plum/10"
          >
            Download all logs (CSV)
          </a>
          <button
            onClick={() => setManagingGroups((v) => !v)}
            className="rounded-full bg-lilac px-5 py-3 text-sm font-medium text-plum transition hover:bg-plum/10"
          >
            Groups ({groups.length})
          </button>
        <button
          onClick={() => {
            setAdding((v) => !v);
            setForm((f) => ({ ...f, password: f.password || generatePassword() }));
          }}
          className="inline-flex items-center gap-2 rounded-full bg-plum px-5 py-3 text-sm font-medium text-white transition hover:bg-plum-light"
        >
          <PlusIcon className="h-4 w-4" />
          Add student
        </button>
        </div>
      </div>

      {managingGroups && (
        <GroupsPanel
          groups={groups}
          onChange={setGroups}
          onDeleted={(groupId) => {
            setList((l) => l.map((x) => (x.groupId === groupId ? { ...x, groupId: null } : x)));
            if (groupFilter === groupId) setGroupFilter("All");
          }}
          onClose={() => setManagingGroups(false)}
        />
      )}

      {credentials && <CredentialsCard credentials={credentials} onClose={() => setCredentials(null)} />}

      {adding && (
        <form onSubmit={addStudent} className="grid gap-3 rounded-[1.75rem] bg-lilac/80 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Full name"
            className={inputClass}
          />
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email"
            className={inputClass}
          />
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
          <input
            value={form.studentId}
            maxLength={STUDENT_ID_MAX}
            onChange={(e) => setForm({ ...form, studentId: e.target.value.toUpperCase() })}
            placeholder="Student ID (blank = automatic)"
            aria-label="Student ID"
            className={`${inputClass} font-mono placeholder:font-sans`}
          />
          <select
            value={form.groupId}
            onChange={(e) => setForm({ ...form, groupId: e.target.value })}
            aria-label="Group"
            className={`${inputClass} min-w-0 lg:col-span-2`}
          >
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {g.name}
              </option>
            ))}
          </select>
          {/* A student can be enrolled in several courses */}
          <fieldset className="rounded-xl bg-white p-3 ring-1 ring-ink/5 sm:col-span-2">
            <legend className="sr-only">Courses</legend>
            <p className="px-1 pb-2 text-xs font-medium text-ink">Courses (tick one or more)</p>
            <div className="grid gap-1 sm:grid-cols-2">
              {courses.map((c) => (
                <label key={c.code} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-lilac">
                  <input
                    type="checkbox"
                    checked={form.courses.includes(c.code)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        courses: e.target.checked ? [...form.courses, c.code] : form.courses.filter((x) => x !== c.code),
                      })
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 accent-plum"
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{c.code}</span> · {c.title}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="submit"
            disabled={saving}
            className="self-end whitespace-nowrap rounded-full bg-plum px-6 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:cursor-wait disabled:opacity-60 sm:col-span-2 lg:col-span-1"
          >
            {saving ? "Saving…" : "Create login"}
          </button>
        </form>
      )}

      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by group">
          <span className="mr-1 text-xs font-medium text-ink/60">Group:</span>
          {[
            { id: "All", label: "All groups", count: list.length },
            ...groups.map((g) => ({ id: g.groupId, label: g.name, count: list.filter((s) => s.groupId === g.groupId).length })),
            { id: NO_GROUP, label: "No group", count: list.filter((s) => !s.groupId).length },
          ].map((g) => (
            <button
              key={g.id}
              onClick={() => setGroupFilter(g.id)}
              className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                groupFilter === g.id ? "bg-ink text-white" : "border border-ink/10 bg-white text-ink/70 hover:bg-lilac"
              }`}
            >
              {g.label} <span className="opacity-60">({g.count})</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const count = f === "All" ? list.length : list.filter((s) => s.status === f).length;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                  filter === f ? "bg-plum text-white" : "bg-lilac text-ink/70 hover:bg-plum/10"
                }`}
              >
                {f} <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
        <label className="flex w-full items-center gap-2 rounded-full bg-lilac px-4 py-2.5 sm:w-72">
          <SearchIcon className="h-4 w-4 text-plum/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or ID…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-ink/5 bg-white shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-lilac/60 text-[11px] uppercase tracking-wide text-ink/45">
              <tr>
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Courses</th>
                <th className="px-5 py-3 font-medium">Group</th>
                <th className="px-5 py-3 font-medium">Progress</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Added</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {visible.map((s) => {
                const busy = busyId === s.studentId;
                return (
                  <tr key={s.studentId} className={`transition hover:bg-lilac/30 ${busy ? "opacity-50" : ""}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-peach text-[11px] font-bold text-white">
                          {initials(s.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-ink">{s.name}</p>
                          <p className="truncate text-[11px] text-ink/45">
                            {s.studentId} · {s.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium text-plum">
                      {s.courses.map((c) => (
                        <span key={c.code} className="block whitespace-nowrap">
                          {c.code}
                        </span>
                      ))}
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={s.groupId ?? ""}
                        disabled={busy}
                        onChange={(e) => moveToGroup(s, e.target.value || null)}
                        aria-label={`Group for ${s.name}`}
                        title={groupName(s.groupId) ?? "No group"}
                        className="max-w-40 truncate rounded-lg bg-lilac px-2.5 py-1.5 text-xs text-ink outline-none focus:ring-2 focus:ring-plum/30"
                      >
                        <option value="">No group</option>
                        {groups.map((g) => (
                          <option key={g.groupId} value={g.groupId}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-lilac">
                          <div className="h-full rounded-full bg-plum" style={{ width: `${s.progress}%` }} />
                        </div>
                        <span className="text-[11px] text-ink/55">{s.progress}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${statusStyle[s.status]}`}>{s.status}</span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink/55">{s.enrolled}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/superadmin/students/${s.studentId}`}
                          className="rounded-full bg-plum/10 px-3 py-1.5 text-[11px] font-medium text-plum hover:bg-plum hover:text-white"
                        >
                          Progress
                        </Link>
                        {s.status === "Pending" && (
                          <button
                            disabled={busy}
                            onClick={() => setStatus(s, "Active")}
                            className="inline-flex items-center gap-1 rounded-full bg-plum px-3 py-1.5 text-[11px] font-medium text-white hover:bg-plum-light"
                          >
                            <CheckIcon className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        )}
                        {s.status === "Active" && (
                          <button
                            disabled={busy}
                            onClick={() => setStatus(s, "Suspended")}
                            className="rounded-full bg-lilac px-3 py-1.5 text-[11px] font-medium text-ink/70 hover:bg-rose-50 hover:text-rose-700"
                          >
                            Suspend
                          </button>
                        )}
                        {s.status === "Suspended" && (
                          <button
                            disabled={busy}
                            onClick={() => setStatus(s, "Active")}
                            className="rounded-full bg-lilac px-3 py-1.5 text-[11px] font-medium text-ink/70 hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            Reactivate
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => resetPassword(s)}
                          className="rounded-full bg-lilac px-3 py-1.5 text-[11px] font-medium text-ink/70 hover:bg-plum/10 hover:text-plum"
                        >
                          Reset password
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => remove(s)}
                          aria-label={`Delete ${s.name}`}
                          className="rounded-full p-1.5 text-ink/35 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-ink/45">
            {list.length === 0 ? "No students yet — click Add student to create the first login." : "No students match this search."}
          </p>
        )}
      </div>
    </div>
  );
}
