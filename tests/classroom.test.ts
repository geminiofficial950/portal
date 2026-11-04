import { describe, expect, it } from "vitest";
import { checkClassLink, cleanMeetUrl } from "../lib/classroom-meta";

describe("cleanMeetUrl", () => {
  it("accepts Google Meet links with or without https", () => {
    expect(cleanMeetUrl("https://meet.google.com/abc-defg-hij")).toBe("https://meet.google.com/abc-defg-hij");
    expect(cleanMeetUrl("  meet.google.com/abc-defg-hij?authuser=1 ")).toBe("https://meet.google.com/abc-defg-hij?authuser=1");
    expect(cleanMeetUrl("http://MEET.GOOGLE.COM/abc-defg-hij#x")).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("refuses anything that isn't a Meet room", () => {
    for (const bad of ["", "https://meet.google.com/", "https://evil.com/meet.google.com/x", "https://meet.google.com.evil.com/x", "javascript:alert(1)", "https://user@meet.google.com/x"]) {
      expect(cleanMeetUrl(bad)).toBeNull();
    }
  });
});

describe("checkClassLink", () => {
  it("needs a name and a Meet link", () => {
    expect(checkClassLink({ title: "", url: "meet.google.com/abc" }).ok).toBe(false);
    expect(checkClassLink({ title: "Weekly class", url: "zoom.us/j/1" }).ok).toBe(false);
    expect(checkClassLink({ title: "  Weekly   class ", url: "meet.google.com/abc" })).toEqual({ ok: true, title: "Weekly class", url: "https://meet.google.com/abc" });
  });
});
