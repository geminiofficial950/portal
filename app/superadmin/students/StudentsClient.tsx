"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { CheckIcon, ClockIcon, DownloadIcon, InfoIcon, PlusIcon, SearchIcon, TrashIcon } from "../../dashboard/_components/icons";
import CredentialsCard, { type Credentials } from "../_components/CredentialsCard";
import { transferWithChecks } from "../batches/transfer-flow";
import CourseStatusDrawer from "./CourseStatusDrawer";
import type { BatchDTO } from "@/lib/batch-meta";
import { courseStatusStyle, parseStatusChange, type CourseStatus } from "@/lib/course-status";
import { STUDENT_ID_MAX } from "@/lib/group-meta";
import { generatePassword } from "@/lib/password";
import type { StudentLogDTO } from "@/lib/student-logs";
import type { StudentDTO, StudentStatus } from "@/lib/students";
import { createStudentAction, deleteStudentAction, previewStudentDeletionAction, resetPasswordAction, setStudentStatusAction } from "./actions";

const accountTone: Record<StudentStatus, string> = {
  Active: "bg-emerald-100 text-emerald-800",
  Pending: "bg-amber-100 text-amber-900",
  Suspended: "bg-rose-100 text-rose-800",
};
const accountWord: Record<StudentStatus, string> = { Active: "Enabled", Pending: "Pending", Suspended: "Disabled" };
const NO_BATCH = "none";
const fmtDay = (iso: string) => new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

