import { describe, expect, it } from "vitest";
import { DEFAULT_RESULT_OPTIONS, type ResultOption } from "@/lib/result-meta";
import { canEditWork, checkUnitResult, cleanUrl, validateResource } from "@/lib/unit-meta";

const opt = (id: string) => DEFAULT_RESULT_OPTIONS.find((o) => o.id === id);

const allParts = [
  { key: "quiz", label: "Quiz and Activities" },
  { key: "theory", label: "Theory Task" },
  { key: "workplace", label: "Workplacement Task" },
];
const allAccepted = { quiz: "Accepted", theory: "Accepted", workplace: "Accepted" } as const;

describe("checkUnitResult — final result options", () => {
  it("allows Pass when every part is accepted", () => {
    expect(checkUnitResult(opt("Pass"), "", allParts, allAccepted)).toBeNull();
  });

  it("blocks Pass and lists the parts not accepted yet", () => {
    expect(checkUnitResult(opt("Pass"), "", allParts, { ...allAccepted, theory: "Rejected", workplace: "Submitted" })).toBe(
      "Can’t pass yet — not Satisfactory: Theory Task, Workplacement Task.",
    );
  });

  it("only counts parts the college set up", () => {
    const quizOnly = [allParts[0]];
    expect(checkUnitResult(opt("Pass"), "", quizOnly, { quiz: "Accepted" })).toBeNull();
  });

  it("can't pass a unit with no assessment", () => {
    expect(checkUnitResult(opt("Pass"), "", null, {})).toBe("This unit has no assessment set up yet, so it can’t be passed.");
  });

  it("Fail needs feedback", () => {
    expect(checkUnitResult(opt("Fail"), "  ", allParts, {})).toBe("Add feedback explaining why the result is Fail.");
    expect(checkUnitResult(opt("Fail"), "Did not attend", allParts, {})).toBeNull();
  });

  it("Withdrawn is allowed any time", () => {
    expect(checkUnitResult(opt("Withdrawn"), "", allParts, {})).toBeNull();
  });

  it("rejects unknown results", () => {
    expect(checkUnitResult(opt("Merit"), "", allParts, allAccepted)).toBe("Choose a final result.");
  });

  it("follows the kind of an added result, not its name", () => {
    const competent: ResultOption = { id: "R1", label: "Competent", kind: "pass", tone: "green" };
    const nyc: ResultOption = { id: "R2", label: "Not Yet Competent", kind: "fail", tone: "red" };
    const credit: ResultOption = { id: "R3", label: "Credit Transfer", kind: "other", tone: "blue" };
    expect(checkUnitResult(competent, "", allParts, { quiz: "Accepted" })).toMatch(/^Can’t pass yet/);
    expect(checkUnitResult(competent, "", allParts, allAccepted)).toBeNull();
    expect(checkUnitResult(nyc, "", allParts, {})).toBe("Add feedback explaining why the result is Not Yet Competent.");
    expect(checkUnitResult(credit, "", null, {})).toBeNull();
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

describe("part statuses — Satisfactory / Not Yet Satisfactory / Request More Documents", () => {
  it("uses the exact module statuses from the LMS guide", async () => {
    const { statusLabel, MODULE_STATUSES } = await import("@/lib/submission-meta");
    expect(MODULE_STATUSES).toEqual(["Active", "Pending marking", "Satisfactory", "Not satisfactory", "Additional information requested"]);
    expect(["Not started", "Draft", "Submitted", "Accepted", "Rejected", "MoreDocs"].map((s) => statusLabel[s as keyof typeof statusLabel])).toEqual([
      "Active",
      "Active", // a draft is only a save indicator, not a status
      "Pending marking",
      "Satisfactory",
      "Not satisfactory",
      "Additional information requested",
    ]);
  });

  it("lets the student upload again after Not Yet Satisfactory or Request More Documents", async () => {
    const { needsRework } = await import("@/lib/submission-meta");
    expect(needsRework("Rejected")).toBe(true);
    expect(needsRework("MoreDocs")).toBe(true);
    expect(needsRework("Accepted")).toBe(false);
    expect(canEditWork("MoreDocs", false, false)).toBe(true);
    expect(canEditWork("Accepted", false, false)).toBe(false);
  });
});
