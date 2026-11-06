import { describe, expect, it } from "vitest";
import { canJoin, checkSession, nextSession, sessionIcs, sessionState, sessionWhen, type ClassSessionDTO } from "@/lib/session-meta";

const ctx = { units: ["CHCCCS040"], trainerIds: ["T1"], timezones: ["Australia/Melbourne", "Australia/Perth"] as const };
const base = { title: "Supporting choice", unitCode: "CHCCCS040", trainerId: "T1", date: "2027-02-18", start: "18:00", end: "20:00", timezone: "Australia/Melbourne", link: "", instructions: "Read chapter 2" };

describe("checkSession", () => {
  it("turns a Melbourne date and times into instants (daylight saving by name)", () => {
    const r = checkSession(base, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 18 Feb is AEDT (UTC+11): 6 pm = 07:00 UTC
    expect(r.value.startsAt.toISOString()).toBe("2027-02-18T07:00:00.000Z");
    expect(r.value.endsAt.toISOString()).toBe("2027-02-18T09:00:00.000Z");
    expect(r.value.link).toBeNull(); // → "Meeting link coming soon"
  });

  it("uses winter time in July", () => {
    const r = checkSession({ ...base, date: "2027-07-15" }, ctx);
    expect(r.ok && r.value.startsAt.toISOString()).toBe("2027-07-15T08:00:00.000Z"); // AEST UTC+10
  });

  it("needs the end after the start", () => {
    expect(checkSession({ ...base, end: "18:00" }, ctx)).toEqual({ ok: false, error: "The end time must be after the start time." });
    expect(checkSession({ ...base, end: "17:00" }, ctx).ok).toBe(false);
  });

  it("checks the unit, trainer and Meet link", () => {
    expect(checkSession({ ...base, unitCode: "OTHER1" }, ctx).ok).toBe(false);
    expect(checkSession({ ...base, trainerId: "T9" }, ctx).ok).toBe(false);
    expect(checkSession({ ...base, link: "https://zoom.us/j/1" }, ctx).ok).toBe(false);
    expect(checkSession({ ...base, link: "meet.google.com/abc-defg-hij" }, ctx)).toMatchObject({ ok: true, value: { link: "https://meet.google.com/abc-defg-hij" } });
  });
});

const s = (o: Partial<ClassSessionDTO> = {}): ClassSessionDTO => ({
  sessionId: "x1",
  batchId: "B1",
  courseCode: "C",
  unitCode: "U",
  title: "Class",
  trainerId: null,
  trainerName: "Sarah Wilson",
  startsAt: "2027-02-18T07:00:00.000Z",
  endsAt: "2027-02-18T09:00:00.000Z",
  timezone: "Australia/Melbourne",
  link: "https://meet.google.com/abc-defg-hij",
  instructions: "Read chapter 2, bring an example.",
  cancelled: false,
  updatedAt: "2027-02-01T00:00:00.000Z",
  ...o,
});

describe("session state and Join", () => {
  const before = Date.parse("2027-02-18T05:00:00Z");
  const during = Date.parse("2027-02-18T08:00:00Z");
  const after = Date.parse("2027-02-18T10:00:00Z");
  it("is upcoming, live, then ended", () => {
    expect(sessionState(s(), before)).toBe("upcoming");
    expect(sessionState(s(), during)).toBe("live");
    expect(sessionState(s(), after)).toBe("ended");
  });
  it("offers Join only with a link, and never for cancelled or past sessions", () => {
    expect(canJoin(s(), before)).toBe(true);
    expect(canJoin(s({ link: null }), before)).toBe(false);
    expect(canJoin(s({ cancelled: true }), before)).toBe(false);
    expect(canJoin(s(), after)).toBe(false);
  });
  it("finds the next class, skipping cancelled and past ones", () => {
    const list = [s({ sessionId: "past", startsAt: "2027-01-01T00:00:00Z", endsAt: "2027-01-01T01:00:00Z" }), s({ sessionId: "off", cancelled: true }), s({ sessionId: "next" })];
    expect(nextSession(list, before)?.sessionId).toBe("next");
    expect(nextSession([], before)).toBeNull();
  });
  it("always shows the timezone beside the time", () => {
    expect(sessionWhen(s())).toMatch(/18 Feb 2027 · 6:00 pm – 8:00 pm .*\(Australia\/Melbourne\)/);
  });
});

describe("sessionIcs (Add to calendar)", () => {
  it("is a valid calendar event in UTC with the link and instructions", () => {
    const ics = sessionIcs(s());
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:20270218T070000Z");
    expect(ics).toContain("DTEND:20270218T090000Z");
    expect(ics).toContain("URL:https://meet.google.com/abc-defg-hij");
    expect(ics).toContain("Read chapter 2\\, bring an example.");
  });
  it("marks a cancelled class and says when the link is still to come", () => {
    expect(sessionIcs(s({ cancelled: true }))).toContain("STATUS:CANCELLED");
    expect(sessionIcs(s({ link: null }))).toContain("Meeting link coming soon");
  });
});
