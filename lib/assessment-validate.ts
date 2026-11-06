// Checks what the admin unit editor saves (unit-tested through tests/module-meta.test.ts).
import type { UnitAssessment } from "./assessment-meta";
import { checkModules } from "./module-meta";

export function validateAssessment(input: Partial<UnitAssessment>): { ok: true; value: UnitAssessment } | { ok: false; error: string } {
  const modules = checkModules(input?.modules);
  return modules.ok ? { ok: true, value: { modules: modules.value } } : modules;
}
