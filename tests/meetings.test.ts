import { describe, expect, it } from "vitest";
import { checkMeeting, meetingState, meetingWhen, zonedParts, zonedToUtc } from "../lib/meetings-meta";

describe("zonedToUtc", () => {
  it("reads the time as Sydney time, across daylight saving", () => {
    expect(zonedToUtc("2026-11-10", "10:00")?.toISOString()).toBe("2026-11-09T23:00:00.000Z"); // AEDT, +11
    expect(zonedToUtc("2026-06-10", "10:00")?.toISOString()).toBe("2026-06-10T00:00:00.000Z"); // AEST, +10
  });

  it("refuses dates and times that don't exist", () => {
    expect(zonedToUtc("2026-02-31", "10:00")).toBeNull();
    expect(zonedToUtc("2026-11-10", "25:00")).toBeNull();
    expect(zonedToUtc("", "")).toBeNull();
  });

  it("round-trips through zonedParts", () => {
    expect(zonedParts("2026-11-09T23:00:00.000Z")).toEqual({ date: "2026-11-10", time: "10:00" });
  });
});

describe("checkMeeting", () => {
  const now = Date.parse("2026-11-03T00:00:00Z");
  const good = { title: " Trainer  support ", notes: "", date: "2026-11-10", time: "10:00", minutes: 30, url: "meet.google.com/abc-defg-hij" };

  it("accepts a proper meeting", () => {
    const r = checkMeeting(good, now);
    expect(r.ok && [r.title, r.startsAt.toISOString(), r.url]).toEqual(["Trainer support", "2026-11-09T23:00:00.000Z", "https://meet.google.com/abc-defg-hij"]);
  });

  it("refuses past times, odd lengths, missing names and non-Meet links", () => {
    expect(checkMeeting({ ...good, date: "2026-11-01" }, now).ok).toBe(false);
    expect(checkMeeting({ ...good, minutes: 7 }, now).ok).toBe(false);
    expect(checkMeeting({ ...good, url: "https://zoom.us/j/1" }, now).ok).toBe(false);
    const auto = checkMeeting({ ...good, url: "" }, now); // no link: Google makes it
    expect(auto.ok && auto.url).toBeNull();
    expect(checkMeeting({ ...good, title: "" }, now).ok).toBe(false);
  });
});

describe("meetingState / meetingWhen", () => {
  const m = { startsAt: "2026-11-09T23:00:00.000Z", minutes: 30 };
  it("is live from 15 minutes before until the end", () => {
    expect(meetingState(m, Date.parse("2026-11-09T22:40:00Z"))).toBe("upcoming");
    expect(meetingState(m, Date.parse("2026-11-09T22:50:00Z"))).toBe("live");
    expect(meetingState(m, Date.parse("2026-11-09T23:30:00Z"))).toBe("ended");
  });
  it("shows Sydney time", () => {
    expect(meetingWhen(m).time.replace(/\s/g, " ")).toBe("10:00 am – 10:30 am");
  });
});
