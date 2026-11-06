// Flexible modules (LMS guide, "Course setup"): each unit has its own list of modules — any number, named and
// ordered by admin. A module can hold learning content, online activities (MCQ, short answer, matching columns,
// image questions) and downloadable tasks with student uploads. Nothing is marked automatically: activity answers
// are saved for the trainer, who sets the module status by hand.
// Shared by server code and client components (no server-only imports here).
import type { FileRef } from "./submission-meta";

export type UploadSlot = { id: string; label: string };

export const ACTIVITY_TYPES = [
  { key: "mcq", label: "Multiple choice" },
  { key: "short", label: "Short answer" },
  { key: "matching", label: "Matching columns" },
  { key: "image", label: "Image question" },
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number]["key"];

// `answer` on a multiple-choice question is a reference for the trainer only — it is never used to mark
export type Activity =
  | { id: string; type: "mcq"; prompt: string; options: string[]; answer: number | null }
  | { id: string; type: "short"; prompt: string }
  | { id: string; type: "matching"; prompt: string; pairs: { left: string; right: string }[] }
  | { id: string; type: "image"; prompt: string; image: FileRef | null };

export const MODULE_KINDS = [
  { key: "learning", label: "Learning content", hint: "Reading and documents — nothing to submit" },
  { key: "activities", label: "Online activities", hint: "Questions answered in the portal" },
  { key: "task", label: "Downloadable task", hint: "Download, complete and upload" },
] as const;
export type ModuleKind = (typeof MODULE_KINDS)[number]["key"];

export type Module = {
  id: string;
  title: string;
  kind: ModuleKind;
  instructions: string; // plain text shown above the module content
  activities: Activity[];
  files: FileRef[]; // documents students read or download (task templates, learning files)
  upload: { enabled: boolean; slots: UploadSlot[] }; // student uploads; slots = named uploads (empty = any files)
  dueAt: string | null; // default deadline (ISO); students can have their own
  archived: boolean; // removed by admin while students had work in it: hidden, work kept
};

export const MODULE_LIMITS = { modules: 30, activities: 100, options: 8, pairs: 12, files: 10, slots: 10, title: 120, prompt: 2000, instructions: 4000, option: 500, answerText: 4000 } as const;

/** A module the student hands in (and a trainer marks): it has activities or asks for uploads */
export const needsSubmission = (m: Pick<Module, "activities" | "upload">) => m.activities.length > 0 || m.upload.enabled;

/** Modules students see, in admin's order */
export const liveModules = (modules: Module[]) => modules.filter((m) => !m.archived);

/** Modules a trainer marks */
export const markableModules = (modules: Module[]) => liveModules(modules).filter(needsSubmission);

export const moduleTitle = (modules: Module[], id: string) => modules.find((m) => m.id === id)?.title ?? id;

export const newModule = (kind: ModuleKind, id: string): Module => ({
  id,
  title: MODULE_KINDS.find((k) => k.key === kind)!.label,
  kind,
  instructions: "",
  activities: [],
  files: [],
  upload: { enabled: kind === "task", slots: [] },
  dueAt: null,
  archived: false,
});

// ---------- Older units: Quiz / Theory Task / Workplacement Task become modules ----------

type LegacyQuestion = { id: string; text: string; kind?: "choice" | "written"; options?: string[]; answer?: number };
export type LegacyAssessment = {
  dueAt?: string | Date | null;
  quiz?: { questions?: LegacyQuestion[] };
  theory?: { files?: FileRef[]; uploads?: UploadSlot[] };
  workplace?: { files?: FileRef[]; uploads?: UploadSlot[] };
};

/**
 * The modules of a unit saved before modules existed. Ids stay "quiz", "theory" and "workplace" so every
 * submission already handed in still belongs to its module. The unit's due date becomes each module's.
 */
