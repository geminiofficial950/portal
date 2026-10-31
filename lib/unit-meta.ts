// Shared by server code and client components (no server-only imports here).
// Unit = overview + resources to read + the 4-part assessment + a final outcome per student.
import { ASSESSMENT_PARTS, type AssessmentPart, type AssessmentSummary } from "./assessment-meta";
import type { FileRef, SubmissionStatus } from "./submission-meta";

// ---------- Resources ----------

export type Resource =
  | { id: string; kind: "file"; title: string; description: string; file: FileRef }
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

export const UNIT_RESULTS = ["Pass", "Fail", "Withdrawn"] as const;
export type UnitResultValue = (typeof UNIT_RESULTS)[number];

export type UnitResultDTO = {
  studentId: string;
  courseCode: string;
  unitCode: string;
  result: UnitResultValue;
  feedback: string;
  decidedBy: string;
  decidedAt: string;
};

export const resultStyle: Record<UnitResultValue, string> = {
  Pass: "bg-emerald-100 text-emerald-700",
  Fail: "bg-rose-100 text-rose-700",
  Withdrawn: "bg-ink/10 text-ink/60",
};

/**
 * Can this final result be given? Pass needs every part the college set up to be Accepted;
 * Fail needs feedback so the student knows why; Withdrawn can be given any time.
 */
export function checkUnitResult(
  result: UnitResultValue,
  feedback: string,
  setUp: AssessmentSummary | null,
  statuses: Partial<Record<AssessmentPart, SubmissionStatus>>,
): string | null {
  if (!UNIT_RESULTS.includes(result)) return "Choose Pass, Fail or Withdrawn.";
  if (result === "Fail" && !feedback.trim()) return "Add feedback explaining why the unit is failed.";
  if (result === "Pass") {
    const parts = ASSESSMENT_PARTS.filter((p) => setUp?.[p.key]);
    if (!parts.length) return "This unit has no assessment set up yet, so it can’t be passed.";
    const missing = parts.filter((p) => statuses[p.key] !== "Accepted").map((p) => p.label);
    if (missing.length) return `Can’t pass yet — not accepted: ${missing.join(", ")}.`;
  }
  return null;
}

/** A student can change their work only before the deadline, before a final result, and while it's a draft or rejected. */
export function canEditWork(status: SubmissionStatus | undefined, pastDue: boolean, hasFinalResult: boolean) {
  if (pastDue || hasFinalResult) return false;
  return !status || status === "Draft" || status === "Rejected";
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
