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
