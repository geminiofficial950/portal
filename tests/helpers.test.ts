import { beforeAll, describe, expect, it } from "vitest";
import { emptyAssessment, forStudent, isPastDue, summarise, type UnitAssessment } from "@/lib/assessment-meta";
import { initials, timeAgo } from "@/lib/format";
import { generatePassword } from "@/lib/password";
import { decrypt, encrypt } from "@/lib/session-token";
import { countWords, formatBytes } from "@/lib/submission-meta";

describe("forStudent — what reaches the student's browser", () => {
  it("never includes the correct quiz answers", () => {
    const a: UnitAssessment = {
      ...emptyAssessment(),
      quiz: { passMark: 70, questions: [{ id: "q1", text: "Q", options: ["a", "b"], answer: 1 }] },
    };
    const view = forStudent(a);
    expect(view.quiz.questions[0]).toEqual({ id: "q1", text: "Q", options: ["a", "b"] });
    expect(JSON.stringify(view)).not.toContain('"answer"');
  });
});

describe("summarise", () => {
  it("marks which parts have content", () => {
    const a = emptyAssessment();
    a.rolePlay.scenario = "Scenario";
    expect(summarise(a)).toEqual({ quiz: false, theory: false, rolePlay: true, workplace: false, quizCount: 0, theoryCount: 0 });
  });
});

describe("isPastDue", () => {
  const now = Date.parse("2026-11-05T10:00:00Z");
  it("is false with no deadline or before it, true after it", () => {
    expect(isPastDue(null, now)).toBe(false);
    expect(isPastDue("2026-11-05T10:00:01Z", now)).toBe(false);
    expect(isPastDue("2026-11-05T09:59:59Z", now)).toBe(true);
  });
});

describe("countWords", () => {
  it("counts words in editor HTML", () => {
    expect(countWords("<p>Person-centred care means <b>the client</b> comes first</p>")).toBe(7);
    expect(countWords("<ul><li>one</li><li>two</li></ul>")).toBe(2);
    expect(countWords("<p>&nbsp;</p>")).toBe(0);
    expect(countWords("")).toBe(0);
  });
});

describe("formatBytes", () => {
  it("shows KB and MB", () => {
    expect(formatBytes(500)).toBe("1 KB");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });
});

describe("generatePassword", () => {
  it("makes readable 10-character passwords without look-alike characters", () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword();
      expect(p).toHaveLength(10);
      expect(p).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/);
    }
  });
  it("doesn't repeat itself", () => {
    expect(new Set(Array.from({ length: 50 }, () => generatePassword())).size).toBe(50);
  });
});

describe("format helpers", () => {
  const now = new Date("2026-10-31T12:00:00Z");
  it("timeAgo", () => {
    expect(timeAgo(new Date("2026-10-31T11:59:30Z"), now)).toBe("Just now");
    expect(timeAgo(new Date("2026-10-31T11:45:00Z"), now)).toBe("15 min ago");
    expect(timeAgo(new Date("2026-10-31T09:00:00Z"), now)).toBe("3 hrs ago");
    expect(timeAgo(new Date("2026-10-30T12:00:00Z"), now)).toBe("Yesterday");
    expect(timeAgo(new Date("2026-10-28T12:00:00Z"), now)).toBe("3 days ago");
  });
  it("initials", () => {
    expect(initials("Aisha Khan")).toBe("AK");
    expect(initials("  mia   rossi lee ")).toBe("MR");
    expect(initials("Cher")).toBe("C");
  });
});

describe("session tokens", () => {
  beforeAll(() => {
    process.env.SESSION_SECRET = "test-secret-at-least-32-characters-long!!";
  });

  it("round-trips a session", async () => {
    const token = await encrypt({ sub: "S1001", role: "student", name: "Aisha" });
    expect(await decrypt(token)).toMatchObject({ sub: "S1001", role: "student", name: "Aisha" });
  });

  it("rejects a tampered or foreign token", async () => {
    const token = await encrypt({ sub: "S1001", role: "student", name: "Aisha" });
    const [h, , s] = token.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: "superadmin", role: "admin", name: "x" })).toString("base64url")}.${s}`;
    expect(await decrypt(forged)).toBeNull();
    expect(await decrypt("garbage")).toBeNull();
    expect(await decrypt(undefined)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await encrypt({ sub: "T001", role: "trainer", name: "Sam" });
    process.env.SESSION_SECRET = "a-completely-different-secret-value-123";
    expect(await decrypt(token)).toBeNull();
    process.env.SESSION_SECRET = "test-secret-at-least-32-characters-long!!";
  });
});
