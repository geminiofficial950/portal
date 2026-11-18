"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { addPlacementDocAction, listSignedCopiesAction, removePlacementDocAction, savePlacementTextAction } from "../../../../actions/documents";
import { FileIcon, TrashIcon } from "../../../../dashboard/_components/icons";
import UploadButton from "../../../../dashboard/_components/UploadButton";
import { DOC_TITLE_MAX, docReviewStyle, PLACEMENT_DOC_TYPES, PLACEMENT_TEXT_MAX, sortPlacementDocs, type PlacementDocDTO, type SignedDocDTO } from "@/lib/document-meta";
import LocalTime from "../../../../dashboard/assessment/_components/LocalTime";
import { FILE_RULES } from "@/lib/submission-meta";
import FileActions from "../../../../dashboard/_components/FileActions";

const card = "space-y-4 rounded-[1.5rem] border border-ink/10 bg-white p-5 sm:p-6";

export default function PlacementAdmin({
  courseCode,
  initialText,
  initialDocs,
  signedCounts,
}: {
  courseCode: string;
  initialText: string;
  initialDocs: PlacementDocDTO[];
  signedCounts: Record<string, number>;
}) {
  const [text, setText] = useState(initialText);
  const [savedText, setSavedText] = useState(initialText);
  const [docs, setDocs] = useState(() => sortPlacementDocs(initialDocs));
  // Every standard type stays in the list (a name can be used again), then "Other" for anything else
  const free = PLACEMENT_DOC_TYPES;
  const [type, setType] = useState<string>(free[0] ?? "Other");
  const [otherName, setOtherName] = useState("");
  const [section, setSection] = useState<"placement" | "course">("placement");
  const [instructions, setInstructions] = useState("");
  const pickedType = (free as readonly string[]).includes(type) || type === "Other" ? type : (free[0] ?? "Other");
  const title = pickedType === "Other" ? otherName.trim() : pickedType;
  const [saving, startSaving] = useTransition();
  // which form's signed copies are open, and what was loaded for it
  const [openCopies, setOpenCopies] = useState<string | null>(null);
  const [copies, setCopies] = useState<Record<string, (SignedDocDTO & { name: string })[]>>({});
  const toggleCopies = async (docId: string) => {
    if (openCopies === docId) return setOpenCopies(null);
    setOpenCopies(docId);
    const res = await listSignedCopiesAction(docId);
    if (!res.ok) return void toast.error(res.error);
    setCopies((c) => ({ ...c, [docId]: res.copies }));
  };

  const saveText = () =>
    startSaving(async () => {
      const res = await savePlacementTextAction(courseCode, text);
      if (!res.ok) return void toast.error(res.error);
      setText(res.text);
      setSavedText(res.text);
      toast.success("Placement information saved");
    });

  const addDoc = async (file: { id: string }) => {
    const res = await addPlacementDocAction(courseCode, title, file.id, { section, instructions });
    if (!res.ok) return void toast.error(res.error);
    const next = sortPlacementDocs([...docs, res.doc]);
    setDocs(next);
    setOtherName("");
    setInstructions("");
    toast.success(`“${res.doc.title}” added`);
  };

  const remove = (d: PlacementDocDTO) => {
    const n = signedCounts[d.docId] ?? 0;
    const note = n ? ` The ${n} signed cop${n === 1 ? "y" : "ies"} students uploaded will be deleted too.` : "";
    if (!window.confirm(`Remove “${d.title}”?${note}`)) return;
    startSaving(async () => {
      const res = await removePlacementDocAction(d.docId);
      if (!res.ok) return void toast.error(res.error);
      setDocs((list) => list.filter((x) => x.docId !== d.docId));
      toast.success(`“${d.title}” removed`);
    });
  };

  return (
    <div className="space-y-6">
      <section className={card}>
        <div>
          <h2 className="text-base font-medium text-ink">Placement information</h2>
          <p className="mt-0.5 text-sm text-ink">What students need to know about their work placement (hours, where, who to contact…).</p>
        </div>
        <textarea
          rows={6}
          value={text}
          maxLength={PLACEMENT_TEXT_MAX}
          onChange={(e) => setText(e.target.value)}
          aria-label="Placement information"
          placeholder="Write the placement information for students…"
          className="w-full resize-y rounded-xl bg-lilac px-4 py-3 text-sm text-ink outline-none ring-1 ring-ink/10 placeholder:text-ink/60 focus:ring-plum/40"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={saveText}
            disabled={saving || text === savedText}
            className="rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition hover:bg-plum-light disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save information"}
          </button>
          {text !== savedText && <span className="text-xs text-amber-800">Not saved yet</span>}
        </div>
      </section>

      <section className={card}>
        <div>
          <h2 className="text-base font-medium text-ink">Course documents &amp; placement pack</h2>
          <p className="mt-0.5 text-sm text-ink">
            Course documents are for students to download. Placement-pack forms are downloaded, completed and uploaded back into a matching
            slot; staff then approve them or ask for changes. ({FILE_RULES.label})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-lilac p-3">
          <select
            value={section}
            onChange={(e) => setSection(e.target.value as "placement" | "course")}
            aria-label="Section"
            className="rounded-xl bg-white px-4 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/10 focus:ring-plum/40"
          >
            <option value="placement">Placement pack (students upload it back)</option>
            <option value="course">Course document (download only)</option>
          </select>
          <input
            value={instructions}
            maxLength={300}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Instructions for students (optional)"
            aria-label="Instructions"
            className="min-w-0 basis-full rounded-xl bg-white px-4 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/10 placeholder:text-ink/60 focus:ring-plum/40"
          />
          <select
            value={pickedType}
            onChange={(e) => setType(e.target.value)}
            aria-label="Which document"
            className="min-w-0 flex-1 rounded-xl bg-white px-4 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/10 focus:ring-plum/40"
          >
            {free.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value="Other">Other (type a name)</option>
          </select>
          {pickedType === "Other" && (
            <input
              value={otherName}
              maxLength={DOC_TITLE_MAX}
              onChange={(e) => setOtherName(e.target.value)}
              placeholder="Document name"
              aria-label="Other document name"
              className="min-w-0 flex-1 rounded-xl bg-white px-4 py-2.5 text-sm text-ink outline-none ring-1 ring-ink/10 placeholder:text-ink/60 focus:ring-plum/40"
            />
          )}
          {title ? (
            <UploadButton label="Choose file & add" ariaLabel="Upload placement document" onUploaded={addDoc} className="rounded-full bg-plum px-5 py-2.5 text-sm font-medium text-white transition hover:bg-plum-light" />
          ) : (
            <span className="text-xs text-ink">Type the document name, then choose the file</span>
          )}
        </div>

        {docs.length === 0 ? (
          <p className="text-sm text-ink">No documents yet.</p>
        ) : (
          <ul className="divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/10">
            {docs.map((d) => (
              <li key={d.docId} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                <FileIcon className="h-5 w-5 shrink-0 text-plum" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">
                    {d.title}{" "}
                    <span className="rounded-full bg-lilac px-2 py-0.5 text-[10px] font-semibold text-plum">{d.section === "course" ? "Course document" : "Placement pack"}</span>
                  </span>
                  {d.instructions && <span className="block text-xs text-ink">{d.instructions}</span>}
                  <span className="block truncate text-xs text-ink">{d.file.name}</span>
                </span>
                <FileActions file={d.file} title={d.title} size="sm" />
                {(signedCounts[d.docId] ?? 0) > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggleCopies(d.docId)}
                    aria-expanded={openCopies === d.docId}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${openCopies === d.docId ? "bg-plum text-white" : "bg-lilac text-plum hover:bg-plum hover:text-white"}`}
                  >
                    {signedCounts[d.docId]} signed cop{signedCounts[d.docId] === 1 ? "y" : "ies"} uploaded {openCopies === d.docId ? "▴" : "▾"}
                  </button>
                ) : (
                  <span className="rounded-full bg-lilac px-3 py-1 text-xs font-medium text-ink">0 signed copies uploaded</span>
                )}
                <button
                  onClick={() => remove(d)}
                  disabled={saving}
                  aria-label={`Remove ${d.title}`}
                  className="rounded-full p-2 text-ink transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
                </div>

                {/* who uploaded this form: each student with their files to view or download */}
                {openCopies === d.docId && (
                  <div className="mt-3 rounded-xl bg-[#f6f5fa] p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
                      <span className="text-sm font-semibold text-ink">Signed copies</span>
                      <a
                        href={`/api/placement/${encodeURIComponent(d.docId)}/zip`}
                        download
                        className="rounded-full bg-plum px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-plum-light"
                      >
                        Download all (ZIP)
                      </a>
                    </div>
                    {!copies[d.docId] ? (
                      <p className="px-1 py-2 text-sm text-ink">Loading…</p>
                    ) : (
                      <ul className="space-y-2">
                        {copies[d.docId].map((c) => (
                          <li key={c.studentId} className="rounded-lg bg-white px-3 py-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-ink">{c.name}</span>
                              <span className="font-mono text-xs text-ink">{c.studentId}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${docReviewStyle[c.review.status]}`}>{c.review.status}</span>
                              <span className="text-xs text-ink">
                                {c.uploads.length} file{c.uploads.length === 1 ? "" : "s"}
                              </span>
                            </div>
                            <ul className="mt-2 space-y-1.5">
                              {/* in the order the student uploaded them: 1 = first */}
                              {c.uploads.map((u, i) => (
                                <li key={u.file.id} className="flex flex-wrap items-center gap-2">
                                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-lilac text-xs font-bold text-plum">{i + 1}</span>
                                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{u.file.name}</span>
                                  <span className="text-xs text-ink">
                                    <LocalTime iso={u.uploadedAt} />
                                  </span>
                                  <FileActions file={u.file} title={`${d.title} — ${c.name}`} size="sm" />
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
