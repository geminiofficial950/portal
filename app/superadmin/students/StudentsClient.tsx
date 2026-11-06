"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { CheckIcon, PlusIcon, SearchIcon, TrashIcon } from "../../dashboard/_components/icons";
import CredentialsCard, { type Credentials } from "../_components/CredentialsCard";
import { transferWithChecks } from "../batches/transfer-flow";
import type { BatchDTO } from "@/lib/batch-meta";
import { accountLabel, statusOptions, type CourseStatus } from "@/lib/course-status";
import { initials } from "@/lib/format";
import { STUDENT_ID_MAX } from "@/lib/group-meta";
import { generatePassword } from "@/lib/password";
import type { StudentDTO, StudentStatus } from "@/lib/students";
import { createStudentAction, deleteStudentAction, previewStudentDeletionAction, resetPasswordAction, setCourseStatusAction, setStudentStatusAction } from "./actions";

// Board-style solid status cells (full contrast: dark text on the light amber/orange, white on the rest)
const solidCourse: Record<CourseStatus, string> = {
  Active: "bg-emerald-600 text-white",
  Completed: "bg-sky-600 text-white",
  Deferred: "bg-amber-300 text-ink",
  "Risk of withdrawal": "bg-orange-300 text-ink",
  Withdrawn: "bg-rose-600 text-white",
  Cancelled: "bg-rose-700 text-white",
  Inactive: "bg-slate-500 text-white",
  Competent: "bg-emerald-700 text-white",
  "Not yet competent": "bg-orange-600 text-white",
};
const solidAccount: Record<StudentStatus, string> = {
  Active: "bg-emerald-600 text-white",
  Pending: "bg-amber-300 text-ink",
  Suspended: "bg-rose-600 text-white",
};

const filters = ["All", "Active", "Pending", "Suspended"] as const;
const NO_BATCH = "none";

