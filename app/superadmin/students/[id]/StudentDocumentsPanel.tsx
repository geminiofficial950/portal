"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { deleteRequestAction, requestDocumentAction, reviewRequestAction, reviewSignedDocAction } from "../../../actions/documents";
import LocalTime from "../../../dashboard/assessment/_components/LocalTime";
import { TrashIcon } from "../../../dashboard/_components/icons";
import { DOC_NOTE_MAX, DOC_TITLE_MAX, docReviewStyle, sortPlacementDocs, type DocReview, type DocumentRequestDTO, type PlacementDocDTO, type SignedDocDTO } from "@/lib/document-meta";
import FileActions from "../../../dashboard/_components/FileActions";

const card = "space-y-3 rounded-[1.5rem] bg-lilac/80 p-5";

// Super Admin: a student's signed placement forms, and documents asked of them
export default function StudentDocumentsPanel({
  studentId,
  name,
  courseCodes,
  placementDocs,
  signed,
  initialRequests,
  reviewOnly = false,
}: {
  reviewOnly?: boolean; // trainer: approve / request changes only (no requesting, deleting or managing forms)
  studentId: string;
  name: string;
  courseCodes: string[];
  placementDocs: PlacementDocDTO[];
  signed: SignedDocDTO[];
  initialRequests: DocumentRequestDTO[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [form, setForm] = useState({ name: "", note: "", dueAt: "" });
  const [saving, startSaving] = useTransition();

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    startSaving(async () => {
      const res = await requestDocumentAction(studentId, form.name, form.note, form.dueAt ? new Date(form.dueAt).toISOString() : null);
      if (!res.ok) return void toast.error(res.error);
      setRequests((r) => [...r, res.request]);
      setForm({ name: "", note: "", dueAt: "" });
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
        {!reviewOnly && (
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
        )}
        {placementDocs.length === 0 ? (
          <p className="text-sm text-ink">No placement forms uploaded for this student’s courses yet.</p>
        ) : (
          <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl bg-white">
            {sortPlacementDocs(placementDocs.filter((d) => d.section !== "course")).map((d) => {
              const mine = signed.find((s) => s.docId === d.docId);
              const copies = mine?.uploads ?? [];
              return (
                <li key={d.docId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{d.title}</span>
                    <span className="block text-xs text-ink">{d.courseCode}</span>
                  </span>
                  {copies.length ? (
                    <span className="flex w-full flex-col gap-1.5 sm:w-auto">
                      {copies.map((c, i) => (
                        <span key={c.file.id} className="flex items-center justify-end gap-2">
                          <span className="max-w-48 truncate text-xs text-ink" title={c.file.name}>
                            {copies.length > 1 ? `${i + 1}. ` : ""}
                            {c.file.name}
                          </span>
                          <FileActions file={c.file} title={`${d.title} (signed copy)`} size="sm" />
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800">Not uploaded yet</span>
                  )}
                  {copies.length > 0 && mine && (
                    <ReviewControl review={mine.review} onSave={(status, comment) => reviewSignedDocAction(studentId, d.docId, status, comment).then((r) => (r.ok ? r.signed.review : r.error))} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="text-base font-medium text-ink">Other Requested Documents</h2>
        {!reviewOnly && (
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
            <label className="flex items-center gap-2 text-xs text-ink">
              Due
              <input type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} aria-label="Due date" className="rounded-xl bg-lilac px-3 py-2 text-sm text-ink outline-none ring-1 ring-ink/10" />
            </label>
            <input
              value={form.note}
              maxLength={DOC_NOTE_MAX}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Instructions for the student (optional)"
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
        )}
        {requests.length === 0 ? (
          <p className="text-sm text-ink">Nothing requested yet.</p>
        ) : (
          <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl bg-white">
            {requests.map((r) => (
              <li key={r.requestId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{r.name}</span>
                  {r.note && <span className="block text-xs text-ink">{r.note}</span>}
                  {r.dueAt && (
                    <span className="block text-xs font-medium text-ink">
                      Due <LocalTime iso={r.dueAt} />
                    </span>
                  )}
                  {r.uploadedAt && (
                    <span className="block text-xs text-ink">
                      Uploaded <LocalTime iso={r.uploadedAt} />
                    </span>
                  )}
                </span>
                {r.file ? (
                  <>
                    <FileActions file={r.file} title={r.name} size="sm" />
                    {r.review && (
                      <ReviewControl
                        review={r.review}
                        onSave={(status, comment) =>
                          reviewRequestAction(r.requestId, status, comment).then((x) => {
                            if (!x.ok) return x.error;
                            setRequests((l) => l.map((y) => (y.requestId === r.requestId ? x.request : y)));
                            return x.request.review!;
                          })
                        }
                      />
                    )}
                  </>
                ) : (
                  <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800">Waiting for student</span>
                )}
                {!reviewOnly && <button
                  onClick={() => remove(r)}
                  disabled={saving}
                  aria-label={`Delete request ${r.name}`}
                  className="rounded-full p-2 text-ink transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// Approve a student's upload, or ask for changes (with a comment the student sees)
function ReviewControl({ review, onSave }: { review: DocReview; onSave: (status: string, comment: string) => Promise<DocReview | string> }) {
  const [current, setCurrent] = useState(review);
  const [comment, setComment] = useState("");
  const [busy, start] = useTransition();
  const save = (status: string) =>
    start(async () => {
      const res = await onSave(status, comment);
      if (typeof res === "string") return void toast.error(res);
      setCurrent(res);
      setComment("");
      toast.success(`Marked ${res.status}`);
    });
  return (
    <span className="flex w-full flex-wrap items-center gap-2">
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${docReviewStyle[current.status]}`}>{current.status}</span>
      {current.comment && <span className="text-xs text-ink">“{current.comment}”</span>}
      <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (needed for changes)" aria-label="Review comment" className="min-w-40 flex-1 rounded-lg bg-lilac px-3 py-1.5 text-xs text-ink outline-none" />
      <button onClick={() => save("Approved")} disabled={busy} className="rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
        Approve
      </button>
      <button onClick={() => save("Changes requested")} disabled={busy} className="rounded-full border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-800 disabled:opacity-50">
        Request changes
      </button>
    </span>
  );
}
