"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { uploadRequestedDocAction, uploadSignedDocAction } from "../../actions/documents";
import LocalTime from "../assessment/_components/LocalTime";
import { ClipboardIcon, FileIcon } from "../_components/icons";
import UploadButton from "../_components/UploadButton";
import { docReviewStyle, SIGNED_UPLOADS_MAX, sortPlacementDocs, type DocumentRequestDTO, type PlacementDocDTO, type SignedDocDTO } from "@/lib/document-meta";
import { FILE_RULES } from "@/lib/submission-meta";
import FileActions from "../_components/FileActions";

export type PlacementGroup = { code: string; name: string; text: string; docs: PlacementDocDTO[] };

const card = "rounded-[1.5rem] border border-ink/10 bg-white p-5 sm:p-6";
const empty = "flex items-center gap-3 rounded-[1.5rem] bg-lilac px-5 py-5 text-sm text-ink";
const heading = "flex items-center gap-2.5 text-xl font-medium text-ink";
const headingIcon = "grid h-9 w-9 place-items-center rounded-xl bg-plum text-white";

// Student: placement forms to sign and upload, and documents the college asked for
export default function StudentDocuments({
  placement,
  initialSigned,
  initialRequests,
}: {
  placement: PlacementGroup[];
  initialSigned: SignedDocDTO[];
  initialRequests: DocumentRequestDTO[];
}) {
  const [signed, setSigned] = useState(initialSigned);
  const [requests, setRequests] = useState(initialRequests);
  const multi = placement.length > 1;

  const uploadSigned = (doc: PlacementDocDTO) => async (file: { id: string }) => {
    const res = await uploadSignedDocAction(doc.docId, file.id);
    if (!res.ok) return void toast.error(res.error);
    setSigned((list) => [...list.filter((s) => s.docId !== doc.docId), res.signed]);
    toast.success(`Signed “${doc.title}” uploaded`);
  };

  const uploadRequested = (r: DocumentRequestDTO) => async (file: { id: string }) => {
    const res = await uploadRequestedDocAction(r.requestId, file.id);
    if (!res.ok) return void toast.error(res.error);
    setRequests((list) => list.map((x) => (x.requestId === r.requestId ? res.request : x)));
    toast.success(`“${r.name}” uploaded`);
  };

  return (
    <div id="documents" className="space-y-10">
      {/* Course documents: download only */}
      {placement.some((g) => g.docs.some((d) => d.section === "course")) && (
        <section aria-labelledby="course-docs-heading" className="space-y-3">
          <h2 id="course-docs-heading" className={heading}>
            <span className={headingIcon}>
              <FileIcon className="h-5 w-5" />
            </span>
            Course documents
          </h2>
          <ul className="divide-y divide-ink/10 overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white">
            {placement.flatMap((g) =>
              sortPlacementDocs(g.docs.filter((d) => d.section === "course")).map((d) => (
                <li key={d.docId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <FileIcon className="h-5 w-5 shrink-0 text-plum" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-medium text-ink">{d.title}</span>
                    {d.instructions && <span className="block text-sm text-ink">{d.instructions}</span>}
                    {multi && <span className="block text-xs text-ink">{g.code}</span>}
                  </span>
                  <FileActions file={d.file} title={d.title} size="sm" view={false} />
                </li>
              )),
            )}
          </ul>
        </section>
      )}

      {/* Placement pack */}
      <section aria-labelledby="placement-heading" className="space-y-3">
        <h2 id="placement-heading" className={heading}>
          <span className={headingIcon}>
            <ClipboardIcon className="h-5 w-5" />
          </span>
          Placement pack
        </h2>
        {placement.every((g) => !g.text && g.docs.filter((d) => d.section !== "course").length === 0) && (
          <p className={empty}>
            <ClipboardIcon className="h-6 w-6 shrink-0 text-plum" />
            No placement documents yet. The college will add them here.
          </p>
        )}
        {placement
          .map((g) => ({ ...g, docs: g.docs.filter((d) => d.section !== "course") }))
          .filter((g) => g.text || g.docs.length > 0)
          .map((g) => (
            <div key={g.code} className={`${card} space-y-4`}>
              {multi && (
                <p className="text-sm font-medium text-plum">
                  {g.code} · {g.name}
                </p>
              )}
              {g.text && <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{g.text}</p>}
              {g.docs.length > 0 && (
                <>
                  <p className="text-sm text-ink">
                    <span className="font-medium">How to:</span> download each form, sign it, then upload the signed copy. You can upload more
                    than one file for a form (for example one per page). ({FILE_RULES.label})
                  </p>
                  <ul className="divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/10">
                    {sortPlacementDocs(g.docs).map((d) => {
                      // Uploads are kept: no Replace — each new file is added under the form
                      const record = signed.find((s) => s.docId === d.docId);
                      const mine = record?.uploads ?? [];
                      return (
                        <li key={d.docId} className="space-y-3 px-4 py-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <FileIcon className="h-5 w-5 shrink-0 text-plum" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-ink">{d.title}</span>
                              {d.instructions && <span className="block text-xs text-ink">{d.instructions}</span>}
                              {record && mine.length > 0 && (
                                <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink">
                                  <span className={`rounded-full px-2 py-0.5 font-semibold ${docReviewStyle[record.review.status]}`}>{record.review.status}</span>
                                  {record.review.comment && <span>“{record.review.comment}”</span>}
                                </span>
                              )}
                              {mine.length ? (
                                <span className="block text-xs font-medium text-emerald-800">
                                  Uploaded ✓ · {mine.length} file{mine.length === 1 ? "" : "s"}
                                </span>
                              ) : (
                                <span className="block text-xs text-amber-800">Signed copy not uploaded yet</span>
                              )}
                            </span>
                            <FileActions file={d.file} title={d.title} size="sm" downloadLabel="Download form" view={false} />
                            {mine.length < SIGNED_UPLOADS_MAX && (
                              <UploadButton
                                label={mine.length ? "Upload another file" : "Upload signed copy"}
                                ariaLabel={`Upload signed ${d.title}`}
                                onUploaded={uploadSigned(d)}
                              />
                            )}
                          </div>
                          {mine.length > 0 && (
                            <ul className="space-y-1.5 pl-8">
                              {mine.map((u) => (
                                <li key={u.file.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-emerald-50 px-3 py-2">
                                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">Uploaded</span>
                                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{u.file.name}</span>
                                  <span className="text-xs text-ink">
                                    <LocalTime iso={u.uploadedAt} />
                                  </span>
                                  <FileActions file={u.file} title={`${d.title} (your signed copy)`} size="sm" view={false} />
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          ))}
      </section>

      {/* Documents the college asked this student for */}
      <section aria-labelledby="requested-heading" className="space-y-3">
        <h2 id="requested-heading" className={heading}>
          <span className={headingIcon}>
            <FileIcon className="h-5 w-5" />
          </span>
          Other Requested Documents
        </h2>
        {requests.length === 0 ? (
          <p className={empty}>
            <FileIcon className="h-6 w-6 shrink-0 text-plum" />
            The college hasn’t asked you for any other documents.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {requests.map((r) => (
              <li key={r.requestId} className={`${card} flex flex-col gap-3`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base font-medium text-ink">{r.name}</p>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                      r.file ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {r.file ? "Uploaded" : "Needed"}
                  </span>
                </div>
                {r.note && <p className="text-sm text-ink">{r.note}</p>}
                {r.dueAt && (
                  <p className="text-sm font-medium text-ink">
                    Needed by <LocalTime iso={r.dueAt} />
                  </p>
                )}
                {r.review && (
                  <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${docReviewStyle[r.review.status]}`}>{r.review.status}</span>
                    {r.review.comment && <span>“{r.review.comment}”</span>}
                  </p>
                )}
                {r.file && r.uploadedAt && (
                  <p className="text-xs text-ink">
                    You uploaded <span className="font-medium">{r.file.name}</span> on <LocalTime iso={r.uploadedAt} />
                  </p>
                )}
                {r.file && r.uploadedAt && (
                  <div>
                    <FileActions file={r.file} title={r.name} size="sm" view={false} />
                  </div>
                )}
                <div className="mt-auto">
                  <UploadButton label={r.file ? "Replace file" : "Upload document"} ariaLabel={`Upload ${r.name}`} onUploaded={uploadRequested(r)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
