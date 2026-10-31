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
