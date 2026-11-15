// The portal's clock in the browser. Everything a student sees about deadlines (a module locked, "overdue", days
// left) follows the SERVER's time, never the computer's: a wrong or changed clock must not show a module locked or
// open. The server still enforces every deadline itself (submitting, extension requests); this only keeps the page
// the same as what the server will accept.
//
// It counts on performance.now(), which the computer's date/time settings can't move, plus the offset to the
// server's time measured by the last sync (see app/dashboard/_components/ServerClock.tsx).
// Shared by client components and tests (no server-only imports here).

import { useSyncExternalStore } from "react";

let offset: number | null = null; // server time minus performance.now() (ms); null until the first sync
const listeners = new Set<() => void>();

/**
 * Record the server's time `serverMs`, read between `sentAt` and `receivedAt` (performance.now() values):
 * half the round trip is taken as the time the answer took to come back.
 */
export function syncServerClock(serverMs: number, sentAt = performance.now(), receivedAt = sentAt) {
  offset = serverMs - (sentAt + receivedAt) / 2;
  listeners.forEach((listener) => listener());
}

export const isServerClockSynced = () => offset !== null;

/** Now, by the server's clock (on the server, and in the browser before the first sync: the local clock) */
export const serverNow = () => (offset === null ? Date.now() : performance.now() + offset);

/** Called again after each sync (for useSyncExternalStore) */
export function subscribeServerClock(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/**
 * The server's time for rendering, moving on every `stepMs`. `renderedAt` is the server's time when the page was
 * made: the server render and hydration use it (so they agree), and so does the browser until the first sync.
 */
export function useServerNow(renderedAt: number, stepMs = 15_000) {
  return useSyncExternalStore(
    (onChange) => {
      const unsubscribe = subscribeServerClock(onChange);
      const timer = setInterval(onChange, stepMs);
      return () => {
        unsubscribe();
        clearInterval(timer);
      };
    },
    () => (offset === null ? renderedAt : Math.floor(serverNow() / stepMs) * stepMs),
    () => renderedAt,
  );
}

/** Tests only: forget the last sync */
export function resetServerClockForTests() {
  offset = null;
}
