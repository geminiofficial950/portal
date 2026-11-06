// Merging what admin saves with what the unit had (pure; unit-tested in tests/module-save.test.ts).
import type { Module } from "./module-meta";

/**
 * - A module that students have work in can't disappear: if the editor left it out, it is kept as archived.
 * - `dueChanged`: did any module's due date change (or a module with a due date get added/removed)? Dates are Super Admin only.
 */
export function mergeModules(before: Module[], after: Module[], withWork: Set<string>) {
  const ids = new Set(after.map((m) => m.id));
  const keptArchived = before.filter((m) => !ids.has(m.id) && withWork.has(m.id)).map((m) => ({ ...m, archived: true }));
  const modules = [...after, ...keptArchived];
  // every module whose default due date changed (added, moved or removed) — for the audit log and optional reset
  const old = new Map(before.map((m) => [m.id, m.dueAt]));
  const dueChanges = modules
    .filter((m) => (old.get(m.id) ?? null) !== (m.dueAt ?? null) && (old.has(m.id) || m.dueAt))
    .map((m) => ({ moduleId: m.id, title: m.title, oldDue: old.get(m.id) ?? null, newDue: m.dueAt ?? null }));
  const removedWithDue = before.filter((m) => m.dueAt && !modules.some((x) => x.id === m.id));
  const dueChanged = dueChanges.length > 0 || removedWithDue.length > 0;
  return { modules, dueChanged, dueChanges };
}