export function modulesFromLegacy(a: LegacyAssessment | null | undefined): Module[] {
  if (!a) return [];
  const dueAt = a.dueAt ? new Date(a.dueAt).toISOString() : null;
  const out: Module[] = [];
  const questions = a.quiz?.questions ?? [];
  if (questions.length) {
    out.push({
      ...newModule("activities", "quiz"),
      title: "Quiz and Activities",
      dueAt,
      activities: questions.map((q): Activity =>
        q.kind === "written"
          ? { id: q.id, type: "short", prompt: q.text }
          : { id: q.id, type: "mcq", prompt: q.text, options: q.options ?? [], answer: Number.isInteger(q.answer) ? q.answer! : null },
      ),
    });
  }
  for (const [id, title, part] of [
    ["theory", "Theory Task", a.theory],
    ["workplace", "Workplacement Task", a.workplace],
  ] as const) {
    if (part?.files?.length) {
      out.push({ ...newModule("task", id), title, dueAt, files: part.files, upload: { enabled: true, slots: part.uploads ?? [] } });
    }
  }
  return out;
}

// ---------- Checking what admin saves ----------

class Invalid extends Error {}

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const cleanId = (v: unknown) => (typeof v === "string" && /^[\w-]{1,64}$/.test(v) ? v : globalThis.crypto.randomUUID());
const fileRef = (f: unknown): FileRef | null => {
  const x = f as FileRef | null;
  const id = String(x?.id ?? "");
  return /^[a-f\d]{24}$/i.test(id) ? { id, name: str(x?.name, 200), size: Math.max(0, Number(x?.size) || 0) } : null;
};
const iso = (v: unknown, label: string) => {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new Invalid(`${label}: the due date isn’t a valid date and time.`);
  return d.toISOString();
};

function cleanActivity(raw: unknown, where: string): Activity {
  const a = (raw ?? {}) as Partial<Activity> & Record<string, unknown>;
  const id = cleanId(a.id);
  const prompt = str(a.prompt, MODULE_LIMITS.prompt);
  if (!prompt) throw new Invalid(`${where} has no question text.`);
  switch (a.type) {
    case "mcq": {
      const options = (Array.isArray(a.options) ? a.options : []).slice(0, MODULE_LIMITS.options).map((o) => str(o, MODULE_LIMITS.option));
      if (options.length < 2) throw new Invalid(`${where} needs at least 2 options.`);
      const blank = options.findIndex((o) => !o);
      if (blank >= 0) throw new Invalid(`${where}: option ${blank + 1} is empty.`);
      const answer = Number(a.answer);
      return { id, type: "mcq", prompt, options, answer: Number.isInteger(answer) && answer >= 0 && answer < options.length ? answer : null };
    }
    case "short":
      return { id, type: "short", prompt };
    case "matching": {
      const pairs = (Array.isArray(a.pairs) ? a.pairs : [])
        .slice(0, MODULE_LIMITS.pairs)
        .map((p: { left?: unknown; right?: unknown }) => ({ left: str(p?.left, MODULE_LIMITS.option), right: str(p?.right, MODULE_LIMITS.option) }));
      if (pairs.length < 2) throw new Invalid(`${where} needs at least 2 pairs to match.`);
      if (pairs.some((p) => !p.left || !p.right)) throw new Invalid(`${where}: fill in both sides of every pair.`);
      return { id, type: "matching", prompt, pairs };
    }
    case "image": {
      const image = fileRef(a.image);
      if (!image) throw new Invalid(`${where} needs an image.`);
      return { id, type: "image", prompt, image };
    }
    default:
      throw new Invalid(`${where} has an unknown type.`);
  }
}

