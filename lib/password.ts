// Client-safe: used by the Super Admin forms to suggest login passwords.
// Readable characters only (no 0/O, 1/l look-alikes) so passwords are easy to share.
export function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
