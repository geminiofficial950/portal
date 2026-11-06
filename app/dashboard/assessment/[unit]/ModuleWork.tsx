"use client";

import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { CheckIcon, ClockIcon, FileIcon } from "../../_components/icons";
import FileActions from "../../_components/FileActions";
import FileList from "../../_components/FileList";
import ExtensionRequest from "../_components/ExtensionRequest";
import FeedbackResponse from "../_components/FeedbackResponse";
import LocalTime from "../_components/LocalTime";
import SignaturePad, { type Signature } from "../_components/SignaturePad";
import SubmitPhoto from "../_components/SubmitPhoto";
import { submitModuleAction } from "../actions";
import { deadlineLocked, type ExtensionRequestDTO } from "@/lib/deadline-meta";
import type { DeclarationText } from "@/lib/declaration";
import { isAnswered, legacyResponses, MODULE_LIMITS, needsSubmission, type Activity, type ActivityAnswer, type Module, type Responses } from "@/lib/module-meta";
import { FILE_RULES, formatBytes, needsRework, statusLabel, type FileRef, type SubmissionDTO } from "@/lib/submission-meta";
import { canEditWork } from "@/lib/unit-meta";

const card = "rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.15)] sm:p-6";

// One document to read or download (nothing opens by itself: View opens it, Download saves it)
export function DocumentRow({ file, title }: { file: FileRef; title: string }) {
  return (
    <li className={`${card} flex flex-wrap items-center gap-4`} aria-label={title}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-lilac text-[11px] font-bold uppercase text-plum">{file.name.split(".").pop()}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold leading-snug text-ink">{title}</span>
        <span className="block truncate text-sm text-ink">
          {file.name} · {formatBytes(file.size)}
        </span>
      </span>
      <FileActions file={file} title={title} />
    </li>
  );
}