// Students: one row per course enrolment (a student in two courses has two rows). Status badges are read-only —
// Manage opens a side panel to change the course status (reason required, recorded), the batch, or the account.
// Delete is Super Admin only; Admins disable the account instead.
export default function StudentsClient({
  initialStudents,
  courses,
  batches,
  canDelete,
  batchesHref,
  recentChanges,
}: {
  initialStudents: StudentDTO[];
  courses: { code: string; title: string }[];
  batches: BatchDTO[];
  canDelete: boolean;
  batchesHref: string;
  recentChanges: StudentLogDTO[];
}) {
  const emptyForm = { name: "", email: "", courses: [] as string[], password: "", studentId: "" };
  const [list, setList] = useState(initialStudents);
  const [recent, setRecent] = useState(recentChanges);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | StudentStatus>("All");
  const [batchFilter, setBatchFilter] = useState<string>("All"); // "All", NO_BATCH or a batchId
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [saving, startSaving] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [managing, setManaging] = useState<{ studentId: string; code: string } | null>(null);

  const batchName = (id: string) => batches.find((b) => b.batchId === id)?.name;
  const courseTitle = (code: string) => courses.find((c) => c.code === code)?.title ?? code;
  const batchOf = (s: StudentDTO, code: string) => s.batchIds.find((id) => batches.some((b) => b.batchId === id && b.courseCode === code)) ?? "";

  const q = query.trim().toLowerCase();
  const visible = list.filter(
    (s) =>
      (filter === "All" || s.status === filter) &&
      (batchFilter === "All" || (batchFilter === NO_BATCH ? s.batchIds.length === 0 : s.batchIds.includes(batchFilter))) &&
      (!q || s.name.toLowerCase().includes(q) || s.email.includes(q) || s.studentId.toLowerCase().includes(q)),
  );
  const rows = visible.flatMap((s) => s.courses.map((c) => ({ s, c })));
  const tabs: { key: "All" | StudentStatus; label: string }[] = [
    { key: "All", label: "All students" },
    { key: "Active", label: "Active" },
    { key: "Suspended", label: "Disabled" },
    ...(list.some((s) => s.status === "Pending") ? [{ key: "Pending" as const, label: "Pending" }] : []),
  ];

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

  // Change a student's batch for one course — same checks as the batch page (destination, trainer coverage, conflicts)
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

  const setStatus = (s: StudentDTO, status: StudentStatus) => {
    if (status === "Suspended" && !window.confirm(`Disable ${s.name}? They won’t be able to log in to any course until re-enabled. Their work is kept.`)) return;
    run(s.studentId, () => setStudentStatusAction(s.studentId, status), () => {
      setList((l) => l.map((x) => (x.studentId === s.studentId ? { ...x, status } : x)));
      toast.success(`${s.name} ${status === "Active" ? "enabled" : "disabled"}`);
    });
  };

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
      setManaging(null);
      toast.success(`${s.name} deleted`);
    });
  };

  const inputClass = "rounded-xl bg-white px-4 py-3 text-sm outline-none ring-1 ring-ink/10 placeholder:text-ink/60 focus:ring-plum/30";
  const sideBtn = "rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60";
  const open = managing ? list.find((x) => x.studentId === managing.studentId) : undefined;
  const openCourse = open?.courses.find((c) => c.code === managing?.code);

  return (
    // While the Manage panel is open the page makes room on the right, so the table stays visible beside it
    <div className={`animate-fade-up space-y-6 transition-[padding] ${open ? "lg:pr-[29rem]" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Students</h1>
          <p className="mt-1 text-base text-ink">Manage enrolments and account access.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a file download, not a page */}
          <a href="/api/student-logs" className="inline-flex items-center gap-2 rounded-xl border border-plum/40 bg-white px-4 py-2.5 text-sm font-semibold text-plum transition hover:bg-lilac">
            <DownloadIcon className="h-4 w-4" />
            Export logs
          </a>
          <Link href={batchesHref} className="rounded-xl border border-plum/40 bg-white px-4 py-2.5 text-sm font-semibold text-plum transition hover:bg-lilac">
            Batches ({batches.length})
          </Link>
          <button
            onClick={() => {
              setAdding((v) => !v);
              setForm((f) => ({ ...f, password: f.password || generatePassword() }));
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-plum px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-plum-light"
          >
            <PlusIcon className="h-4 w-4" />
            Add student
          </button>
        </div>
      </div>

      {credentials && <CredentialsCard credentials={credentials} onClose={() => setCredentials(null)} />}

      {adding && (
        <form onSubmit={addStudent} className="grid gap-3 rounded-[1.5rem] bg-lilac/80 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
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
            <button type="button" onClick={() => setForm({ ...form, password: generatePassword() })} className="shrink-0 rounded-lg bg-lilac px-2.5 py-1.5 text-[11px] font-medium text-plum hover:bg-plum/10">
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
          <button type="submit" disabled={saving} className="self-end whitespace-nowrap rounded-full bg-plum px-6 py-3 text-sm font-medium text-white transition hover:bg-plum-light disabled:cursor-wait disabled:opacity-60">
            {saving ? "Saving…" : "Create login"}
          </button>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-4 py-2.5 ring-1 ring-ink/15 focus-within:ring-2 focus-within:ring-plum/40 sm:max-w-md">
          <SearchIcon className="h-4 w-4 text-ink" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or student ID" className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink/70" />
        </label>
        <select
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value)}
          aria-label="Filter by batch"
          className="rounded-xl bg-white px-4 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/15 focus:ring-2 focus:ring-plum/40"
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

      <div role="tablist" aria-label="Filter by account" className="inline-flex overflow-hidden rounded-xl border border-ink/15 bg-white">
        {tabs.map((t) => {
          const count = t.key === "All" ? list.length : list.filter((s) => s.status === t.key).length;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={filter === t.key}
              onClick={() => setFilter(t.key)}
              className={`border-r border-ink/10 px-5 py-2.5 text-sm font-semibold transition last:border-r-0 ${filter === t.key ? "bg-lilac text-plum" : "text-ink hover:bg-lilac/50"}`}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-sm font-semibold text-ink">
                <th className="px-3 py-3">Student</th>
                <th className="px-3 py-3">Course</th>
                <th className="px-3 py-3">Course status</th>
                <th className="px-3 py-3">Account</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {rows.map(({ s, c }) => {
                const batch = batchOf(s, c.code);
                return (
                  <tr key={`${s.studentId}-${c.code}`} className={`transition hover:bg-lilac/30 ${busyId === s.studentId ? "opacity-60" : ""}`}>
                    <td className="px-3 py-3">
                      <Link href={`/superadmin/students/${s.studentId}`} title="Open progress" className="group block">
                        <span className="block whitespace-nowrap font-semibold text-ink group-hover:text-plum group-hover:underline">{s.name}</span>
                        <span className="block text-xs text-ink">{s.studentId}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span className="block max-w-[15rem] truncate text-ink" title={courseTitle(c.code)}>
                        {courseTitle(c.code)}
                      </span>
                      <span className="block text-xs text-ink">
                        {c.code}
                        {batch ? ` · ${batchName(batch)}` : " · No batch"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${courseStatusStyle[c.status]}`}>{c.status}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${accountTone[s.status]}`}>{accountWord[s.status]}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => setManaging({ studentId: s.studentId, code: c.code })}
                        aria-label={`Manage ${s.name} ${c.code}`}
                        className="rounded-xl border border-plum/50 px-4 py-1.5 text-sm font-semibold text-plum transition hover:bg-plum hover:text-white"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-ink">{list.length === 0 ? "No students yet — click Add student to create the first login." : "No students match this search."}</p>
        )}
      </div>

      <p className="flex items-center gap-2 text-sm text-ink">
        <InfoIcon className="h-4 w-4 shrink-0" />
        Status badges are read-only. Select Manage to make a change.
      </p>

      <section aria-labelledby="recent-heading" className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5">
        <h2 id="recent-heading" className="flex items-center gap-2 text-lg font-semibold text-ink">
          <ClockIcon className="h-5 w-5" />
          Recent changes
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-ink">No course status changes yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => {
              const { change, reason, by } = parseStatusChange(r.detail);
              return (
                <li key={`${r.studentId}-${r.at}`} className="rounded-xl border border-ink/10 px-4 py-2.5 text-sm text-ink">
                  <span className="font-semibold">{r.studentName}</span> · {r.courseCode} · {change} · {fmtDay(r.at)}
                  {(reason || by) && (
                    <span className="block text-ink">
                      {reason}
                      {by ? ` — ${by}` : ""}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {open && openCourse && (
        <CourseStatusDrawer
          key={`${open.studentId}-${openCourse.code}`}
          student={{ studentId: open.studentId, name: open.name }}
          course={{ code: openCourse.code, name: courseTitle(openCourse.code), detail: batchName(batchOf(open, openCourse.code)) }}
          current={openCourse.status}
          onClose={() => setManaging(null)}
          onSaved={(status: CourseStatus, change) => {
            setList((l) => l.map((x) => (x.studentId === open.studentId ? { ...x, courses: x.courses.map((c) => (c.code === openCourse.code ? { ...c, status } : c)) } : x)));
            setRecent((r) => [change, ...r].slice(0, 8));
            setManaging(null);
          }}
        >
          <div className="space-y-2 border-t border-ink/10 pt-5">
            <p className="text-sm font-semibold text-ink">Batch for {openCourse.code}</p>
            {batches.some((b) => b.courseCode === openCourse.code) ? (
              <select
                value={batchOf(open, openCourse.code)}
                disabled={busyId === open.studentId}
                onChange={(e) => changeBatch(open, openCourse.code, batchOf(open, openCourse.code) || null, e.target.value || null)}
                aria-label={`${openCourse.code} batch for ${open.name}`}
                className="w-full rounded-xl bg-white px-3.5 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/15 focus:ring-2 focus:ring-plum/40"
              >
                <option value="">{batchOf(open, openCourse.code) ? "Take out of batch" : "No batch — choose one"}</option>
                {batches
                  .filter((b) => b.courseCode === openCourse.code)
                  .map((b) => (
                    <option key={b.batchId} value={b.batchId}>
                      {b.name}
                    </option>
                  ))}
              </select>
            ) : (
              <p className="text-sm text-ink">No batch has been made for this course yet.</p>
            )}
            <p className="text-xs text-ink">Moving shows trainer coverage and schedule conflicts first; the student’s work stays with them.</p>
          </div>

          <div className="space-y-2 border-t border-ink/10 pt-5">
            <p className="text-sm font-semibold text-ink">
              Account · <span className={`rounded-full px-2.5 py-0.5 text-xs ${accountTone[open.status]}`}>{accountWord[open.status]}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {open.status === "Pending" && (
                <button disabled={busyId === open.studentId} onClick={() => setStatus(open, "Active")} className={`${sideBtn} inline-flex items-center gap-1 bg-plum text-white hover:bg-plum-light`}>
                  <CheckIcon className="h-4 w-4" />
                  Approve
                </button>
              )}
              {open.status === "Active" && (
                <button disabled={busyId === open.studentId} onClick={() => setStatus(open, "Suspended")} className={`${sideBtn} bg-rose-50 text-rose-800 hover:bg-rose-100`}>
                  Disable
                </button>
              )}
              {open.status === "Suspended" && (
                <button disabled={busyId === open.studentId} onClick={() => setStatus(open, "Active")} className={`${sideBtn} bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}>
                  Enable
                </button>
              )}
              <button disabled={busyId === open.studentId} onClick={() => resetPassword(open)} className={`${sideBtn} bg-lilac text-ink hover:bg-plum/10`}>
                Reset password
              </button>
              {canDelete && (
                <button
                  disabled={busyId === open.studentId}
                  onClick={() => remove(open)}
                  aria-label={`Delete ${open.name}`}
                  className={`${sideBtn} inline-flex items-center gap-1.5 text-rose-700 hover:bg-rose-50`}
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
          </div>
        </CourseStatusDrawer>
      )}
    </div>
  );
}
