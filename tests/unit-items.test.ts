import { describe, expect, it } from "vitest";
import { melbourneClock } from "@/lib/clock";
import { unitItemKeys } from "@/lib/unit-items";

describe("unitItemKeys", () => {
  it("puts Resources first, then the modules in admin's order", () => {
    expect(unitItemKeys(true, ["m3", "m1", "m2"])).toEqual(["resources", "part:m3", "part:m1", "part:m2"]);
  });

  it("leaves out Resources when there are none, and works with any number of modules", () => {
    expect(unitItemKeys(false, ["only"])).toEqual(["part:only"]);
    expect(unitItemKeys(true, [])).toEqual(["resources"]);
    expect(unitItemKeys(false, [])).toEqual([]);
  });
});

describe("melbourneClock", () => {
  it("shows Melbourne time (daylight saving in November)", () => {
    // 09:31:05 UTC on 5 Nov 2026 = 8:31:05 pm AEDT
    const c = melbourneClock(Date.parse("2026-11-05T09:31:05Z"));
    expect(c.date).toMatch(/Thu.*5 Nov.*2026/);
    expect(c.time.replace(/\s/g, " ")).toMatch(/^8:31:05 pm$/i);
  });

  it("shows standard time in winter", () => {
    // 00:00 UTC on 1 Jul 2026 = 10:00 am AEST
    expect(melbourneClock(Date.parse("2026-07-01T00:00:00Z")).time.replace(/\s/g, " ")).toMatch(/^10:00:00 am$/i);
  });
});
