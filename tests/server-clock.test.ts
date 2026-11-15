import { afterEach, describe, expect, it, vi } from "vitest";
import { deadlineLocked } from "@/lib/deadline-meta";
import { isServerClockSynced, resetServerClockForTests, serverNow, subscribeServerClock, syncServerClock } from "@/lib/server-clock";

const SERVER = Date.parse("2026-11-14T13:00:00Z"); // the real time
const DUE = "2026-11-14T18:11:00.000Z"; // 5:11 am Melbourne, still ahead

afterEach(() => {
  resetServerClockForTests();
  vi.restoreAllMocks();
});

describe("server clock", () => {
  it("uses the computer's clock until the first sync", () => {
    expect(isServerClockSynced()).toBe(false);
    const before = Date.now();
    expect(serverNow()).toBeGreaterThanOrEqual(before);
  });

  it("follows the server's time, halving the round trip", () => {
    vi.spyOn(performance, "now").mockReturnValue(1_400);
    syncServerClock(SERVER, 1_000, 1_400); // the answer was read at the midpoint (1 200)
    expect(isServerClockSynced()).toBe(true);
    expect(serverNow()).toBe(SERVER + 200);
  });

  it("isn't moved by changing the computer's date and time", () => {
    const perf = vi.spyOn(performance, "now").mockReturnValue(500);
    syncServerClock(SERVER, 500, 500);
    // the student sets the computer 7 hours ahead: Date.now() jumps, performance.now() doesn't
    vi.spyOn(Date, "now").mockReturnValue(SERVER + 7 * 3_600_000);
    perf.mockReturnValue(560); // 60 ms later
    expect(serverNow()).toBe(SERVER + 60);
    // so a module due at 5:11 am stays open, as the server sees it
    expect(deadlineLocked(DUE, "MoreDocs", serverNow())).toBe(false);
  });

  it("tells subscribers after each sync", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeServerClock(listener);
    syncServerClock(SERVER);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    syncServerClock(SERVER);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
