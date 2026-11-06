import { describe, expect, it } from "vitest";
import { signedUploads } from "@/lib/document-meta";

const f = (id: string) => ({ id: id.repeat(24), name: `${id}.pdf`, size: 10 });

describe("signedUploads (placement: more than one signed file, never replaced)", () => {
  it("reads an older single-file record as a list of one", () => {
    expect(signedUploads({ file: f("a"), uploadedAt: new Date("2026-10-01T00:00:00Z") })).toEqual([
      { file: f("a"), uploadedAt: "2026-10-01T00:00:00.000Z" },
    ]);
  });

  it("reads the list, oldest first", () => {
    const list = signedUploads({
      uploads: [
        { file: f("b"), uploadedAt: new Date("2026-11-02T00:00:00Z") },
        { file: f("a"), uploadedAt: new Date("2026-11-01T00:00:00Z") },
      ],
    });
    expect(list.map((u) => u.file.name)).toEqual(["a.pdf", "b.pdf"]);
  });

  it("keeps an older file alongside newer ones, without counting it twice", () => {
    const both = signedUploads({
      file: f("a"),
      uploadedAt: new Date("2026-10-01T00:00:00Z"),
      uploads: [{ file: f("b"), uploadedAt: new Date("2026-11-01T00:00:00Z") }],
    });
    expect(both.map((u) => u.file.name)).toEqual(["a.pdf", "b.pdf"]);
    const dup = signedUploads({
      file: f("a"),
      uploadedAt: new Date("2026-10-01T00:00:00Z"),
      uploads: [{ file: f("a"), uploadedAt: new Date("2026-10-01T00:00:00Z") }],
    });
    expect(dup).toHaveLength(1);
  });

  it("is empty with nothing uploaded", () => {
    expect(signedUploads({})).toEqual([]);
  });
});
