import { describe, expect, it } from "vitest";
import type { AssessmentSummary } from "@/lib/assessment-meta";
import { canEditWork, checkUnitResult, cleanUrl, validateResource } from "@/lib/unit-meta";

const allParts: AssessmentSummary = { quiz: true, theory: true, rolePlay: true, workplace: true, quizCount: 2, theoryCount: 1 };
const allAccepted = { quiz: "Accepted", theory: "Accepted", rolePlay: "Accepted", workplace: "Accepted" } as const;

describe("checkUnitResult — final Pass / Fail / Withdrawn", () => {
  it("allows Pass when every part is accepted", () => {
    expect(checkUnitResult("Pass", "", allParts, allAccepted)).toBeNull();
  });

  it("blocks Pass and lists the parts not accepted yet", () => {
    expect(checkUnitResult("Pass", "", allParts, { ...allAccepted, theory: "Rejected", workplace: "Submitted" })).toBe(
      "Can’t pass yet — not accepted: Theory, Workplace task.",
    );
  });

  it("only counts parts the college set up", () => {
    const quizOnly: AssessmentSummary = { ...allParts, theory: false, rolePlay: false, workplace: false };
    expect(checkUnitResult("Pass", "", quizOnly, { quiz: "Accepted" })).toBeNull();
  });

  it("can't pass a unit with no assessment", () => {
    expect(checkUnitResult("Pass", "", null, {})).toBe("This unit has no assessment set up yet, so it can’t be passed.");
  });

  it("Fail needs feedback", () => {
    expect(checkUnitResult("Fail", "  ", allParts, {})).toBe("Add feedback explaining why the unit is failed.");
    expect(checkUnitResult("Fail", "Did not attend", allParts, {})).toBeNull();
  });

  it("Withdrawn is allowed any time", () => {
    expect(checkUnitResult("Withdrawn", "", allParts, {})).toBeNull();
  });

  it("rejects unknown results", () => {
    expect(checkUnitResult("Merit" as never, "", allParts, allAccepted)).toBe("Choose Pass, Fail or Withdrawn.");
  });
});

describe("canEditWork", () => {
  it("lets a student work on new, draft or rejected parts", () => {
    expect(canEditWork(undefined, false, false)).toBe(true);
    expect(canEditWork("Draft", false, false)).toBe(true);
    expect(canEditWork("Rejected", false, false)).toBe(true);
  });

  it("locks submitted and accepted work", () => {
    expect(canEditWork("Submitted", false, false)).toBe(false);
    expect(canEditWork("Accepted", false, false)).toBe(false);
  });

  it("locks everything after the due date or a final result", () => {
    expect(canEditWork("Draft", true, false)).toBe(false);
    expect(canEditWork("Rejected", false, true)).toBe(false);
  });
});

describe("cleanUrl", () => {
  it("keeps http(s) links and adds https:// when missing", () => {
    expect(cleanUrl("https://training.gov.au/Training/Details/CHC43121")).toBe("https://training.gov.au/Training/Details/CHC43121");
    expect(cleanUrl("training.gov.au")).toBe("https://training.gov.au/");
  });

  it("refuses dangerous or broken links", () => {
    expect(cleanUrl("javascript:alert(1)")).toBeNull();
    expect(cleanUrl("data:text/html,hi")).toBeNull();
    expect(cleanUrl("ftp://example.com/file")).toBeNull();
    expect(cleanUrl("")).toBeNull();
    expect(cleanUrl("http://")).toBeNull();
  });
});

describe("validateResource", () => {
  it("needs a title", () => {
    expect(validateResource({ kind: "link", title: " ", description: "", url: "https://x.com" })).toEqual({
      ok: false,
      error: "Give the resource a title.",
    });
  });

  it("accepts a link and normalises it", () => {
    const res = validateResource({ kind: "link", title: " Guide ", description: "", url: "example.com/guide" });
    expect(res).toEqual({ ok: true, value: { kind: "link", title: "Guide", description: "", url: "https://example.com/guide" } });
  });

  it("rejects a javascript: link", () => {
    expect(validateResource({ kind: "link", title: "x", description: "", url: "javascript:alert(1)" }).ok).toBe(false);
  });

  it("needs note text and an uploaded file", () => {
    expect(validateResource({ kind: "note", title: "Notes", description: "", body: "" }).ok).toBe(false);
    expect(validateResource({ kind: "file", title: "PDF", description: "", fileId: "" }).ok).toBe(false);
    expect(validateResource({ kind: "file", title: "PDF", description: "", fileId: "abc" }).ok).toBe(true);
  });

  it("rejects an unknown kind", () => {
    expect(validateResource({ kind: "video", title: "x" } as never)).toEqual({ ok: false, error: "Pick file, link or notes." });
  });
});
