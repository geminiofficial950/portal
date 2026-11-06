import FileList from "./FileList";
import SubmittedFiles from "./SubmittedFiles";
import { legacyResponses, type Module } from "@/lib/module-meta";
import type { SubmissionDTO } from "@/lib/submission-meta";

// Student HTML (older typed theory answers) is sanitised on the server before it is stored (lib/sanitize.ts)
const Html = ({ html }: { html?: string }) =>
  html ? <div className="rich-text text-sm leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: html }} /> : <p className="text-sm text-ink">—</p>;

// What a student handed in for one module, for staff: every activity with their answer (and, for multiple choice,
// the reference answer admin ticked — a guide for the trainer, nothing is scored), then their uploaded files.
// `module` is null when the module was deleted: the files and any typed text still show.
export default function ModuleSubmission({ module, sub }: { module: Module | null; sub: SubmissionDTO }) {
  const activities = module?.activities ?? [];
  const responses = legacyResponses(activities, sub.content);

  return (
    <div className="space-y-4">
      {activities.length > 0 && (
        <ol className="space-y-3">
          {activities.map((a, i) => {
            const v = responses[a.id];
            return (
              <li key={a.id} className="rounded-xl bg-lilac/40 p-4">
                <p className="whitespace-pre-wrap text-sm font-semibold text-ink">
                  {i + 1}. {a.prompt}
                </p>
                <div className="mt-2 text-sm text-ink">
                  {a.type === "mcq" && (
                    <ul className="space-y-1">
                      {a.options.map((o, k) => (
                        <li
                          key={k}
                          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${v === k ? "bg-plum font-semibold text-white" : "bg-white"}`}
                        >
                          {o}
                          {v === k && <span className="text-xs">← student’s answer</span>}
                          {a.answer === k && <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${v === k ? "bg-white/25" : "bg-emerald-100 text-emerald-800"}`}>reference</span>}
                        </li>
                      ))}
                      {typeof v !== "number" && <li className="text-amber-800">Not answered</li>}
                    </ul>
                  )}
                  {(a.type === "short" || a.type === "image") && (
                    <>
                      {a.type === "image" && a.image && (
                        // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route
                        <img src={`/api/files/${a.image.id}?inline=1`} alt={a.prompt} className="mb-2 max-h-56 rounded-lg bg-white object-contain ring-1 ring-ink/10" />
                      )}
                      <p className="whitespace-pre-wrap rounded-lg bg-white px-3 py-2">{typeof v === "string" && v ? v : <span className="text-amber-800">Not answered</span>}</p>
                    </>
                  )}
                  {a.type === "matching" && (
                    <table className="w-full overflow-hidden rounded-lg bg-white text-left">
                      <tbody className="divide-y divide-ink/10">
                        {a.pairs.map((p, k) => {
                          const pick = Array.isArray(v) ? v[k] : "";
                          return (
                            <tr key={k}>
                              <td className="px-3 py-1.5 font-medium">{p.left}</td>
                              <td className="px-3 py-1.5">{pick || <span className="text-amber-800">—</span>}</td>
                              <td className="px-3 py-1.5 text-xs">{pick === p.right ? "matches the pair set by admin" : `pair set by admin: ${p.right}`}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Older typed formats kept for old submissions */}
      {sub.content.theory?.map((t, i) => (
        <div key={t.questionId} className="space-y-2 rounded-xl bg-lilac/30 p-4">
          <p className="text-sm font-semibold text-ink">Answer {i + 1}</p>
          <Html html={t.html} />
          {t.files && t.files.length > 0 && <FileList files={t.files} />}
        </div>
      ))}
      {sub.content.html && <Html html={sub.content.html} />}
      {sub.content.evidence?.map((e) => (
        <FileList key={e.evidenceId} files={e.files} emptyText="Nothing uploaded for this item." />
      ))}

      {sub.content.slots?.length ? (
        <SubmittedFiles sub={sub} />
      ) : (
        sub.files.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Uploaded files</p>
            <FileList files={sub.files} />
          </div>
        )
      )}
      {!activities.length && !sub.files.length && !sub.content.theory && !sub.content.html && <p className="text-sm text-ink">Nothing was handed in.</p>}
    </div>
  );
}
