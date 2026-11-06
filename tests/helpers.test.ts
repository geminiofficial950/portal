import { beforeAll, describe, expect, it } from "vitest";
import { emptyAssessment, forStudent, isPastDue, partsOf, summarise, type UnitAssessment } from "@/lib/assessment-meta";
import { newModule } from "@/lib/module-meta";
import { initials, timeAgo } from "@/lib/format";
import { generatePassword } from "@/lib/password";
import { decrypt, encrypt } from "@/lib/session-token";
import { countWords, formatBytes } from "@/lib/submission-meta";

describe("forStudent — what reaches the student's browser", () => {
  it("never includes the trainer's reference answers, and hides archived modules", () => {
    const a: UnitAssessment = {
      modules: [
        { ...newModule("activities", "m1"), title: "Quiz", activities: [{ id: "q1", type: "mcq", prompt: "Q", options: ["a", "b"], answer: 1 }] },
        { ...newModule("task", "m2"), title: "Old", archived: true },
      ],
    };
    const view = forStudent(a);
    expect(view.modules.map((m) => m.id)).toEqual(["m1"]);
    expect(view.modules[0].activities[0]).toEqual({ id: "q1", type: "mcq", prompt: "Q", options: ["a", "b"], answer: null });
  });
});

describe("summarise / partsOf", () => {
  it("counts live modules and the ones that are marked", () => {
    const a: UnitAssessment = {
      modules: [
        { ...newModule("learning", "l"), title: "Read" },
        { ...newModule("task", "t"), title: "Task" },
        { ...newModule("task", "x"), title: "Gone", archived: true },
      ],
    };
    expect(summarise(a)).toEqual({ modules: 2, marked: 1 });
    expect(partsOf(a)).toEqual([{ key: "t", label: "Task" }]);
    expect(summarise(emptyAssessment())).toEqual({ modules: 0, marked: 0 });
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
