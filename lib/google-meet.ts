import "server-only";
import { randomUUID } from "node:crypto";
import { MEETING_TZ } from "./meetings-meta";

// Makes the Google Meet link for a scheduled meeting automatically: each meeting is an event in the college's
// Google Calendar with a Meet conference attached. Connect once with `node --env-file=.env scripts/google-meet-connect.mjs`,
// which gives the GOOGLE_* values for .env. Nobody is emailed — students see the meeting in the portal.

const CAL = "https://www.googleapis.com/calendar/v3/calendars";

export class GoogleMeetError extends Error {}

const env = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID ?? "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? "",
  calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
});

// Is a Google account connected?
export const googleMeetReady = () => {
  const e = env();
  return !!(e.clientId && e.clientSecret && e.refreshToken);
};

let token: { value: string; until: number } | null = null;

async function accessToken() {
  if (token && token.until > Date.now() + 60_000) return token.value;
  const e = env();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: e.clientId, client_secret: e.clientSecret, refresh_token: e.refreshToken, grant_type: "refresh_token" }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) {
    console.error("google token failed:", res.status, data.error);
    throw new GoogleMeetError("Google Meet isn’t connected properly — run the Google Meet connect script again.");
  }
  token = { value: data.access_token, until: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return token.value;
}

type GoogleEvent = { id?: string; hangoutLink?: string; conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] } };

async function call(method: string, path: string, body?: object): Promise<GoogleEvent> {
  const res = await fetch(`${CAL}/${encodeURIComponent(env().calendarId)}/events${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === "DELETE" && (res.status === 404 || res.status === 410)) return {}; // already gone in Google
  const data = (await res.json().catch(() => ({}))) as GoogleEvent & { error?: { message?: string } };
  if (!res.ok) {
    console.error("google calendar failed:", method, res.status, data.error?.message);
    throw new GoogleMeetError("Google Calendar didn’t accept that — try again in a minute.");
  }
  return data;
}

const meetLink = (e: GoogleEvent) => e.hangoutLink ?? e.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ?? null;

type Slot = { title: string; notes: string; startsAt: Date; minutes: number };

const eventBody = (s: Slot) => ({
  summary: s.title,
  description: s.notes,
  start: { dateTime: s.startsAt.toISOString(), timeZone: MEETING_TZ },
  end: { dateTime: new Date(s.startsAt.getTime() + s.minutes * 60_000).toISOString(), timeZone: MEETING_TZ },
});

// New calendar event with a Meet room → its id and the Meet link
export async function createMeetEvent(s: Slot) {
  const created = await call("POST", "?conferenceDataVersion=1&sendUpdates=none", {
    ...eventBody(s),
    conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } },
  });
  if (!created.id) throw new GoogleMeetError("Google Calendar didn’t make the meeting — try again.");
  // The Meet room is usually ready straight away; if not, look again shortly
  let url = meetLink(created);
  for (let i = 0; !url && i < 3; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    url = meetLink(await call("GET", `/${encodeURIComponent(created.id)}`));
  }
  if (!url) {
    await deleteMeetEvent(created.id).catch(() => undefined);
    throw new GoogleMeetError("Google didn’t give a Meet link — check Google Meet is turned on for this account.");
  }
  return { eventId: created.id, url };
}

// New name, notes or time; the Meet link stays the same
export async function updateMeetEvent(eventId: string, s: Slot) {
  await call("PATCH", `/${encodeURIComponent(eventId)}?sendUpdates=none`, eventBody(s));
}

export async function deleteMeetEvent(eventId: string) {
  await call("DELETE", `/${encodeURIComponent(eventId)}?sendUpdates=none`);
}
