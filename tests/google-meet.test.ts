import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// No real Google calls: fetch is replaced, so nothing is ever scheduled
type Call = { url: string; method: string; body: unknown };
let calls: Call[] = [];
let respond: (c: Call) => { status?: number; json: unknown };

beforeEach(() => {
  vi.resetModules();
  calls = [];
  process.env.GOOGLE_CLIENT_ID = "id";
  process.env.GOOGLE_CLIENT_SECRET = "secret";
  process.env.GOOGLE_REFRESH_TOKEN = "refresh";
  delete process.env.GOOGLE_CALENDAR_ID;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body ? String(init.body) : undefined;
    const call = { url: String(url), method: init.method ?? "GET", body };
    calls.push(call);
    if (call.url.startsWith("https://oauth2.googleapis.com/token")) return Response.json({ access_token: "tok", expires_in: 3600 });
    const r = respond(call);
    return Response.json(r.json, { status: r.status ?? 200 });
  });
});

afterEach(() => vi.unstubAllGlobals());

const slot = { title: "Trainer support", notes: "Bring questions", startsAt: new Date("2026-11-09T23:00:00Z"), minutes: 30 };

describe("google-meet", () => {
  it("is ready only when all three Google values are set", async () => {
    const { googleMeetReady } = await import("../lib/google-meet");
    expect(googleMeetReady()).toBe(true);
    delete process.env.GOOGLE_REFRESH_TOKEN;
    expect(googleMeetReady()).toBe(false);
  });

  it("creates a calendar event with a Meet room and returns its link", async () => {
    respond = () => ({ json: { id: "ev1", hangoutLink: "https://meet.google.com/xyz-abcd-efg" } });
    const { createMeetEvent } = await import("../lib/google-meet");
    expect(await createMeetEvent(slot)).toEqual({ eventId: "ev1", url: "https://meet.google.com/xyz-abcd-efg" });
    const ev = calls[1];
    expect(ev.method).toBe("POST");
    expect(ev.url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=none");
    expect(ev.body).toMatchObject({
      summary: "Trainer support",
      start: { dateTime: "2026-11-09T23:00:00.000Z", timeZone: "Australia/Sydney" },
      end: { dateTime: "2026-11-09T23:30:00.000Z" },
      conferenceData: { createRequest: { conferenceSolutionKey: { type: "hangoutsMeet" } } },
    });
  });

  it("moves and deletes the event without emailing anyone", async () => {
    respond = () => ({ json: {} });
    const { deleteMeetEvent, updateMeetEvent } = await import("../lib/google-meet");
    await updateMeetEvent("ev1", { ...slot, minutes: 60 });
    await deleteMeetEvent("ev1");
    const [patch, del] = calls.filter((c) => c.url.includes("/events/"));
    expect(patch.method).toBe("PATCH");
    expect(patch.url).toContain("/events/ev1?sendUpdates=none");
    expect(patch.body).toMatchObject({ end: { dateTime: "2026-11-10T00:00:00.000Z" } });
    expect(del.method).toBe("DELETE");
  });

  it("treats an event already gone from Google as deleted", async () => {
    respond = () => ({ status: 410, json: {} });
    const { deleteMeetEvent } = await import("../lib/google-meet");
    await expect(deleteMeetEvent("gone")).resolves.toBeUndefined();
  });

  it("turns a Google refusal into a message for the form", async () => {
    respond = () => ({ status: 403, json: { error: { message: "nope" } } });
    const { createMeetEvent, GoogleMeetError } = await import("../lib/google-meet");
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createMeetEvent(slot)).rejects.toBeInstanceOf(GoogleMeetError);
  });
});
