"use client";

import { useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { DownloadIcon } from "../../dashboard/_components/icons";
import { importStudentsAction, type ImportResult } from "./actions";
import { toCsv, type ImportRow } from "@/lib/student-import-meta";
import type { StudentDTO } from "@/lib/students";

type Checked = ImportRow & { batchId: string | null; errors: string[] };
type Preview = { rows: Checked[]; extra: string[] };

const btn = "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

// Bulk upload: download the template → fill it → upload → (asked about extra columns) → check → add → login details file
export default function BulkUpload({ onAdded, onClose }: { onAdded: (students: StudentDTO[]) => void; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [askExtra, setAskExtra] = useState(false);
  const [keep, setKeep] = useState<string[]>([]); // extra columns to import; the rest are skipped
  const [result, setResult] = useState<ImportResult | null>(null);
  const [adding, start] = useTransition();

  const ready = preview?.rows.filter((r) => !r.errors.length) ?? [];
  const problems = preview?.rows.filter((r) => r.errors.length) ?? [];

  const reset = () => {
    setPreview(null);
    setResult(null);
    setFileName("");
    setKeep([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const read = async (file: File) => {
    reset();
    setFileName(file.name);
    setReading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/students/import/preview", { method: "POST", body });
      const data = (await res.json().catch(() => ({ error: "Couldn’t read this file." }))) as Preview | { error: string };
      if ("error" in data) {
        toast.error(data.error);
        setFileName("");
        return;
      }
      setPreview(data);
      if (data.extra.length) {
        setKeep(data.extra); // each starts as Import; the admin can Skip any
        setAskExtra(true);
      }
    } finally {
      setReading(false);
    }
  };

  const add = () =>
    start(async () => {
      const res = await importStudentsAction(ready, keep);
      if (!res.ok) return void toast.error(res.error);
      setResult(res);
      setPreview(null);
      if (res.students.length) onAdded(res.students);
      toast.success(`${res.created.length} student${res.created.length === 1 ? "" : "s"} added`);
    });

  const downloadLogins = () => {
    if (!result) return;
    const csv = toCsv([["Full name", "Email", "Student ID", "Password", "Course code"], ...result.created.map((c) => [c.name, c.email, c.studentId, c.password, c.courses.join("; ")])]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "student-logins.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-label="Bulk upload" className="space-y-4 rounded-[1.5rem] bg-lilac/80 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Bulk upload students</h2>
          <p className="text-sm text-ink">1. Download the template · 2. Fill one student per row · 3. Upload it here.</p>
        </div>
        <button type="button" onClick={onClose} className={`${btn} border border-ink/20 bg-white text-ink hover:bg-lilac`}>
          Close
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a href="/api/students/import/template?format=xlsx" className={`${btn} border border-plum/40 bg-white text-plum hover:bg-lilac`}>
          <DownloadIcon className="h-4 w-4" />
          Template (Excel)
        </a>
        <a href="/api/students/import/template?format=csv" className={`${btn} border border-plum/40 bg-white text-plum hover:bg-lilac`}>
          <DownloadIcon className="h-4 w-4" />
          Template (CSV)
        </a>
        <label className={`${btn} cursor-pointer bg-plum text-white hover:bg-plum-light ${reading || adding ? "pointer-events-none opacity-60" : ""}`}>
          {reading ? "Reading…" : "Upload filled file"}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            aria-label="Student file"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && read(e.target.files[0])}
          />
        </label>
        {fileName && <span className="text-sm text-ink">{fileName}</span>}
      </div>

      {preview && (
        <div className="space-y-3 rounded-2xl bg-white p-4">
          <p className="text-base font-semibold text-ink">
            {ready.length} ready to add
            {problems.length ? ` · ${problems.length} with problems (they’ll be skipped)` : ""}
            {keep.length ? ` · importing extra: ${keep.join(", ")}` : ""}
            {preview.extra.length > keep.length ? ` · skipping: ${preview.extra.filter((c) => !keep.includes(c)).join(", ")}` : ""}
          </p>
          {problems.length > 0 && (
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl bg-rose-50 p-3 text-sm text-ink" aria-label="Rows with problems">
              {problems.map((r) => (
                <li key={r.row}>
                  <span className="font-semibold">
                    Row {r.row}
                    {r.name ? ` · ${r.name}` : ""}:
                  </span>{" "}
                  {r.errors.join("; ")}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={add} disabled={!ready.length || adding} className={`${btn} bg-plum text-white hover:bg-plum-light`}>
              {adding ? "Adding…" : `Add ${ready.length} student${ready.length === 1 ? "" : "s"}`}
            </button>
            {preview.extra.length > 0 && (
              <button type="button" onClick={() => setAskExtra(true)} className={`${btn} border border-ink/20 bg-white text-ink hover:bg-lilac`}>
                Change extra columns
              </button>
            )}
            <button type="button" onClick={reset} className={`${btn} border border-ink/20 bg-white text-ink hover:bg-lilac`}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-3 rounded-2xl bg-white p-4">
          <p className="text-base font-semibold text-ink">
            {result.created.length} student{result.created.length === 1 ? "" : "s"} added
            {result.skipped.length ? ` · ${result.skipped.length} skipped` : ""}
          </p>
          {result.created.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={downloadLogins} className={`${btn} bg-plum text-white hover:bg-plum-light`}>
                <DownloadIcon className="h-4 w-4" />
                Download login details
              </button>
              <span className="text-sm text-ink">Name, email, Student ID and password of each new student — share them with the students.</span>
            </div>
          )}
          {result.skipped.length > 0 && (
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl bg-rose-50 p-3 text-sm text-ink" aria-label="Skipped rows">
              {result.skipped.map((r) => (
                <li key={r.row}>
                  <span className="font-semibold">
                    Row {r.row}
                    {r.name ? ` · ${r.name}` : ""}:
                  </span>{" "}
                  {r.errors.join("; ")}
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={reset} className={`${btn} border border-ink/20 bg-white text-ink hover:bg-lilac`}>
            Upload another file
          </button>
        </div>
      )}

      {askExtra &&
        preview &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/50 p-4 font-dm text-ink">
            <div role="dialog" aria-modal="true" aria-label="Extra columns" className="w-full max-w-md space-y-4 rounded-[1.5rem] bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-semibold text-ink">New columns in your file</h3>
              <p className="text-base text-ink">These columns aren’t in the template. Choose for each one: import it into the students’ records, or skip it.</p>
              <ul className="space-y-2" aria-label="Extra columns to import or skip">
                {preview.extra.map((col) => {
                  const on = keep.includes(col);
                  const pick = (yes: boolean) => setKeep((k) => (yes ? [...new Set([...k, col])] : k.filter((x) => x !== col)));
                  return (
                    <li key={col} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-lilac/50 px-3 py-2">
                      <span className="min-w-0 break-words font-semibold text-ink">{col}</span>
                      <span role="radiogroup" aria-label={`${col}: import or skip`} className="flex overflow-hidden rounded-lg ring-1 ring-ink/20">
                        <button type="button" role="radio" aria-checked={on} aria-label={`Import ${col}`} onClick={() => pick(true)} className={`px-3 py-1.5 text-sm font-semibold ${on ? "bg-plum text-white" : "bg-white text-ink hover:bg-lilac"}`}>
                          Import
                        </button>
                        <button type="button" role="radio" aria-checked={!on} aria-label={`Skip ${col}`} onClick={() => pick(false)} className={`px-3 py-1.5 text-sm font-semibold ${!on ? "bg-ink text-white" : "bg-white text-ink hover:bg-lilac"}`}>
                          Skip
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-end">
                <button type="button" onClick={() => setAskExtra(false)} className={`${btn} bg-plum text-white hover:bg-plum-light`}>
                  Continue
                </button>
              </div>
            </div>
          </div>,
          document.getElementById("portal-root") ?? document.body,
        )}
    </section>
  );
}