// The declaration certificate made when the student submitted
function DeclarationLink({ sub }: { sub: SubmissionDTO }) {
  if (!sub.content.declaration) return null;
  return (
    <a
      href={`/declaration/${sub.submissionId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-2 rounded-xl border border-current/30 bg-white px-4 py-2 text-sm font-semibold text-plum transition hover:bg-lilac"
    >
      <FileIcon className="h-4 w-4" />
      View declaration (receipt)
    </a>
  );
}

// Where the module stands: Pending marking / Satisfactory / Not satisfactory / Additional information requested, with feedback
export function Outcome({ sub, onSaved }: { sub: SubmissionDTO; onSaved?: (s: SubmissionDTO) => void }) {
  if (sub.status === "Draft") return null;
  if (sub.status === "Submitted") {
    return (
      <div className="rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <p className="flex items-center gap-2 text-base font-semibold">
          <ClockIcon className="h-4 w-4 shrink-0" />
          Pending marking
        </p>
        <p className="mt-1">
          Submitted{sub.submittedAt && <> on <LocalTime iso={sub.submittedAt} /></>} — your trainer will review it.
        </p>
        <DeclarationLink sub={sub} />
      </div>
    );
  }
  const tone = sub.status === "Accepted" ? "bg-emerald-50 text-emerald-900" : sub.status === "MoreDocs" ? "bg-orange-50 text-orange-900" : "bg-rose-50 text-rose-900";
  return (
    <div className={`rounded-2xl px-5 py-4 ${tone}`}>
      <p className="text-base font-semibold">
        {statusLabel[sub.status]}
        {sub.attempt > 1 && <span className="font-normal"> · attempt {sub.attempt}</span>}
      </p>
      {sub.status === "MoreDocs" && <p className="mt-1 text-sm">Please add what your trainer asked for below and submit again.</p>}
      {sub.status === "Rejected" && <p className="mt-1 text-sm">Please read the feedback, update your work and submit again.</p>}
      {sub.feedback && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{sub.feedback}</p>}
      {sub.decidedBy && (
        <p className="mt-2 text-xs">
          {sub.decidedBy}
          {sub.decidedAt && <> · <LocalTime iso={sub.decidedAt} /></>}
        </p>
      )}
      {sub.markedFiles.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-sm font-semibold">Marked copy from your trainer</p>
          <FileList files={sub.markedFiles} />
        </div>
      )}
      <DeclarationLink sub={sub} />
      {onSaved && <FeedbackResponse sub={sub} onSaved={onSaved} />}
      {sub.history.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium">Earlier feedback ({sub.history.length})</summary>
          <ul className="mt-2 space-y-2">
            {sub.history.map((h) => (
              <li key={h.attempt} className="rounded-xl bg-white/70 px-3 py-2">
                <span className="font-medium">
                  Attempt {h.attempt} · {statusLabel[h.status]}
                </span>{" "}
                — {h.feedback || "No comment"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// One activity: the question and the student's answer (read-only once handed in)
function ActivityField({ a, n, value, onChange }: { a: Activity; n: number; value: ActivityAnswer | undefined; onChange?: (v: ActivityAnswer) => void }) {
  const ro = !onChange;
  const box = "w-full resize-y rounded-xl bg-white px-4 py-3 text-base text-ink outline-none ring-1 ring-ink/15 placeholder:text-ink/60 focus:ring-plum/40 disabled:bg-lilac/40";
  return (
    <fieldset className={card}>
      <legend className="sr-only">Activity {n}</legend>
      <p className="flex gap-3 text-base font-medium text-ink">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs ${isAnswered(a, value ?? null) ? "bg-emerald-600 text-white" : "bg-lilac text-plum"}`}>{n}</span>
        <span className="whitespace-pre-wrap pt-0.5">{a.prompt}</span>
      </p>
      <div className="mt-4 pl-10">
        {a.type === "mcq" && (
          <div className="grid gap-2">
            {a.options.map((opt, k) => (
              <label
                key={k}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-base transition ${value === k ? "bg-plum text-white" : "bg-lilac/70 text-ink"} ${ro ? "" : "cursor-pointer hover:bg-lilac"}`}
              >
                <input type="radio" disabled={ro} checked={value === k} onChange={() => onChange?.(k)} className="h-4 w-4 accent-peach" />
                {opt}
              </label>
            ))}
          </div>
        )}
        {(a.type === "short" || a.type === "image") && (
          <div className="space-y-3">
            {a.type === "image" && a.image && (
              // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route
              <img src={`/api/files/${a.image.id}?inline=1`} alt={a.prompt} className="max-h-80 w-full rounded-xl bg-white object-contain ring-1 ring-ink/10" />
            )}
            <textarea
              rows={4}
              disabled={ro}
              value={typeof value === "string" ? value : ""}
              maxLength={MODULE_LIMITS.answerText}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder="Type your answer here"
              aria-label={`Your answer to activity ${n}`}
              className={box}
            />
          </div>
        )}
        {a.type === "matching" && (
          <MatchingField a={a} value={Array.isArray(value) ? value : a.pairs.map(() => "")} onChange={onChange} />
        )}
      </div>
    </fieldset>
  );
}

function MatchingField({ a, value, onChange }: { a: Extract<Activity, { type: "matching" }>; value: string[]; onChange?: (v: string[]) => void }) {
  // The right-hand column in a fixed, non-matching order (A–Z), so the answer isn't given away
  const choices = [...a.pairs.map((p) => p.right)].sort((x, y) => x.localeCompare(y));
  return (
    <ul className="space-y-2">
      {a.pairs.map((p, i) => (
        <li key={i} className="grid items-center gap-2 rounded-xl bg-lilac/50 px-4 py-2.5 sm:grid-cols-2">
          <span className="text-base font-medium text-ink">{p.left}</span>
          <select
            disabled={!onChange}
            value={value[i] ?? ""}
            onChange={(e) => onChange?.(value.map((v, j) => (j === i ? e.target.value : v)))}
            aria-label={`Match for ${p.left}`}
            className="rounded-xl bg-white px-3 py-2 text-base text-ink outline-none ring-1 ring-ink/15 focus:ring-plum/40"
          >
            <option value="">Choose…</option>
            {choices.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </li>
      ))}
    </ul>
  );
}

// A module, as the student works on it: instructions, documents, activities, uploads, then the declaration and signature.
// Every submission goes to "Pending marking" — nothing is marked automatically.
export default function ModuleWork({
  courseCode,
  unitCode,
  module: m,
  sub,
  due,
  requests,
  photoRequired,
  declaration,
  onSaved,
}: {
  courseCode: string;
  unitCode: string;
  module: Module;
  sub: SubmissionDTO | undefined;
  due: string | null; // this student's deadline for the module
  requests: ExtensionRequestDTO[]; // their extension requests for it
  photoRequired: boolean;
  declaration: DeclarationText;
  onSaved: (s: SubmissionDTO) => void;
}) {
  const submits = needsSubmission(m);
  // Past the deadline, unfinished work locks (content + submitting); handed-in or marked work isn't affected
  const locked = submits && deadlineLocked(due, sub?.status);
  const canEdit = submits && canEditWork(sub?.status, locked, false);
  const [responses, setResponses] = useState<Responses>(() => (sub ? legacyResponses(m.activities, sub.content) : {}));
  const [files, setFiles] = useState<FileRef[]>(sub && !sub.content.slots ? sub.files : []);
  const [slotFiles, setSlotFiles] = useState<Record<string, FileRef[]>>(() =>
    Object.fromEntries(
      m.upload.slots.map((s, i) => [
        s.id,
        sub && !sub.content.slots
          ? i === 0
            ? sub.files
            : [] // handed in before named uploads were set: show those files under the first one
          : (sub?.content.slots?.find((x) => x.slotId === s.id)?.fileIds ?? []).map((id) => sub?.files.find((f) => f.id === id)).filter((f): f is FileRef => !!f),
      ]),
    ),
  );
  const workKey = () => JSON.stringify([responses, files.map((f) => f.id), slotFiles]);
  const [savedKey, setSavedKey] = useState(workKey);
  const [ticked, setTicked] = useState<boolean[]>(() => declaration.points.map(() => false));
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [askPhoto, setAskPhoto] = useState(false);
  const [saving, startSaving] = useTransition();
  const dirty = canEdit && workKey() !== savedKey;
  const draftSaved = sub?.status === "Draft" && !dirty;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const send = (mode: "draft" | "submit", photoId: string | null = null) => {
    if (mode === "submit" && !photoId) {
      const unanswered = m.activities.findIndex((a) => !isAnswered(a, responses[a.id]));
      if (unanswered >= 0) return void toast.error(`Answer activity ${unanswered + 1} first.`);
      const missing = m.upload.enabled ? m.upload.slots.find((s) => !slotFiles[s.id]?.length) : undefined;
      if (missing) return void toast.error(`Upload “${missing.label}” first.`);
      if (m.upload.enabled && !m.upload.slots.length && !files.length) return void toast.error("Upload your completed work first.");
      if (!ticked.every(Boolean)) return void toast.error("Tick every point of the declaration before you submit.");
      if (!agreed) return void toast.error(`Tick “${declaration.agree}” before you submit.`);
      if (!signature) return void toast.error("Sign the declaration before you submit.");
      if (photoRequired) return setAskPhoto(true);
      if (!window.confirm("Submit to your trainer? You can’t change it while it’s pending marking.")) return;
    }
    setAskPhoto(false);
    startSaving(async () => {
      const work = {
        responses,
        fileIds: files.map((f) => f.id),
        slots: m.upload.slots.map((s) => ({ slotId: s.id, fileIds: (slotFiles[s.id] ?? []).map((f) => f.id) })),
      };
      const res = await submitModuleAction(
        courseCode,
        unitCode,
        m.id,
        work,
        mode,
        photoId,
        mode === "submit" && ticked.every(Boolean) && agreed,
        mode === "submit" && signature ? { fileId: signature.file.id, method: signature.method } : null,
      );
      if (!res.ok) return void toast.error(res.error);
      setSavedKey(workKey());
      onSaved(res.submission);
      toast.success(mode === "submit" ? "Submitted — now pending marking. Your declaration is your receipt." : "Draft saved");
    });
  };

  // Marked Satisfactory: the module is complete — only the result and feedback show
  if (sub?.status === "Accepted") return <Outcome sub={sub} onSaved={onSaved} />;

  return (
    <section className="space-y-5">
      {sub && <Outcome sub={sub} onSaved={onSaved} />}
      {locked && due && <ExtensionRequest courseCode={courseCode} unitCode={unitCode} moduleId={m.id} due={due} requests={requests} />}
      {!locked && <>
      {m.instructions && <p className={`${card} whitespace-pre-wrap text-base leading-relaxed text-ink`}>{m.instructions}</p>}

      {m.files.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-ink">{submits ? "Read and download" : "Documents"}</h3>
          <ul className="space-y-3">
            {m.files.map((f) => (
              <DocumentRow key={f.id} file={f} title={f.name.replace(/\.[^.]+$/, "")} />
            ))}
          </ul>
        </div>
      )}

      {m.activities.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-ink">Activities</h3>
            <span className="text-sm font-medium text-ink">
              {m.activities.filter((a) => isAnswered(a, responses[a.id])).length} / {m.activities.length} answered
            </span>
          </div>
          {m.activities.map((a, i) => (
            <ActivityField
              key={a.id}
              a={a}
              n={i + 1}
              value={responses[a.id]}
              onChange={canEdit ? (v) => setResponses((r) => ({ ...r, [a.id]: v })) : undefined}
            />
          ))}
        </div>
      )}

      {m.upload.enabled && (
        <div className={`${card} space-y-3`}>
          <div>
            <h3 className="text-lg font-semibold text-ink">Upload your work</h3>
            <p className="mt-0.5 text-sm text-ink">
              {!canEdit ? "What you handed in:" : m.upload.slots.length ? `Upload a file for each item (${FILE_RULES.label}).` : `You can attach several files (${FILE_RULES.label}).`}
            </p>
          </div>
          {m.upload.slots.length ? (
            <ol className="space-y-3">
              {m.upload.slots.map((s, i) => {
                const done = !!slotFiles[s.id]?.length;
                return (
                  <li key={s.id} className="rounded-xl border border-ink/10 p-3">
                    <p className="mb-2 flex items-center gap-2 text-base font-semibold text-ink">
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? "bg-emerald-600 text-white" : "bg-lilac text-plum"}`}>
                        {done ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
                      </span>
                      {s.label}
                    </p>
                    <FileList
                      files={slotFiles[s.id] ?? []}
                      onChange={canEdit ? (next) => setSlotFiles((x) => ({ ...x, [s.id]: next.slice(0, FILE_RULES.maxPerSlot) })) : undefined}
                      emptyText={canEdit ? "Not uploaded yet." : "Nothing uploaded."}
                      uploadLabel="Upload file"
                      inputLabel={`Upload ${s.label}`}
                    />
                  </li>
                );
              })}
            </ol>
          ) : (
            <FileList
              files={files}
              onChange={canEdit ? (next) => setFiles(next.slice(0, FILE_RULES.maxFiles)) : undefined}
              emptyText="No files uploaded."
              uploadLabel="Upload file"
              inputLabel="Upload your completed work"
            />
          )}
        </div>
      )}

      {canEdit && (
        <div className={`${card} space-y-3`}>
          <h3 className="text-lg font-semibold text-ink">Declaration</h3>
          <p className="text-base text-ink">{declaration.intro}</p>
          <ul className="space-y-2">
            {declaration.points.map((p, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2 text-base text-ink transition hover:bg-lilac">
                  <input
                    type="checkbox"
                    checked={ticked[i] ?? false}
                    onChange={(e) => setTicked((t) => t.map((v, j) => (j === i ? e.target.checked : v)))}
                    className="mt-1 h-5 w-5 shrink-0 accent-plum"
                  />
                  {p}
                </label>
              </li>
            ))}
          </ul>
          <label className="flex w-fit cursor-pointer items-center gap-3 rounded-xl bg-lilac px-4 py-3 text-base font-semibold text-ink">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-5 w-5 accent-plum" />
            {declaration.agree}
          </label>
          <div className="space-y-2 border-t border-ink/10 pt-4">
            <p className="text-base font-semibold text-ink">Your signature</p>
            <SignaturePad value={signature} onChange={setSignature} />
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => send("submit")}
            disabled={saving}
            className="rounded-xl bg-plum px-6 py-3.5 text-base font-semibold text-white transition hover:bg-plum-light disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Saving…" : needsRework(sub?.status) ? "Submit again" : "Submit to trainer"}
          </button>
          <button
            onClick={() => send("draft")}
            disabled={saving || !dirty}
            className="rounded-xl border border-plum/30 bg-lilac px-6 py-3.5 text-base font-semibold text-plum transition hover:bg-plum/10 disabled:opacity-50"
          >
            Save draft
          </button>
          {dirty && <span className="text-sm font-medium text-amber-800">Not saved yet</span>}
          {draftSaved && <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">Draft saved</span>}
        </div>
      )}
      </>}
      {askPhoto && <SubmitPhoto title="Submit to your trainer" onCancel={() => setAskPhoto(false)} onConfirm={(p) => send("submit", p.id)} />}
    </section>
  );
}
