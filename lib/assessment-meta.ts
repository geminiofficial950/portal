// Shared by server code and client components (no server-only imports here).
// A unit's assessment is its list of flexible modules (lib/module-meta.ts). Older units, saved as fixed
// Quiz / Theory Task / Workplacement Task parts, are read as modules with the ids "quiz", "theory" and "workplace".
import { liveModules, markableModules, type Module } from "./module-meta";

// A module id. (It used to be one of the fixed parts; submissions still store it in their `part` field.)
export type AssessmentPart = string;

export type UnitAssessment = { modules: Module[] };

// What a student may see: live modules only, without the trainer's reference answers
export type StudentAssessment = UnitAssessment;

export const forStudent = (a: UnitAssessment): StudentAssessment => ({
  modules: liveModules(a.modules).map((m) => ({
    ...m,
    activities: m.activities.map((x) => (x.type === "mcq" ? { ...x, answer: null } : x)),
  })),
});

export const emptyAssessment = (): UnitAssessment => ({ modules: [] });

export const isPastDue = (dueAt: string | null, now = Date.now()) => !!dueAt && now > new Date(dueAt).getTime();

// For unit lists: how many modules there are, and how many are marked
export type AssessmentSummary = { modules: number; marked: number };

export const summarise = (a: UnitAssessment): AssessmentSummary => ({
  modules: liveModules(a.modules).length,
  marked: markableModules(a.modules).length,
});

/** The marked modules of a unit as { key, label } — what staff mark and what counts towards progress */
export const partsOf = (a: UnitAssessment | null | undefined) => markableModules(a?.modules ?? []).map((m) => ({ key: m.id, label: m.title }));

/** A module's name, or a fallback for work in a module that no longer exists */
export const partLabel = (a: UnitAssessment | null | undefined, id: string) =>
  a?.modules.find((m) => m.id === id)?.title ?? ({ quiz: "Quiz and Activities", theory: "Theory Task", workplace: "Workplacement Task" } as Record<string, string>)[id] ?? "Module";

/** The unit's next deadline: the earliest due date of its live modules (null = none set) */
export const unitDueAt = (a: UnitAssessment | null | undefined): string | null =>
  liveModules(a?.modules ?? [])
    .map((m) => m.dueAt)
    .filter((d): d is string => !!d)
    .sort()[0] ?? null;
