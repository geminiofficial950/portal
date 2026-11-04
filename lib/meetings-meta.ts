// Scheduled meetings (Classroom): staff set a Google Meet meeting for a whole course or one student;
// students see it under Classroom. All times are the college's time (Sydney).
// The Meet link is made automatically in Google Calendar (lib/google-meet.ts); pasting one is the fallback.
// Shared by server code and client components (no server-only imports here).
import { cleanMeetUrl } from "./classroom-meta";

export const MEETING_TZ = "Australia/Sydney";
export const MEETING_LENGTHS = [15, 30, 45, 60, 90, 120] as const;
export const MEETING_LIMITS = { title: 120, notes: 1000, aheadDays: 366 } as const;
const MIN = 60_000;
// "Live now" starts this long before the start
export const JOIN_EARLY_MINUTES = 15;

export type MeetingDTO = {
  id: string;
  courseCode: string;
  studentId: string | null; // null = everyone in the course
  studentName: string | null;
  title: string;
  notes: string;
  startsAt: string; // ISO
  minutes: number;
  url: string;
  auto: boolean; // link made by Google Calendar (the event is kept in step on edit / cancel)
  createdBy: string;
  updatedAt: string;
};

export type MeetingInput = {
  courseCode: string;
  studentId: string; // "" = everyone in the course
  title: string;
  notes: string;
  date: string; // YYYY-MM-DD, Sydney
  time: string; // HH:MM, Sydney
  minutes: number;
  url: string; // "" = let Google make the link
};

const partsIn = (ms: number, tz: string) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );

// How far `tz` is ahead of UTC at this instant, in ms
function tzOffset(ms: number, tz: string) {
  const p = partsIn(ms, tz);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}

// A wall-clock date and time in `tz` (e.g. 2026-11-10 10:00 in Sydney) → the real instant; null if it isn't a valid date/time
export function zonedToUtc(date: string, time: string, tz: string = MEETING_TZ): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ""));
  const t = /^(\d{2}):(\d{2})$/.exec(String(time ?? ""));
  if (!d || !t) return null;
  const [y, mo, da, h, mi] = [+d[1], +d[2], +d[3], +t[1], +t[2]];
  if (mo < 1 || mo > 12 || da < 1 || h > 23 || mi > 59) return null;
  const wall = Date.UTC(y, mo - 1, da, h, mi);
  if (new Date(wall).getUTCDate() !== da) return null; // 31 Feb and the like
  let ms = wall - tzOffset(wall, tz);
  ms = wall - tzOffset(ms, tz); // settle across a daylight-saving change
  return new Date(ms);
}

// The Sydney date and time of an instant, for filling the edit form
export function zonedParts(iso: string, tz: string = MEETING_TZ) {
  const p = partsIn(new Date(iso).getTime(), tz);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export function checkMeeting(
  input: Partial<MeetingInput>,
  now: number,
): { ok: true; title: string; notes: string; startsAt: Date; minutes: number; url: string | null } | { ok: false; error: string } {
  const title = String(input.title ?? "").trim().replace(/\s+/g, " ");
  if (!title) return { ok: false, error: "Give the meeting a name." };
  if (title.length > MEETING_LIMITS.title) return { ok: false, error: `Keep the meeting name under ${MEETING_LIMITS.title} characters.` };
  const notes = String(input.notes ?? "").trim();
  if (notes.length > MEETING_LIMITS.notes) return { ok: false, error: `Keep the notes under ${MEETING_LIMITS.notes} characters.` };
  const startsAt = zonedToUtc(String(input.date ?? ""), String(input.time ?? ""));
  if (!startsAt) return { ok: false, error: "Choose the date and time of the meeting." };
  if (startsAt.getTime() < now) return { ok: false, error: "That time has already passed — choose a time in the future." };
  if (startsAt.getTime() > now + MEETING_LIMITS.aheadDays * 86_400_000) return { ok: false, error: "Meetings can be set up to a year ahead." };
  const minutes = Number(input.minutes);
  if (!(MEETING_LENGTHS as readonly number[]).includes(minutes)) return { ok: false, error: "Choose how long the meeting is." };
  // a pasted link is optional — without one, Google makes it
  const raw = String(input.url ?? "").trim();
  const url = raw ? cleanMeetUrl(raw) : null;
  if (raw && !url) return { ok: false, error: "That isn’t a Google Meet link (meet.google.com/…)." };
  return { ok: true, title, notes, startsAt, minutes, url };
}

export const meetingEnd = (m: Pick<MeetingDTO, "startsAt" | "minutes">) => new Date(m.startsAt).getTime() + m.minutes * MIN;

// upcoming → live (from a few minutes before the start until the end) → ended
export function meetingState(m: Pick<MeetingDTO, "startsAt" | "minutes">, now: number): "upcoming" | "live" | "ended" {
  if (now >= meetingEnd(m)) return "ended";
  return now >= new Date(m.startsAt).getTime() - JOIN_EARLY_MINUTES * MIN ? "live" : "upcoming";
}

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-AU", { timeZone: MEETING_TZ, ...opts }).format(new Date(iso));

// "Tue 10 Nov 2026", "10:00 am – 10:30 am", plus the parts of the date tile
export function meetingWhen(m: Pick<MeetingDTO, "startsAt" | "minutes">) {
  const time = (iso: string) => fmt(iso, { hour: "numeric", minute: "2-digit" });
  return {
    day: fmt(m.startsAt, { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    time: `${time(m.startsAt)} – ${time(new Date(meetingEnd(m)).toISOString())}`,
    tileDay: fmt(m.startsAt, { day: "numeric" }),
    tileMonth: fmt(m.startsAt, { month: "short" }),
  };
}

export const lengthLabel = (minutes: number) =>
  minutes < 60 ? `${minutes} min` : minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`;
