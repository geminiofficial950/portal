import { describe, expect, it } from "vitest";
import {
  checkModules,
  cleanResponses,
  isAnswered,
  legacyResponses,
  liveModules,
  markableModules,
  moduleFiles,
  modulesFromLegacy,
  needsSubmission,
  newModule,
  removeModule,
  type Activity,
  type Module,
} from "@/lib/module-meta";

const file = (c: string) => ({ id: c.repeat(24), name: `${c}.pdf`, size: 100 });

describe("modulesFromLegacy (existing units keep working)", () => {
  it("turns Quiz / Theory / Workplacement into modules with the same ids", () => {
    const mods = modulesFromLegacy({
      dueAt: "2026-12-01T00:00:00Z",
      quiz: { questions: [{ id: "q1", text: "Pick", options: ["a", "b"], answer: 1 }, { id: "q2", text: "Explain", kind: "written" }] },
      theory: { files: [file("a")], uploads: [{ id: "s1", label: "Answers" }] },
      workplace: { files: [file("b")] },
    });
    expect(mods.map((m) => m.id)).toEqual(["quiz", "theory", "workplace"]);
    expect(mods[0].activities).toEqual([
      { id: "q1", type: "mcq", prompt: "Pick", options: ["a", "b"], answer: 1 },
      { id: "q2", type: "short", prompt: "Explain" },
    ]);
    expect(mods[1]).toMatchObject({ title: "Theory Task", files: [file("a")], upload: { enabled: true, slots: [{ id: "s1", label: "Answers" }] } });
    expect(mods.every((m) => m.dueAt === "2026-12-01T00:00:00.000Z")).toBe(true);
  });

  it("leaves out parts that were never set up (no empty placeholders)", () => {
    expect(modulesFromLegacy({ theory: { files: [file("a")] } }).map((m) => m.id)).toEqual(["theory"]);
    expect(modulesFromLegacy(null)).toEqual([]);
  });
});

describe("checkModules", () => {
  const base = (): Module[] => [
    { ...newModule("learning", "m1"), title: "Read first" },
    {
      ...newModule("activities", "m2"),
      title: "Check your knowledge",
      activities: [
        { id: "a1", type: "mcq", prompt: "Q", options: ["x", "y"], answer: 0 },
        { id: "a2", type: "matching", prompt: "Match", pairs: [{ left: "1", right: "one" }, { left: "2", right: "two" }] },
        { id: "a3", type: "image", prompt: "What is shown?", image: file("c") },
      ],
    },
  ];

  it("accepts any number of modules with different activities", () => {
    const r = checkModules(base());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.map((m) => m.activities.length)).toEqual([0, 3]);
  });

  it("needs a name for every module", () => {
    const m = base();
    m[0].title = " ";
    expect(checkModules(m)).toEqual({ ok: false, error: "Module 1 needs a name." });
  });

  it("checks each activity type", () => {
    const bad = (a: Partial<Activity>) => {
      const m = base();
      m[1].activities = [{ id: "z", ...a } as Activity];
      return checkModules(m);
    };
    expect(bad({ type: "mcq", prompt: "Q", options: ["only"] } as never).ok).toBe(false);
    expect(bad({ type: "matching", prompt: "M", pairs: [{ left: "a", right: "" }, { left: "b", right: "c" }] } as never).ok).toBe(false);
    expect(bad({ type: "image", prompt: "I", image: null } as never).ok).toBe(false);
    expect(bad({ type: "short", prompt: "" } as never).ok).toBe(false);
    expect(bad({ type: "essay", prompt: "x" } as never).ok).toBe(false);
  });

  it("drops a bad MCQ reference answer instead of failing", () => {
    const m = base();
    (m[1].activities[0] as { answer: number | null }).answer = 9;
    const r = checkModules(m);
    expect(r.ok && (r.value[1].activities[0] as { answer: number | null }).answer).toBe(null);
  });

  it("rejects an invalid due date and keeps a valid one as ISO", () => {
    const m = base();
    m[0].dueAt = "soon";
    expect(checkModules(m).ok).toBe(false);
    m[0].dueAt = "2026-12-01T10:00:00+11:00";
    const r = checkModules(m);
    expect(r.ok && r.value[0].dueAt).toBe("2026-11-30T23:00:00.000Z");
  });

  it("gives duplicate ids a fresh one and drops junk files", () => {
    const m = base();
    m[1].id = "m1";
    m[0].files = [file("a"), { id: "nope", name: "x", size: 1 }];
    const r = checkModules(m);
    expect(r.ok && r.value[1].id).not.toBe("m1");
    expect(r.ok && r.value[0].files).toEqual([file("a")]);
  });
});

describe("which modules count", () => {
  const learning = { ...newModule("learning", "l"), title: "L" };
  const task = { ...newModule("task", "t"), title: "T" };
  const gone = { ...newModule("task", "g"), title: "G", archived: true };

  it("learning content has nothing to submit; tasks do", () => {
    expect(needsSubmission(learning)).toBe(false);
    expect(needsSubmission(task)).toBe(true);
  });

  it("archived modules are hidden and not marked", () => {
    expect(liveModules([learning, task, gone]).map((m) => m.id)).toEqual(["l", "t"]);
    expect(markableModules([learning, task, gone]).map((m) => m.id)).toEqual(["t"]);
  });

  it("removing a module with student work archives it; without work deletes it", () => {
    expect(removeModule([learning, task], "t", true).find((m) => m.id === "t")?.archived).toBe(true);
    expect(removeModule([learning, task], "t", false).map((m) => m.id)).toEqual(["l"]);
  });

  it("lists every stored file a module uses", () => {
    const m = { ...task, files: [file("a")], activities: [{ id: "i", type: "image" as const, prompt: "p", image: file("b") }] };
    expect(moduleFiles([m]).map((f) => f.name)).toEqual(["a.pdf", "b.pdf"]);
  });
});

describe("student answers (saved, never scored)", () => {
  const acts: Activity[] = [
    { id: "a", type: "mcq", prompt: "Q", options: ["x", "y"], answer: 1 },
    { id: "b", type: "short", prompt: "S" },
    { id: "c", type: "matching", prompt: "M", pairs: [{ left: "1", right: "one" }, { left: "2", right: "two" }] },
  ];

  it("keeps only well-formed answers to this module's activities", () => {
    expect(cleanResponses(acts, { a: 1, b: "  hi ", c: ["two", "one"], hack: "x" })).toEqual({ a: 1, b: "hi", c: ["two", "one"] });
    expect(cleanResponses(acts, { a: 7, b: 5, c: ["nope"] })).toEqual({ a: null, b: null, c: ["", ""] });
  });

  it("knows when each activity is answered", () => {
    expect(isAnswered(acts[0], 0)).toBe(true);
    expect(isAnswered(acts[0], null)).toBe(false);
    expect(isAnswered(acts[1], "  ")).toBe(false);
    expect(isAnswered(acts[2], ["one", ""])).toBe(false);
    expect(isAnswered(acts[2], ["two", "one"])).toBe(true);
  });

  it("reads older quiz submissions saved by position", () => {
    expect(legacyResponses(acts, { quizAnswers: [1, -1, -1], quizWritten: [{ questionId: "b", text: "typed" }] })).toEqual({ a: 1, b: "typed" });
  });
});
