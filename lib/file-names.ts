// Renaming uploaded documents (Super Admin renames task documents and Supporting Document files).
// Shared by server code and client components (no server-only imports here).
import type { FileRef } from "./submission-meta";

export const FILE_NAME_MAX = 120;

const extOf = (name: string) => (name.includes(".") ? name.slice(name.lastIndexOf(".")) : "");

/**
 * A safe new name for an uploaded file. The file type never changes: the original extension is always kept
 * (typing it again is fine), characters that aren't safe in a file name become "_", and a blank name keeps the old one.
 */
export function cleanRename(requested: unknown, original: string): string {
  const ext = extOf(original);
  let base = String(requested ?? "").trim().replace(/\s+/g, " ");
  if (ext && base.toLowerCase().endsWith(ext.toLowerCase())) base = base.slice(0, -ext.length).trim();
  base = base.replace(/[^\w.\- ()]/g, "_").replace(/^\.+/, "").slice(0, FILE_NAME_MAX - ext.length);
  return base ? `${base}${ext}` : original;
}

/**
 * The task documents to store when Super Admin / an Admin saves a unit's assessment.
 * A file stays if it was already on the assessment (whoever uploaded it) or this person just uploaded it (`ownedNew`).
 * Anything else the browser sent is dropped. Size always comes from storage; the name the browser sent is
 * used as a rename (cleaned, extension kept). `renames` lists the stored files whose name changed.
 */
export function keepTaskFiles(requested: FileRef[], before: FileRef[], ownedNew: FileRef[]) {
  const known = new Map([...before, ...ownedNew].map((f) => [f.id, f]));
  const seen = new Set<string>();
  const files: FileRef[] = [];
  const renames: { id: string; name: string }[] = [];
  for (const r of requested) {
    const stored = known.get(r.id);
    if (!stored || seen.has(r.id)) continue;
    seen.add(r.id);
    const name = cleanRename(r.name, stored.name);
    if (name !== stored.name) renames.push({ id: r.id, name });
    files.push({ id: stored.id, name, size: stored.size });
  }
  return { files, renames };
}

/** A Supporting Document title is a path in the folder ("Week 1/Notes.pdf"): rename only the last part */
export function renameInPath(path: string, requested: unknown): string {
  const slash = path.lastIndexOf("/");
  const folder = slash >= 0 ? path.slice(0, slash + 1) : "";
  return folder + cleanRename(requested, path.slice(slash + 1));
}
