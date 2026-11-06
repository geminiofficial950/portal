// The live Melbourne clock in the portal header. Shared by server and client.
export const COLLEGE_TZ = "Australia/Melbourne";

/** "Thu 5 Nov 2026" and "8:31:05 pm" in Melbourne time, for an instant */
export function melbourneClock(ms: number) {
  const d = new Date(ms);
  const part = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-AU", { timeZone: COLLEGE_TZ, ...opts }).format(d);
  return {
    date: part({ weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    time: part({ hour: "numeric", minute: "2-digit", second: "2-digit" }),
  };
}
