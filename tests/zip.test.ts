import { describe, expect, it } from "vitest";
import { crc32, makeZip } from "../lib/zip";

const enc = (s: string) => new TextEncoder().encode(s);

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(enc("123456789"))).toBe(0xcbf43926);
  });

  it("writes a readable archive with every file", () => {
    const zip = makeZip([
      { name: "Week 1/Notes.pdf", data: enc("one") },
      { name: "Week 1/Notes.pdf", data: enc("two") },
    ]);
    const v = new DataView(zip.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);
    const text = new TextDecoder().decode(zip);
    expect(text).toContain("Week 1/Notes.pdf");
    expect(text).toContain("Week 1/Notes (2).pdf"); // duplicate names kept apart
  });
});
