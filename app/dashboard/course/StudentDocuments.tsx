"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { uploadRequestedDocAction, uploadSignedDocAction } from "../../actions/documents";
import LocalTime from "../assessment/_components/LocalTime";
import { ClipboardIcon, FileIcon } from "../_components/icons";
import UploadButton from "../_components/UploadButton";
import { sortPlacementDocs, type DocumentRequestDTO, type PlacementDocDTO, type SignedDocDTO } from "@/lib/document-meta";
import { FILE_RULES } from "@/lib/submission-meta";

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
    <div className="space-y-10">
      {/* Placement documents */}
      <section aria-labelledby="placement-heading" className="space-y-3">
        <h2 id="placement-heading" className={heading}>
          <span className={headingIcon}>
            <ClipboardIcon className="h-5 w-5" />
          </span>
          Placement Documents
        </h2>
        {placement.every((g) => !g.text && g.docs.length === 0) && (
          <p className={empty}>
            <ClipboardIcon className="h-6 w-6 shrink-0 text-plum" />
            No placement documents yet. The college will add them here.
          </p>
        )}
        {placement
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
                    <span className="font-medium">How to:</span> download each form, sign it, then upload the signed copy. ({FILE_RULES.label})
                  </p>
                  <ul className="divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/10">
                    {sortPlacementDocs(g.docs).map((d) => {
                      const mine = signed.find((s) => s.docId === d.docId);
                      return (
                        <li key={d.docId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                          <FileIcon className="h-5 w-5 shrink-0 text-plum" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-ink">{d.title}</span>
                            {mine ? (
                              <span className="block text-xs text-emerald-800">
                                Signed copy uploaded <LocalTime iso={mine.uploadedAt} /> ·{" "}
                                <a href={`/api/files/${mine.file.id}`} className="underline">
                                  {mine.file.name}
                                </a>
                              </span>
                            ) : (
                              <span className="block text-xs text-amber-800">Signed copy not uploaded yet</span>
                            )}
                          </span>
                          <a
                            href={`/api/files/${d.file.id}`}
                            className="rounded-full border border-plum px-4 py-2 text-xs font-medium text-plum transition hover:bg-plum hover:text-white"
                          >
                            Download form
                          </a>
                          <UploadButton
                            label={mine ? "Replace signed copy" : "Upload signed copy"}
                            ariaLabel={`Upload signed ${d.title}`}
                            onUploaded={uploadSigned(d)}
                          />
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
                {r.file && r.uploadedAt && (
                  <p className="text-xs text-ink">
                    You uploaded{" "}
                    <a href={`/api/files/${r.file.id}`} className="font-medium text-plum underline">
                      {r.file.name}
                    </a>{" "}
                    on <LocalTime iso={r.uploadedAt} />
                  </p>
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
