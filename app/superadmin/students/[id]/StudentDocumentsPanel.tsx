"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { deleteRequestAction, requestDocumentAction } from "../../../actions/documents";
import LocalTime from "../../../dashboard/assessment/_components/LocalTime";
import { TrashIcon } from "../../../dashboard/_components/icons";
import { DOC_NOTE_MAX, DOC_TITLE_MAX, sortPlacementDocs, type DocumentRequestDTO, type PlacementDocDTO, type SignedDocDTO } from "@/lib/document-meta";

const card = "space-y-3 rounded-[1.5rem] bg-lilac/80 p-5";

// Super Admin: a student's signed placement forms, and documents asked of them
export default function StudentDocumentsPanel({
  studentId,
  name,
  courseCodes,
  placementDocs,
  signed,
  initialRequests,
}: {
  studentId: string;
  name: string;
  courseCodes: string[];
  placementDocs: PlacementDocDTO[];
  signed: SignedDocDTO[];
  initialRequests: DocumentRequestDTO[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [form, setForm] = useState({ name: "", note: "" });
  const [saving, startSaving] = useTransition();

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    startSaving(async () => {
      const res = await requestDocumentAction(studentId, form.name, form.note);
      if (!res.ok) return void toast.error(res.error);
      setRequests((r) => [...r, res.request]);
      setForm({ name: "", note: "" });
      toast.success(`Asked ${name} for “${res.request.name}”`);
    });
  };

  const remove = (r: DocumentRequestDTO) => {
    const note = r.file ? " The file they uploaded will be deleted too." : "";
    if (!window.confirm(`Delete the request for “${r.name}”?${note}`)) return;
    startSaving(async () => {
      const res = await deleteRequestAction(r.requestId);
      if (!res.ok) return void toast.error(res.error);
      setRequests((list) => list.filter((x) => x.requestId !== r.requestId));
      toast.success("Request deleted");
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className={card}>
        <h2 className="text-base font-medium text-ink">Placement Documents (signed by the student)</h2>
        <div className="flex flex-wrap gap-2">
          {courseCodes.map((code) => (
            <Link
              key={code}
              href={`/superadmin/courses/${encodeURIComponent(code)}/placement`}
              className="rounded-full bg-plum px-4 py-2 text-xs font-medium text-white transition hover:bg-plum-light"
            >
              Upload / manage {code} forms
            </Link>
          ))}
        </div>
        {placementDocs.length === 0 ? (
          <p className="text-sm text-ink">No placement forms uploaded for this student’s courses yet.</p>
        ) : (
          <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl bg-white">
            {sortPlacementDocs(placementDocs).map((d) => {
              const copy = signed.find((s) => s.docId === d.docId);
              return (
                <li key={d.docId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{d.title}</span>
                    <span className="block text-xs text-ink">{d.courseCode}</span>
                  </span>
                  {copy ? (
                    <a
                      href={`/api/files/${copy.file.id}`}
                      className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:underline"
                      title={`Uploaded ${new Date(copy.uploadedAt).toLocaleString("en-AU")}`}
                    >
                      Download signed copy
                    </a>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800">Not uploaded yet</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="text-base font-medium text-ink">Other Requested Documents</h2>
        <form onSubmit={ask} className="space-y-2 rounded-2xl bg-white p-3">
          <input
            required
            value={form.name}
            maxLength={DOC_TITLE_MAX}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Document name, e.g. Police check"
            aria-label="Requested document name"
            className="w-full rounded-xl bg-lilac px-4 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/10 placeholder:text-ink/60 focus:ring-plum/40"
          />
          <div className="flex flex-wrap gap-2">
            <input
              value={form.note}
              maxLength={DOC_NOTE_MAX}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Note for the student (optional)"
              aria-label="Note for the student"
              className="min-w-0 flex-1 rounded-xl bg-lilac px-4 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/10 placeholder:text-ink/60 focus:ring-plum/40"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition hover:bg-plum-light disabled:opacity-60"
            >
              Request document
            </button>
          </div>
        </form>
        {requests.length === 0 ? (
          <p className="text-sm text-ink">Nothing requested yet.</p>
        ) : (
          <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl bg-white">
            {requests.map((r) => (
              <li key={r.requestId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{r.name}</span>
                  {r.note && <span className="block text-xs text-ink">{r.note}</span>}
                  {r.uploadedAt && (
                    <span className="block text-xs text-ink">
                      Uploaded <LocalTime iso={r.uploadedAt} />
                    </span>
                  )}
                </span>
                {r.file ? (
                  <a href={`/api/files/${r.file.id}`} className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:underline">
                    Download
                  </a>
                ) : (
                  <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800">Waiting for student</span>
                )}
                <button
                  onClick={() => remove(r)}
                  disabled={saving}
                  aria-label={`Delete request ${r.name}`}
                  className="rounded-full p-2 text-ink transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
