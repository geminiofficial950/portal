import FileList from "./FileList";
import type { FileRef, SubmissionDTO } from "@/lib/submission-meta";

// Files a student handed in for a Theory / Workplacement Task. When the task asked for named attachments,
// the files are grouped under each one; otherwise it's the plain list.
export default function SubmittedFiles({ sub, emptyText }: { sub: SubmissionDTO; emptyText?: string }) {
  const slots = sub.content.slots;
  if (!slots?.length) return <FileList files={sub.files} emptyText={emptyText} />;
  const byId = new Map(sub.files.map((f) => [f.id, f]));
  return (
    <ol className="space-y-3">
      {slots.map((slot, i) => (
        <li key={slot.slotId} className="rounded-xl border border-ink/10 p-3">
          <p className="mb-2 text-sm font-semibold text-ink">
            {i + 1}. {slot.label}
          </p>
          <FileList
            files={slot.fileIds.map((id) => byId.get(id)).filter((f): f is FileRef => !!f)}
            emptyText="Nothing uploaded for this item."
          />
        </li>
      ))}
    </ol>
  );
}
