// Class sessions (LMS guide, "Class sessions"): admin adds sessions to a batch and unit — title, trainer, date,
// start and end time in a named timezone (so daylight saving is handled), Google Meet link and preparation
// instructions. Students see the next class with "Join Google Meet" and "Add to calendar"; without a link they see
// "Meeting link coming soon"; cancelled and past sessions have no Join.
// Shared by server code and client components (no server-only imports here).
import { cleanMeetUrl } from "./classroom-meta";
import { zonedToUtc } from "./meetings-meta";

export type ClassSessionDTO = {
  sessionId: string;
  batchId: string;
  courseCode: string;
  unitCode: string | null;
  title: string;
  trainerId: string | null;
  trainerName: string | null;
  startsAt: string; // ISO
  endsAt: string; // ISO
  timezone: string;
  link: string | null; // null = "Meeting link coming soon"
  instructions: string;
  cancelled: boolean;
  updatedAt: string;
};

export const SESSION_LIMITS = { title: 120, instructions: 1000 } as const;

export type SessionInput = { title: string; unitCode: string; trainerId: string; date: string; start: string; end: string; timezone: string; link: string; instructions: string };

/** Checks the admin form: a title, a valid date with start before end in the batch timezone, and (optionally) a Meet link */
export function checkSession(
  input: Partial<SessionInput>,
  ctx: { units: string[]; trainerIds: string[]; timezones: readonly string[] },
): { ok: true; value: { title: string; unitCode: string | null; trainerId: string | null; startsAt: Date; endsAt: Date; timezone: string; link: string | null; instructions: string } } | { ok: false; error: string } {
  const title = String(input?.title ?? "").trim().replace(/\s+/g, " ");
  if (!title) return { ok: false, error: "Give the session a title." };
  if (title.length > SESSION_LIMITS.title) return { ok: false, error: `Keep the title under ${SESSION_LIMITS.title} characters.` };
  const unitCode = input?.unitCode ? String(input.unitCode) : null;
  if (unitCode && !ctx.units.includes(unitCode)) return { ok: false, error: "That unit isn’t assigned to this batch." };
  const trainerId = input?.trainerId ? String(input.trainerId) : null;
  if (trainerId && !ctx.trainerIds.includes(trainerId)) return { ok: false, error: "Choose an active trainer." };
  const timezone = ctx.timezones.includes(String(input?.timezone)) ? String(input!.timezone) : ctx.timezones[0];
  const startsAt = zonedToUtc(String(input?.date ?? ""), String(input?.start ?? ""), timezone);
  const endsAt = zonedToUtc(String(input?.date ?? ""), String(input?.end ?? ""), timezone);
  if (!startsAt || !endsAt) return { ok: false, error: "Choose the date, start time and end time." };
  if (endsAt.getTime() <= startsAt.getTime()) return { ok: false, error: "The end time must be after the start time." };
  const raw = String(input?.link ?? "").trim();
  const link = raw ? cleanMeetUrl(raw) : null;
  if (raw && !link) return { ok: false, error: "That isn’t a Google Meet link (meet.google.com/…)." };
  const instructions = String(input?.instructions ?? "").trim().slice(0, SESSION_LIMITS.instructions);
  return { ok: true, value: { title, unitCode, trainerId, startsAt, endsAt, timezone, link, instructions } };
}

export type SessionState = "upcoming" | "live" | "ended" | "cancelled";

/** "live" from 15 minutes before the start until the end */
export function sessionState(s: Pick<ClassSessionDTO, "startsAt" | "endsAt" | "cancelled">, now = Date.now()): SessionState {
  if (s.cancelled) return "cancelled";
  if (now >= Date.parse(s.endsAt)) return "ended";
  return now >= Date.parse(s.startsAt) - 15 * 60_000 ? "live" : "upcoming";
}

/** Join only for a session that has a link and isn't cancelled or over */
export const canJoin = (s: Pick<ClassSessionDTO, "startsAt" | "endsAt" | "cancelled" | "link">, now = Date.now()) =>
  !!s.link && (sessionState(s, now) === "upcoming" || sessionState(s, now) === "live");

/** The next class still to come (or running now), skipping cancelled and past ones */
export const nextSession = <T extends Pick<ClassSessionDTO, "startsAt" | "endsAt" | "cancelled">>(list: T[], now = Date.now()) =>
  [...list].filter((s) => !s.cancelled && Date.parse(s.endsAt) > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;

/** "18 Feb 2027 · 6:00 pm – 8:00 pm AEDT (Australia/Melbourne)" — always with the timezone */
export function sessionWhen(s: Pick<ClassSessionDTO, "startsAt" | "endsAt" | "timezone">) {
  const f = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-AU", { timeZone: s.timezone, ...o }).format(new Date(iso));
  const zone = new Intl.DateTimeFormat("en-AU", { timeZone: s.timezone, timeZoneName: "short" }).formatToParts(new Date(s.startsAt)).find((p) => p.type === "timeZoneName")?.value ?? "";
  return `${f(s.startsAt, { day: "numeric", month: "short", year: "numeric" })} · ${f(s.startsAt, { hour: "numeric", minute: "2-digit" })} – ${f(s.endsAt, { hour: "numeric", minute: "2-digit" })} ${zone} (${s.timezone})`;
}

// ---------- Add to calendar (.ics) ----------

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** A calendar file for one session (UTC times, so every calendar app shows it in the viewer's own time) */
export function sessionIcs(s: ClassSessionDTO, collegeName = "Stella College") {
  const desc = [s.instructions, s.link ? `Join: ${s.link}` : "Meeting link coming soon", s.trainerName ? `Trainer: ${s.trainerName}` : ""].filter(Boolean).join("\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${collegeName}//LMS//EN`,
    "BEGIN:VEVENT",
    `UID:${s.sessionId}@stellacollege`,
    `DTSTAMP:${icsDate(s.updatedAt)}`,
    `DTSTART:${icsDate(s.startsAt)}`,
    `DTEND:${icsDate(s.endsAt)}`,
    `SUMMARY:${icsText(s.title)}`,
    `DESCRIPTION:${icsText(desc)}`,
    ...(s.link ? [`URL:${s.link}`, `LOCATION:${s.link}`] : []),
    ...(s.cancelled ? ["STATUS:CANCELLED"] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
