// Date helpers shared by server data mappers. Fixed locale + timezone so output is stable.
const TZ = "Australia/Sydney";

export const formatDate = (d: Date) =>
  d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ });

export const formatDateTime = (d: Date) =>
  `${d.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: TZ })} · ${d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: TZ })}`;

export function timeAgo(d: Date, now = new Date()) {
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return "Just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? "s" : ""} ago`;
  const days = Math.round(h / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(d);
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// ISO → value for <input type="datetime-local"> in the viewer's own time zone (use in the browser)
export const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// "29-Oct-2026 14:08:29" in the college's time zone, for declaration certificates
export function formatStamp(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-AU", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}:${p.second}`;
}
