import { describe, expect, it } from "vitest";
import { newModule } from "@/lib/module-meta";
import { mergeModules } from "@/lib/module-save";

const m = (id: string, dueAt: string | null = null) => ({ ...newModule("task", id), title: id, dueAt });

describe("mergeModules", () => {
  it("keeps the new list and order as admin saved it", () => {
    const r = mergeModules([m("a"), m("b")], [m("b"), m("a"), m("c")], new Set());
    expect(r.modules.map((x) => x.id)).toEqual(["b", "a", "c"]);
  });

  it("archives (never deletes) a removed module that has student work", () => {
    const r = mergeModules([m("a"), m("b")], [m("a")], new Set(["b"]));
    expect(r.modules.map((x) => [x.id, x.archived])).toEqual([
      ["a", false],
      ["b", true],
    ]);
  });

  it("really removes a module nobody worked in", () => {
    expect(mergeModules([m("a"), m("b")], [m("a")], new Set()).modules.map((x) => x.id)).toEqual(["a"]);
  });

  it("notices any due-date change (Super Admin only)", () => {
    expect(mergeModules([m("a", "2026-12-01T00:00:00.000Z")], [m("a", "2026-12-01T00:00:00.000Z")], new Set()).dueChanged).toBe(false);
    expect(mergeModules([m("a", "2026-12-01T00:00:00.000Z")], [m("a", "2026-12-02T00:00:00.000Z")], new Set()).dueChanged).toBe(true);
    expect(mergeModules([m("a")], [m("a"), m("b", "2026-12-02T00:00:00.000Z")], new Set()).dueChanged).toBe(true);
    expect(mergeModules([m("a", "2026-12-01T00:00:00.000Z")], [], new Set()).dueChanged).toBe(true);
    expect(mergeModules([m("a")], [m("a"), m("b")], new Set()).dueChanged).toBe(false);
  });
});

describe("mergeModules — default due-date changes for the audit log", () => {
  it("lists each module whose default date changed, with old and new", () => {
    const r = mergeModules([m("a", "2026-12-01T00:00:00.000Z"), m("b")], [m("a", "2026-12-08T00:00:00.000Z"), m("b"), m("c", "2027-01-01T00:00:00.000Z")], new Set());
    expect(r.dueChanges).toEqual([
      { moduleId: "a", title: "a", oldDue: "2026-12-01T00:00:00.000Z", newDue: "2026-12-08T00:00:00.000Z" },
      { moduleId: "c", title: "c", oldDue: null, newDue: "2027-01-01T00:00:00.000Z" },
    ]);
  });
  it("lists nothing when dates didn't change", () => {
    expect(mergeModules([m("a", "2026-12-01T00:00:00.000Z")], [m("a", "2026-12-01T00:00:00.000Z")], new Set()).dueChanges).toEqual([]);
  });
});