/** Rebuilds the module list from the admin editor: known fields only, every module titled, activities complete. */
export function checkModules(raw: unknown): { ok: true; value: Module[] } | { ok: false; error: string } {
  try {
    const list = Array.isArray(raw) ? raw : [];
    if (list.length > MODULE_LIMITS.modules) throw new Invalid(`A unit can have up to ${MODULE_LIMITS.modules} modules.`);
    const seen = new Set<string>();
    const modules = list.map((m: Partial<Module>, i): Module => {
      const title = str(m?.title, MODULE_LIMITS.title);
      const label = `Module ${i + 1}${title ? ` (${title})` : ""}`;
      if (!title) throw new Invalid(`${label} needs a name.`);
      let id = cleanId(m?.id);
      if (seen.has(id)) id = globalThis.crypto.randomUUID();
      seen.add(id);
      const kind = MODULE_KINDS.some((k) => k.key === m?.kind) ? (m!.kind as ModuleKind) : "learning";
      const activitiesIn = Array.isArray(m?.activities) ? m!.activities : [];
      if (activitiesIn.length > MODULE_LIMITS.activities) throw new Invalid(`${label}: keep it to ${MODULE_LIMITS.activities} activities.`);
      const slots = (Array.isArray(m?.upload?.slots) ? m!.upload!.slots : [])
        .slice(0, MODULE_LIMITS.slots)
        .map((s) => ({ id: cleanId(s?.id), label: str(s?.label, MODULE_LIMITS.title) }))
        .filter((s) => s.label);
      return {
        id,
        title,
        kind,
        instructions: str(m?.instructions, MODULE_LIMITS.instructions),
        activities: activitiesIn.map((a, j) => cleanActivity(a, `${label}, activity ${j + 1}`)),
        files: (Array.isArray(m?.files) ? m!.files : []).slice(0, MODULE_LIMITS.files).map(fileRef).filter((f): f is FileRef => !!f),
        upload: { enabled: m?.upload?.enabled === true, slots },
        dueAt: iso(m?.dueAt, label),
        archived: m?.archived === true,
      };
    });
    return { ok: true, value: modules };
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, error: err.message };
    throw err;
  }
}

/** Files used by modules (task templates and activity images) — to keep or delete them in storage */
export const moduleFiles = (modules: Module[]): FileRef[] =>
  modules.flatMap((m) => [...m.files, ...m.activities.flatMap((a) => (a.type === "image" && a.image ? [a.image] : []))]);

/**
 * Removing a module: one nobody has worked in is deleted; one with student work is archived instead
 * (hidden from students, evidence kept) — the guide forbids silently erasing evidence.
 */
export function removeModule(modules: Module[], id: string, hasWork: boolean): Module[] {
  return hasWork ? modules.map((m) => (m.id === id ? { ...m, archived: true } : m)) : modules.filter((m) => m.id !== id);
}

// ---------- Student answers ----------

export type ActivityAnswer = number | string | string[] | null; // option index · text · matching (right side per left)
export type Responses = Record<string, ActivityAnswer>;

/** Keeps only answers to this module's activities, each the right shape. Nothing is scored. */
export function cleanResponses(activities: Activity[], raw: unknown): Responses {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: Responses = {};
  for (const a of activities) {
    const v = r[a.id];
    if (a.type === "mcq") out[a.id] = Number.isInteger(v) && (v as number) >= 0 && (v as number) < a.options.length ? (v as number) : null;
    else if (a.type === "matching") {
      const rights = new Set(a.pairs.map((p) => p.right));
      out[a.id] = a.pairs.map((_, i) => {
        const pick = Array.isArray(v) ? String(v[i] ?? "") : "";
        return rights.has(pick) ? pick : "";
      });
    } else out[a.id] = typeof v === "string" ? v.trim().slice(0, MODULE_LIMITS.answerText) : null;
  }
  return out;
}

/** Has the student answered this activity? */
export function isAnswered(a: Activity, v: ActivityAnswer | undefined): boolean {
  if (a.type === "mcq") return typeof v === "number";
  if (a.type === "matching") return Array.isArray(v) && v.length === a.pairs.length && v.every((x) => !!x);
  return typeof v === "string" && v.trim().length > 0;
}

/** Older quiz submissions saved answers by position (quizAnswers / quizWritten): read them as responses */
export function legacyResponses(
  activities: Activity[],
  content: { responses?: Responses; quizAnswers?: number[]; quizWritten?: { questionId: string; text: string }[] },
): Responses {
  if (content.responses) return content.responses;
  const out: Responses = {};
  activities.forEach((a, i) => {
    if (a.type === "mcq" && typeof content.quizAnswers?.[i] === "number" && content.quizAnswers[i] >= 0) out[a.id] = content.quizAnswers[i];
    const w = content.quizWritten?.find((x) => x.questionId === a.id);
    if (w) out[a.id] = w.text;
  });
  return out;
}
