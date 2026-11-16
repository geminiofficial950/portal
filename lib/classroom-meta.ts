// Classroom: Google Meet links the college shares with the students of a course.
// Shared by server code and client components (no server-only imports here).

export const CLASS_LIMITS = { title: 120, perCourse: 20 } as const;

export type ClassLinkDTO = { id: string; courseCode: string; title: string; url: string; addedBy: string; updatedAt: string };

// Only real Google Meet links ("meet.google.com/abc-defg-hij", with or without https://)
export function cleanMeetUrl(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.hostname.toLowerCase() !== "meet.google.com" || u.username || u.password || u.port) return null;
    if (u.pathname.replace(/\/+$/, "") === "") return null;
    return `https://meet.google.com${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

export function checkClassLink(input: { title?: unknown; url?: unknown }): { ok: true; title: string; url: string } | { ok: false; error: string } {
  const title = String(input.title ?? "").trim().replace(/\s+/g, " ");
  if (!title) return { ok: false, error: "Give the class a name." };
  if (title.length > CLASS_LIMITS.title) return { ok: false, error: `Keep the class name under ${CLASS_LIMITS.title} characters.` };
  const url = cleanMeetUrl(input.url);
  if (!url) return { ok: false, error: "Paste a Google Meet link (meet.google.com/…)." };
  return { ok: true, title, url };
}

// ---------- Meeting ID and code (passcode) shown next to a Meet link ----------

export const MEET_ID_MAX = 40;
export type MeetDetails = { meetingId: string | null; passcode: string | null };

/** A Google Meet code like "abc-defg-hij" (spaces/case ignored; 10 letters without dashes also accepted) */
export function meetCode(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(s)) return s;
  if (/^[a-z]{10}$/.test(s)) return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`;
  return null;
}

/**
 * Link + Meeting ID + code from a form. Either the link or the Meeting ID is needed (when `required`):
 * a Meet code alone makes the link; a Meet link alone gives its code as the Meeting ID.
 */
export function checkMeetDetails(
  input: { link?: unknown; meetingId?: unknown; passcode?: unknown },
  { required }: { required: boolean },
): { ok: true; link: string | null; meetingId: string | null; passcode: string | null } | { ok: false; error: string } {
  const rawLink = String(input?.link ?? "").trim();
  const rawId = String(input?.meetingId ?? "").trim().replace(/\s+/g, " ");
  const passcode = String(input?.passcode ?? "").trim().replace(/\s+/g, " ") || null;
  if (rawId.length > MEET_ID_MAX || (passcode?.length ?? 0) > MEET_ID_MAX) return { ok: false, error: `Keep the Meeting ID and code under ${MEET_ID_MAX} characters.` };
  let link = rawLink ? cleanMeetUrl(rawLink) : null;
  if (rawLink && !link) return { ok: false, error: "That isn’t a Google Meet link (meet.google.com/…)." };
  const code = meetCode(rawId);
  if (!link && code) link = `https://meet.google.com/${code}`;
  if (!link && rawId) return { ok: false, error: "Add the Google Meet link, or a Meeting ID like abc-defg-hij." };
  if (!link && required) return { ok: false, error: "Add the Google Meet link or the Meeting ID." };
  return { ok: true, link, meetingId: code ?? (rawId || meetIdOf(link)), passcode };
}

/** The Meet code inside a Google Meet link ("https://meet.google.com/abc-defg-hij" → "abc-defg-hij"), else null */
export function meetIdOf(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    const u = new URL(link);
    return u.hostname === "meet.google.com" ? meetCode(u.pathname.split("/").filter(Boolean).pop()) : null;
  } catch {
    return null;
  }
}