// Students as a table. Each course has its status (Active, Completed, Withdrawn, Cancelled); the account itself can be
// disabled (no login to any course). Batches are managed on the Batches page — here they're shown only.
// Delete is Super Admin only; Admins disable the account instead.
export default function StudentsClient({
  initialStudents,
  courses,
  batches,
  canDelete,
  batchesHref,
}: {
  initialStudents: StudentDTO[];
  courses: { code: string; title: string }[];
  batches: BatchDTO[];
  canDelete: boolean;
  batchesHref: string;
}) {
  const emptyForm = { name: "", email: "", courses: [] as string[], password: "", studentId: "" };
  const [list, setList] = useState(initialStudents);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [batchFilter, setBatchFilter] = useState<string>("All"); // "All", NO_BATCH or a batchId
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [saving, startSaving] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const batchName = (id: string) => batches.find((b) => b.batchId === id)?.name;
  const courseTitle = (code: string) => courses.find((c) => c.code === code)?.title;

  // Change a student's batch for one course right from the table — same checks as the batch page
  // (destination, trainer coverage, schedule conflicts; their work always stays with them)
  const changeBatch = async (s: StudentDTO, courseCode: string, fromId: string | null, toId: string | null) => {
    if (fromId === toId) return;
    setBusyId(s.studentId);
    try {
      const res = await transferWithChecks({
        studentId: s.studentId,
        studentName: s.name,
        courseCode,
        fromName: fromId ? (batchName(fromId) ?? null) : null,
        to: toId ? { batchId: toId, name: batchName(toId) ?? toId } : null,
      });
      if (!res.ok) return void (res.error && toast.error(res.error));
      setList((all) => all.map((x) => (x.studentId === s.studentId ? { ...x, batchIds: res.batchIds } : x)));
      toast.success(toId ? `${s.name} is now in ${batchName(toId)}` : `${s.name} taken out of the batch`);
    } finally {
      setBusyId(null);
    }
  };
  const q = query.trim().toLowerCase();
  const visible = list.filter(
    (s) =>
      (filter === "All" || s.status === filter) &&
      (batchFilter === "All" || (batchFilter === NO_BATCH ? s.batchIds.length === 0 : s.batchIds.includes(batchFilter))) &&
      (!q || s.name.toLowerCase().includes(q) || s.email.includes(q) || s.studentId.toLowerCase().includes(q)),
  );

  const addStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.courses.length === 0) return void toast.error("Pick at least one course.");
    startSaving(async () => {
      const res = await createStudentAction(form);
      if (!res.ok) return void toast.error(res.error);
      setList((l) => [res.student, ...l]);
      setCredentials({ title: `${res.student.name} added`, idLabel: "Student ID", id: res.student.studentId, email: res.student.email, password: form.password });
      setForm(emptyForm);
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

  const setStatus = (s: StudentDTO, status: StudentStatus) => {
    if (status === "Suspended" && !window.confirm(`Disable ${s.name}? They won’t be able to log in to any course until re-enabled. Their work is kept.`)) return;
    run(s.studentId, () => setStudentStatusAction(s.studentId, status), () => {
      setList((l) => l.map((x) => (x.studentId === s.studentId ? { ...x, status } : x)));
      toast.success(`${s.name} ${status === "Active" ? "enabled" : "disabled"}`);
    });
  };

  const setCourseStatus = (s: StudentDTO, courseCode: string, status: CourseStatus) =>
    run(s.studentId, () => setCourseStatusAction(s.studentId, courseCode, status), () => {
      setList((l) =>
        l.map((x) => (x.studentId === s.studentId ? { ...x, courses: x.courses.map((c) => (c.code === courseCode ? { ...c, status } : c)) } : x)),
      );
      toast.success(`${s.name}: ${courseCode} set to ${status}`);
    });

  const resetPassword = (s: StudentDTO) => {
    if (!window.confirm(`Set a new password for ${s.name}? Their old password will stop working.`)) return;
    const password = generatePassword();
    run(s.studentId, () => resetPasswordAction(s.studentId, password), () =>
      setCredentials({ title: `New password for ${s.name}`, idLabel: "Student ID", id: s.studentId, email: s.email, password }),
    );
  };

  // Shows what's affected first; the login goes, the academic records stay
  const remove = async (s: StudentDTO) => {
    const preview = await previewStudentDeletionAction(s.studentId);
    if (!preview.ok) return void toast.error(preview.error);
    const lines = preview.records.filter((r) => r.count).map((r) => `• ${r.count} ${r.label}`);
    const kept = lines.length ? `\n\nThese records are KEPT for the college (not deleted):\n${lines.join("\n")}` : "";
    const msg = `Delete ${s.name} (${s.studentId})?\n\nTheir login and profile are removed.${kept}\n\nTo stop access but keep the student, disable the account instead.`;
    if (!window.confirm(msg)) return;
    run(s.studentId, () => deleteStudentAction(s.studentId), () => {
      setList((l) => l.filter((x) => x.studentId !== s.studentId));
      toast.success(`${s.name} deleted`);
    });
  };

  const inputClass = "rounded-xl bg-white px-4 py-3 text-sm outline-none ring-1 ring-ink/10 placeholder:text-ink/60 focus:ring-plum/30";
  const smallBtn = "rounded-full px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-60";

  return (
    <div className="animate-fade-up space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-ink sm:text-[1.65rem]">Students</h1>
          <p className="mt-1 text-sm text-ink">Create student logins, set each course status (Active, Withdrawn, Cancelled, Completed, Deferred), and disable accounts. Put students in batches on the Batches page.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a file download, not a page */}
          <a href="/api/student-logs" className="rounded-full bg-lilac px-5 py-3 text-sm font-medium text-plum transition hover:bg-plum/10">
            Download all logs (CSV)
          </a>
          <Link href={batchesHref} className="rounded-full bg-lilac px-5 py-3 text-sm font-medium text-plum transition hover:bg-plum/10">
            Batches ({batches.length})
          </Link>
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

      {credentials && <CredentialsCard credentials={credentials} onClose={() => setCredentials(null)} />}

      {adding && (
        <form onSubmit={addStudent} className="grid gap-3 rounded-[1.75rem] bg-lilac/80 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className={inputClass} />
          <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className={inputClass} />
          <div className="flex items-center gap-2 rounded-xl bg-white pl-4 pr-1.5 ring-1 ring-ink/10 focus-within:ring-plum/30">
            <input
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Password (min 8)"
              aria-label="Password"
              className="min-w-0 flex-1 bg-transparent py-3 font-mono text-sm outline-none placeholder:font-sans placeholder:text-ink/60"
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
          <fieldset className="rounded-xl bg-white p-3 ring-1 ring-ink/10 sm:col-span-2 lg:col-span-3">
            <legend className="sr-only">Courses</legend>
            <p className="px-1 pb-2 text-xs font-medium text-ink">Courses (tick one or more)</p>
            <div className="grid gap-1 sm:grid-cols-2">
              {courses.map((c) => (
                <label key={c.code} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-lilac">
                  <input
                    type="checkbox"
                    checked={form.courses.includes(c.code)}
                    onChange={(e) => setForm({ ...form, courses: e.target.checked ? [...form.courses, c.code] : form.courses.filter((x) => x !== c.code) })}
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
            className="self-end whitespace-nowrap rounded-full bg-plum px-6 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Saving…" : "Create login"}
          </button>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f) => {
            const count = f === "All" ? list.length : list.filter((s) => s.status === f).length;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-2 text-xs font-medium transition ${filter === f ? "bg-plum text-white" : "bg-lilac text-ink hover:bg-plum/10"}`}
              >
                {f === "All" ? "All" : accountLabel(f)} ({count})
              </button>
            );
          })}
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            aria-label="Filter by batch"
            className="rounded-full bg-lilac px-4 py-2 text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-plum/30"
          >
            <option value="All">All batches</option>
            {batches.map((b) => (
              <option key={b.batchId} value={b.batchId}>
                {b.name}
                {b.courseCode ? ` · ${b.courseCode}` : ""}
              </option>
            ))}
            <option value={NO_BATCH}>No batch</option>
          </select>
        </div>
        <label className="flex w-full items-center gap-2 rounded-full bg-lilac px-4 py-2.5 sm:w-72">
          <SearchIcon className="h-4 w-4 text-plum" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or ID…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/60"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[805px] table-fixed xl:min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-lilac/40 text-xs font-semibold text-ink">
                <th className="w-[185px] border-r border-ink/10 px-4 py-2 text-center">Student</th>
                <th className="w-[120px] border-r border-ink/10 px-2 py-2 text-center">Course status</th>
                <th className="w-[130px] border-r border-ink/10 px-2 py-2 text-center">Batch</th>
                <th className="w-[90px] border-r border-ink/10 px-2 py-2 text-center">Progress</th>
                <th className="w-[85px] border-r border-ink/10 px-2 py-2 text-center">Account</th>
                <th className="hidden w-[95px] border-r border-ink/10 px-2 py-2 text-center xl:table-cell">Added</th>
                <th className="w-[210px] px-2 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const busy = busyId === s.studentId;
                return (
                  <tr key={s.studentId} className={`border-b-[8px] border-b-lilac align-middle transition last:border-b-0 hover:bg-lilac/30 ${busy ? "opacity-60" : ""}`}>
                    <td className="border-l-[6px] border-r border-l-plum border-r-ink/10 px-3 py-1">
                      <Link href={`/superadmin/students/${s.studentId}`} title="Open progress" className="group mx-auto flex w-fit max-w-full items-center gap-2.5">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-peach text-[10px] font-bold text-white">{initials(s.name)}</span>
                        <span className="min-w-0 text-left">
                          <span className="block truncate text-[13px] font-semibold text-ink group-hover:text-plum group-hover:underline">{s.name}</span>
                          <span className="block truncate text-[11px] text-ink">
                            {s.studentId} · {s.email}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="border-r border-ink/10 p-0">
                      <ul className="divide-y-2 divide-white">
                        {s.courses.map((c) => (
                          <li key={c.code} className="h-10">
                            <select
                              value={c.status}
                              disabled={busy}
                              onChange={(e) => setCourseStatus(s, c.code, e.target.value as CourseStatus)}
                              title={`${c.code}${courseTitle(c.code) ? ` — ${courseTitle(c.code)}` : ""}`}
                              aria-label={`${c.code} status for ${s.name}`}
                              className={`h-full w-full cursor-pointer appearance-none px-2 text-center text-xs font-semibold outline-none transition hover:brightness-110 focus:ring-2 focus:ring-inset focus:ring-ink/40 ${solidCourse[c.status]}`}
                            >
                              {statusOptions(c.status).map((o) => (
                                <option key={o} value={o} className="bg-white text-ink">
                                  {o}
                                </option>
                              ))}
                            </select>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="border-r border-ink/10 p-0">
                      <ul className="divide-y divide-ink/10">
                        {s.courses.map((c) => {
                          const options = batches.filter((b) => b.courseCode === c.code);
                          const current = s.batchIds.find((id) => options.some((b) => b.batchId === id)) ?? "";
                          return (
                            <li key={c.code} className="h-10">
                              {options.length ? (
                                <select
                                  value={current}
                                  disabled={busy}
                                  onChange={(e) => changeBatch(s, c.code, current || null, e.target.value || null)}
                                  title={`Batch for ${c.code}`}
                                  aria-label={`${c.code} batch for ${s.name}`}
                                  className={`h-full w-full cursor-pointer appearance-none bg-transparent px-2 text-center text-xs font-semibold outline-none transition hover:bg-lilac/60 focus:ring-2 focus:ring-inset focus:ring-plum/40 ${current ? "text-ink" : "text-plum"}`}
                                >
                                  <option value="" className="bg-white text-ink">
                                    {current ? "Take out of batch" : "Choose batch"}
                                  </option>
                                  {options.map((b) => (
                                    <option key={b.batchId} value={b.batchId} className="bg-white text-ink">
                                      {b.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="grid h-full place-items-center text-xs text-ink" title={`No batch has been made for ${c.code} yet`}>
                                  —
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </td>
                    <td className="border-r border-ink/10 px-2 py-2">
                      <div className="relative mx-auto h-6 w-full max-w-[90px] overflow-hidden rounded-md bg-lilac" aria-label={`Progress ${s.progress}%`}>
                        <div className="h-full bg-emerald-400 transition-all" style={{ width: `${s.progress}%` }} />
                        <span className="absolute inset-0 grid place-items-center text-[11px] font-bold text-ink">{s.progress}%</span>
                      </div>
                    </td>
                    <td className="relative h-10 border-r border-ink/10 p-0">
                      <span className={`absolute inset-0 grid place-items-center text-xs font-semibold ${solidAccount[s.status]}`}>{accountLabel(s.status)}</span>
                    </td>
                    <td className="hidden border-r border-ink/10 px-2 py-2 text-center text-xs text-ink xl:table-cell">{s.enrolled}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                        {s.status === "Pending" && (
                          <button disabled={busy} onClick={() => setStatus(s, "Active")} className={`${smallBtn} inline-flex items-center gap-1 bg-plum text-white hover:bg-plum-light`}>
                            <CheckIcon className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        )}
                        {s.status === "Active" && (
                          <button disabled={busy} onClick={() => setStatus(s, "Suspended")} className={`${smallBtn} bg-rose-50 text-rose-800 hover:bg-rose-100`}>
                            Disable
                          </button>
                        )}
                        {s.status === "Suspended" && (
                          <button disabled={busy} onClick={() => setStatus(s, "Active")} className={`${smallBtn} bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}>
                            Reactivate
                          </button>
                        )}
                        <button disabled={busy} onClick={() => resetPassword(s)} className={`${smallBtn} bg-lilac text-ink hover:bg-plum/10`}>
                          Reset password
                        </button>
                        {canDelete && (
                          <button
                            disabled={busy}
                            onClick={() => remove(s)}
                            aria-label={`Delete ${s.name}`}
                            className="rounded-full p-1.5 text-ink transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-ink">
            {list.length === 0 ? "No students yet — click Add student to create the first login." : "No students match this search."}
          </p>
        )}
      </div>
    </div>
  );
}
