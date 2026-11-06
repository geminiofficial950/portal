import { describe, expect, it } from "vitest";
import {
  checkDeadlineChange,
  checkExtensionDecision,
  checkExtensionRequest,
  deadlineLocked,
  effectiveDue,
  previewDeadlineChange,
} from "@/lib/deadline-meta";

const NOW = Date.parse("2027-02-28T12:00:00Z");
const PAST = "2027-02-27T00:00:00.000Z";
const FUTURE = "2027-03-10T00:00:00.000Z";

describe("effectiveDue", () => {
  it("a student's own module date wins, then an older unit date, then the module's", () => {
    expect(effectiveDue(PAST, null, null)).toBe(PAST);
    expect(effectiveDue(PAST, FUTURE, null)).toBe(FUTURE);
    expect(effectiveDue(PAST, "2027-04-01T00:00:00.000Z", FUTURE)).toBe(FUTURE);
  });
});

describe("deadlineLocked", () => {
  it("locks unfinished work after the deadline", () => {
    expect(deadlineLocked(PAST, undefined, NOW)).toBe(true);
    expect(deadlineLocked(PAST, "Draft", NOW)).toBe(true);
    expect(deadlineLocked(PAST, "MoreDocs", NOW)).toBe(true);
  });
  it("doesn't lock before the deadline, or work already handed in / marked", () => {
    expect(deadlineLocked(FUTURE, undefined, NOW)).toBe(false);
    expect(deadlineLocked(null, undefined, NOW)).toBe(false);
    expect(deadlineLocked(PAST, "Submitted", NOW)).toBe(false);
    expect(deadlineLocked(PAST, "Accepted", NOW)).toBe(false);
  });
});

describe("checkExtensionRequest", () => {
  it("needs a reason and a future date", () => {
    expect(checkExtensionRequest({ reason: "Sick", proposedDue: FUTURE }, { now: NOW, pending: false })).toEqual({ ok: true, reason: "Sick", proposedDue: FUTURE });
    expect(checkExtensionRequest({ reason: " ", proposedDue: FUTURE }, { now: NOW, pending: false }).ok).toBe(false);
    expect(checkExtensionRequest({ reason: "x", proposedDue: PAST }, { now: NOW, pending: false }).ok).toBe(false);
    expect(checkExtensionRequest({ reason: "x" }, { now: NOW, pending: false }).ok).toBe(false);
  });
  it("prevents a duplicate while one is pending", () => {
    expect(checkExtensionRequest({ reason: "Sick", proposedDue: FUTURE }, { now: NOW, pending: true })).toEqual({
      ok: false,
      error: "You already have a request waiting for a decision.",
    });
  });
});

describe("checkExtensionDecision", () => {
  it("approval requires a new future deadline", () => {
    expect(checkExtensionDecision({ approve: true, newDue: FUTURE }, NOW)).toEqual({ ok: true, approve: true, newDue: FUTURE, reason: "" });
    expect(checkExtensionDecision({ approve: true }, NOW).ok).toBe(false);
    expect(checkExtensionDecision({ approve: true, newDue: PAST }, NOW).ok).toBe(false);
  });
  it("declining requires a reason", () => {
    expect(checkExtensionDecision({ approve: false }, NOW).ok).toBe(false);
    expect(checkExtensionDecision({ approve: false, reason: "No evidence" }, NOW)).toEqual({ ok: true, approve: false, newDue: null, reason: "No evidence" });
  });
});

describe("deadline changes by staff", () => {
  it("need a date and a reason for the log", () => {
    expect(checkDeadlineChange({ dueAt: FUTURE, reason: "Public holiday" })).toEqual({ ok: true, dueAt: FUTURE, reason: "Public holiday" });
    expect(checkDeadlineChange({ dueAt: FUTURE }).ok).toBe(false);
    expect(checkDeadlineChange({ reason: "x" }).ok).toBe(false);
  });
  it("preview shows old and new date per selected student", () => {
    expect(previewDeadlineChange([{ studentId: "S1", name: "A", currentDue: PAST }, { studentId: "S2", name: "B", currentDue: FUTURE }], FUTURE)).toEqual([
      { studentId: "S1", name: "A", currentDue: PAST, newDue: FUTURE, changes: true },
      { studentId: "S2", name: "B", currentDue: FUTURE, newDue: FUTURE, changes: false },
    ]);
  });
});
