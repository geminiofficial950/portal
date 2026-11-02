// Shared by server code and client components (no server-only imports here).

// Final unit result options. Pass / Fail / Withdrawn to start with; Super Admin and Admins can add, rename
// or delete them in Settings. `kind` keeps the rules: a "pass" needs every part Satisfactory, a "fail" needs feedback.
export type ResultKind = "pass" | "fail" | "other";
export type ResultTone = "green" | "red" | "amber" | "blue" | "grey";
export type ResultOption = { id: string; label: string; kind: ResultKind; tone: ResultTone };

// The ids match what older results stored ("Pass", "Fail", "Withdrawn"), so they keep working
export const DEFAULT_RESULT_OPTIONS: ResultOption[] = [
  { id: "Pass", label: "Pass", kind: "pass", tone: "green" },
  { id: "Fail", label: "Fail", kind: "fail", tone: "red" },
  { id: "Withdrawn", label: "Withdrawn", kind: "other", tone: "grey" },
];

export const RESULT_KINDS: { key: ResultKind; label: string; hint: string }[] = [
  { key: "pass", label: "Counts as passed", hint: "Every part must be Satisfactory first" },
  { key: "fail", label: "Counts as not passed", hint: "Feedback is required" },
  { key: "other", label: "Other", hint: "Can be given any time" },
];

export const RESULT_TONES: { key: ResultTone; label: string }[] = [
  { key: "green", label: "Green" },
  { key: "red", label: "Red" },
  { key: "amber", label: "Yellow" },
  { key: "blue", label: "Blue" },
  { key: "grey", label: "Grey" },
];

// Pills (staff pages, picker)
export const toneStyle: Record<ResultTone, string> = {
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-rose-100 text-rose-800",
  amber: "bg-amber-100 text-amber-900",
  blue: "bg-sky-100 text-sky-800",
  grey: "bg-ink/10 text-ink",
};

// The student's "Unit outcome" box
export const toneCard: Record<ResultTone, string> = {
  green: "bg-emerald-50 text-emerald-900",
  red: "bg-rose-50 text-rose-900",
  amber: "bg-amber-50 text-amber-900",
  blue: "bg-sky-50 text-sky-900",
  grey: "bg-ink/5 text-ink",
};

export const RESULT_LABEL_MAX = 40;

export function checkResultOption(input: { label: string; kind: string; tone: string }): Omit<ResultOption, "id"> | { error: string } {
  const label = String(input.label ?? "").trim().replace(/\s+/g, " ");
  if (!label) return { error: "Enter a name for the result." };
  if (label.length > RESULT_LABEL_MAX) return { error: `Keep the name under ${RESULT_LABEL_MAX} characters.` };
  const kind = RESULT_KINDS.find((k) => k.key === input.kind)?.key;
  if (!kind) return { error: "Choose what this result counts as." };
  const tone = RESULT_TONES.find((t) => t.key === input.tone)?.key ?? "grey";
  return { label, kind, tone };
}

// A result whose option was removed still shows, by its stored id
export function resolveResult(id: string, options: ResultOption[]): ResultOption {
  return options.find((o) => o.id === id) ?? { id, label: id, kind: id === "Pass" ? "pass" : id === "Fail" ? "fail" : "other", tone: "grey" };
}
