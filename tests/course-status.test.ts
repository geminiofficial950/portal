import { describe, expect, it } from "vitest";
import { accountLabel, COURSE_STATUSES, courseStatusStyle, isCourseStatus, STATUS_CHOICES, statusOptions } from "@/lib/course-status";

describe("course status", () => {
  it("offers the guide's statuses: Active, Withdrawn, Cancelled, Completed, Deferred (Disabled is the account switch)", () => {
    expect(STATUS_CHOICES).toEqual(["Active", "Withdrawn", "Cancelled", "Completed", "Deferred"]);
  });

  it("only accepts those four when setting", () => {
    expect(isCourseStatus("Completed")).toBe(true);
    expect(isCourseStatus("Competent")).toBe(false); // older value: still shown, no longer set
    expect(isCourseStatus("completed")).toBe(false);
    expect(isCourseStatus("Suspended")).toBe(false);
    expect(isCourseStatus(undefined)).toBe(false);
  });

  it("keeps an older value in the dropdown so it isn't lost by accident", () => {
    expect(statusOptions("Active")).toEqual(["Active", "Withdrawn", "Cancelled", "Completed", "Deferred"]);
    expect(statusOptions("Risk of withdrawal")).toEqual(["Active", "Withdrawn", "Cancelled", "Completed", "Deferred", "Risk of withdrawal"]);
  });

  it("gives every status a colour", () => {
    for (const s of COURSE_STATUSES) expect(courseStatusStyle[s]).toBeTruthy();
  });

  it("shows a switched-off account as Disabled", () => {
    expect(accountLabel("Suspended")).toBe("Disabled");
    expect(accountLabel("Active")).toBe("Active");
  });
});
