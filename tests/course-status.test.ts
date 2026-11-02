import { describe, expect, it } from "vitest";
import { COURSE_STATUSES, courseStatusStyle, isCourseStatus } from "@/lib/course-status";

describe("course status", () => {
  it("has the eight statuses Super Admin can pick", () => {
    expect(COURSE_STATUSES).toEqual([
      "Active",
      "Completed",
      "Risk of withdrawal",
      "Withdrawn",
      "Cancelled",
      "Inactive",
      "Competent",
      "Not yet competent",
    ]);
  });

  it("only accepts those statuses", () => {
    expect(isCourseStatus("Competent")).toBe(true);
    expect(isCourseStatus("competent")).toBe(false);
    expect(isCourseStatus("Suspended")).toBe(false);
    expect(isCourseStatus(undefined)).toBe(false);
  });

  it("gives every status a colour", () => {
    for (const s of COURSE_STATUSES) expect(courseStatusStyle[s]).toBeTruthy();
  });
});
