// Shared by server code and client components (no server-only imports here).
// Unit = overview + resources (Learner Guide, PowerPoint, Supporting Document) + the assessment + a final outcome per student.
import type { AssessmentPart } from "./assessment-meta";
import type { ResultKind, ResultOption, ResultTone } from "./result-meta";
import type { FileRef, SubmissionStatus } from "./submission-meta";

// ---------- Resources ----------

// Every unit's Resources hold these three documents (plus any extra resources)
export const RESOURCE_SLOTS = [
  { key: "learnerGuide", label: "Learner Guide" },
  { key: "presentation", label: "PowerPoint Presentation" },
  { key: "supporting", label: "Supporting Document" },
] as const;
export type ResourceSlot = (typeof RESOURCE_SLOTS)[number]["key"];
export const isResourceSlot = (v: unknown): v is ResourceSlot => RESOURCE_SLOTS.some((s) => s.key === v);
// The Supporting Document is a folder: many files, each a resource with slot "supporting" whose title is its path in the folder.
// Students download them (one by one or all as a ZIP); they aren't shown in the page.
export const SUPPORTING_MAX = 30;

export type Resource =
  | { id: string; kind: "file"; title: string; description: string; file: FileRef; slot?: ResourceSlot }
  | { id: string; kind: "link"; title: string; description: string; url: string }
  | { id: string; kind: "note"; title: string; description: string; body: string };

export type UnitContent = { overview: string; resources: Resource[] };

export const emptyUnitContent = (): UnitContent => ({ overview: "", resources: [] });

export const RESOURCE_LIMITS = { resources: 40, title: 200, description: 1000, body: 20000, overview: 10000 } as const;

// Only plain web links — never javascript: or data: URLs
export function cleanUrl(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// ---------- Final unit outcome ----------

// The result options themselves are editable (lib/result-meta.ts); `result` is the option id
export type UnitResultDTO = {
  studentId: string;
  courseCode: string;
  unitCode: string;
  result: string;
  label: string;
  kind: ResultKind;
  tone: ResultTone;
  feedback: string;
  decidedBy: string;
  decidedAt: string;
};

/**
 * Can this final result be given? A "pass" result needs every marked module of the unit to be Satisfactory
 * (staff still choose it — nothing is set automatically);
 * a "fail" result needs feedback so the student knows why; any other result can be given any time.
 */
export function checkUnitResult(
  option: ResultOption | undefined,
  feedback: string,
  parts: { key: AssessmentPart; label: string }[] | null,
  statuses: Partial<Record<AssessmentPart, SubmissionStatus>>,
): string | null {
  if (!option) return "Choose a final result.";
  if (option.kind === "fail" && !feedback.trim()) return `Add feedback explaining why the result is ${option.label}.`;
  if (option.kind === "pass") {
    if (!parts?.length) return "This unit has no assessment set up yet, so it can’t be passed.";
    const missing = parts.filter((p) => statuses[p.key] !== "Accepted").map((p) => p.label);
    if (missing.length) return `Can’t pass yet — not Satisfactory: ${missing.join(", ")}.`;
  }
  return null;
}

/** A student can change their work only before the deadline, before a final result, and while it's a draft or rejected. */
export function canEditWork(status: SubmissionStatus | undefined, pastDue: boolean, hasFinalResult: boolean) {
  if (pastDue || hasFinalResult) return false;
  return !status || status === "Draft" || status === "Rejected" || status === "MoreDocs";
}

export type ResourceInput =
  | { kind: "file"; title: string; description: string; fileId: string }
  | { kind: "link"; title: string; description: string; url: string }
  | { kind: "note"; title: string; description: string; body: string };

/** Checks a new resource from the admin form. File ownership is checked separately on the server. */
export function validateResource(
  input: ResourceInput,
): { ok: true; value: ResourceInput } | { ok: false; error: string } {
  const title = String(input?.title ?? "").trim().slice(0, RESOURCE_LIMITS.title);
  const description = String(input?.description ?? "").trim().slice(0, RESOURCE_LIMITS.description);
  if (!title) return { ok: false, error: "Give the resource a title." };
  if (input?.kind === "link") {
    const url = cleanUrl(input.url);
    if (!url) return { ok: false, error: "Enter a valid web link (https://…)." };
    return { ok: true, value: { kind: "link", title, description, url } };
  }
  if (input?.kind === "note") {
    const body = String(input.body ?? "").trim().slice(0, RESOURCE_LIMITS.body);
    if (!body) return { ok: false, error: "Write the reading notes." };
    return { ok: true, value: { kind: "note", title, description, body } };
  }
  if (input?.kind === "file") {
    if (!input.fileId) return { ok: false, error: "Upload a file first." };
    return { ok: true, value: { kind: "file", title, description, fileId: String(input.fileId) } };
  }
  return { ok: false, error: "Pick file, link or notes." };
}
