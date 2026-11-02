import { describe, expect, it } from "vitest";
import { agreedDeclaration, checkDeclaration, DECLARATION_LIMITS, DEFAULT_DECLARATION } from "@/lib/declaration";

describe("checkDeclaration", () => {
  it("tidies spaces and drops empty points", () => {
    expect(checkDeclaration({ intro: "  I declare:  ", points: ["One  point", " ", "Two"], agree: " I agree " })).toEqual({
      intro: "I declare:",
      points: ["One point", "Two"],
      agree: "I agree",
    });
  });

  it("needs an opening line, at least one point and a tick-box line", () => {
    expect(checkDeclaration({ ...DEFAULT_DECLARATION, intro: " " })).toEqual({ error: "Enter the opening line." });
    expect(checkDeclaration({ ...DEFAULT_DECLARATION, points: ["", "  "] })).toEqual({ error: "Add at least one point." });
    expect(checkDeclaration({ ...DEFAULT_DECLARATION, agree: "" })).toEqual({ error: "Enter the tick-box line." });
  });

  it("limits the number and length of points", () => {
    const many = Array.from({ length: DECLARATION_LIMITS.points + 1 }, (_, i) => `Point ${i}`);
    expect(checkDeclaration({ ...DEFAULT_DECLARATION, points: many })).toHaveProperty("error");
    expect(checkDeclaration({ ...DEFAULT_DECLARATION, points: ["x".repeat(DECLARATION_LIMITS.point + 1)] })).toHaveProperty("error");
  });
});

describe("agreedDeclaration", () => {
  it("shows the words saved with the submission", () => {
    const saved = { intro: "I confirm:", points: ["Only this"], agree: "Yes" };
    expect(agreedDeclaration({ ...saved, agreedAt: "2026-11-02T00:00:00Z" } as never)).toEqual(saved);
  });

  it("falls back to the first wording for older certificates, not today's default", () => {
    const old = agreedDeclaration({ agreedAt: "2026-10-01T00:00:00Z" } as never);
    expect(old.intro).toBe("By submitting this assessment, I declare that:");
    expect(old.points).toHaveLength(5);
    expect(agreedDeclaration(undefined)).toEqual(old);
  });

  it("the default wording passes its own checks", () => {
    expect(checkDeclaration(DEFAULT_DECLARATION)).toEqual(DEFAULT_DECLARATION);
    expect(DEFAULT_DECLARATION.points).toHaveLength(11);
  });
});
