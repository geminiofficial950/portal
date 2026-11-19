// A student's profile details (first / last name, phone, state, notes) — checked the same way for Add student,
// Bulk upload and editing the profile. Shared by server and browser.

export const AU_STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"] as const;
export const NAME_PART_MAX = 60;
export const PROFILE_NOTES_MAX = 1000;

export type ProfileInput = { firstName?: unknown; lastName?: unknown; phone?: unknown; state?: unknown; notes?: unknown };
export type Profile = { firstName: string; lastName: string; phone: string; state: string; notes: string };

const tidy = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ");

/** Full name from its parts */
export const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim();

/** Older records only have one name: first word = first name, the rest = last name */
export function splitName(name: string) {
  const [first = "", ...rest] = tidy(name).split(" ");
  return { firstName: first, lastName: rest.join(" ") };
}

/** State: one of the Australian states / territories (any case, full names accepted), or blank */
export function cleanState(v: unknown): string | null {
  const s = tidy(v).toUpperCase();
  if (!s) return "";
  const named: Record<string, string> = {
    "AUSTRALIAN CAPITAL TERRITORY": "ACT", "NEW SOUTH WALES": "NSW", "NORTHERN TERRITORY": "NT", QUEENSLAND: "QLD",
    "SOUTH AUSTRALIA": "SA", TASMANIA: "TAS", VICTORIA: "VIC", "WESTERN AUSTRALIA": "WA",
  };
  const code = named[s] ?? s;
  return (AU_STATES as readonly string[]).includes(code) ? code : null;
}

/** Checks the profile fields; first name, last name and phone are required */
export function checkProfile(input: ProfileInput): { ok: true; value: Profile } | { ok: false; error: string } {
  const firstName = tidy(input.firstName).slice(0, NAME_PART_MAX);
  const lastName = tidy(input.lastName).slice(0, NAME_PART_MAX);
  const phone = tidy(input.phone);
  const notes = String(input.notes ?? "").trim().slice(0, PROFILE_NOTES_MAX);
  if (!firstName) return { ok: false, error: "First name is required." };
  if (!lastName) return { ok: false, error: "Last name is required." };
  if (!phone) return { ok: false, error: "Phone number is required." };
  if (!/^\+?[\d\s()-]{6,20}$/.test(phone) || phone.replace(/\D/g, "").length < 6) return { ok: false, error: "Enter a valid phone number (digits, spaces, + ( ) -)." };
  const state = cleanState(input.state);
  if (state === null) return { ok: false, error: `State must be one of ${AU_STATES.join(", ")} (or left blank).` };
  return { ok: true, value: { firstName, lastName, phone, state, notes } };
}
