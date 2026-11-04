"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { addPlacementDocAction, removePlacementDocAction, savePlacementTextAction } from "../../../../actions/documents";
import { FileIcon, TrashIcon } from "../../../../dashboard/_components/icons";
import UploadButton from "../../../../dashboard/_components/UploadButton";
import { DOC_TITLE_MAX, PLACEMENT_DOC_TYPES, PLACEMENT_TEXT_MAX, sortPlacementDocs, type PlacementDocDTO } from "@/lib/document-meta";
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
  // Standard types not uploaded yet, then "Other" for anything else
  const free = PLACEMENT_DOC_TYPES.filter((t) => !docs.some((d) => d.title === t));
  const [type, setType] = useState<string>(free[0] ?? "Other");
  const [otherName, setOtherName] = useState("");
  const pickedType = free.includes(type as (typeof free)[number]) || type === "Other" ? type : (free[0] ?? "Other");
  const title = pickedType === "Other" ? otherName.trim() : pickedType;
  const [saving, startSaving] = useTransition();

  const saveText = () =>
    startSaving(async () => {
      const res = await savePlacementTextAction(courseCode, text);
      if (!res.ok) return void toast.error(res.error);
      setText(res.text);
      setSavedText(res.text);
      toast.success("Placement information saved");
    });

  const addDoc = async (file: { id: string }) => {
    const res = await addPlacementDocAction(courseCode, title, file.id);
    if (!res.ok) return void toast.error(res.error);
    const next = sortPlacementDocs([...docs, res.doc]);
    setDocs(next);
    setOtherName("");
    setType(PLACEMENT_DOC_TYPES.find((t) => !next.some((d) => d.title === t)) ?? "Other");
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
          <h2 className="text-base font-medium text-ink">Placement documents</h2>
          <p className="mt-0.5 text-sm text-ink">
            Upload the forms students must sign. They download each one, sign it and upload it back. ({FILE_RULES.label})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-lilac p-3">
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
              <li key={d.docId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <FileIcon className="h-5 w-5 shrink-0 text-plum" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{d.title}</span>
                  <span className="block truncate text-xs text-ink">{d.file.name}</span>
                </span>
                <FileActions file={d.file} title={d.title} size="sm" />
                <span className="rounded-full bg-lilac px-3 py-1 text-xs font-medium text-ink">
                  {signedCounts[d.docId] ?? 0} signed cop{(signedCounts[d.docId] ?? 0) === 1 ? "y" : "ies"} uploaded
                </span>
                <button
                  onClick={() => remove(d)}
                  disabled={saving}
                  aria-label={`Remove ${d.title}`}
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
