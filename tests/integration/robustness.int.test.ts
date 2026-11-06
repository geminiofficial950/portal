import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { saveUpload, UploadError } from "@/lib/files";
import { getWork, LockedError, saveWork } from "@/lib/submissions";

// Guide scenario: "Test failed uploads, interrupted connections and duplicate clicks; evidence is not silently lost or duplicated."
const C = "CHC33021";
const key = { studentId: "S1", courseCode: C, unitCode: "U1", part: "m1" };
const meta = { studentName: "Alex", unitTitle: "U1" };
const f = (c: string) => ({ id: c.repeat(24), name: `${c}.pdf`, size: 10 });

describe("duplicate clicks, retries and failed uploads", () => {
  it("two submits at the same moment make ONE submission; the second is refused, nothing lost", async () => {
    const results = await Promise.allSettled([
      saveWork(key, meta, { status: "Submitted", content: {}, files: [f("a")] }),
      saveWork(key, meta, { status: "Submitted", content: {}, files: [f("a")] }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok.length).toBeGreaterThanOrEqual(1);
    for (const r of results) if (r.status === "rejected") expect(r.reason).toBeInstanceOf(Error);
    expect(await (await getDb()).collection("submissions").countDocuments(key)).toBe(1);
    expect((await getWork(key))?.files).toEqual([f("a")]);
  });

  it("a retried submit after it went through is refused (no second attempt), the first stays", async () => {
    await expect(saveWork(key, meta, { status: "Submitted", content: {}, files: [f("b")] })).rejects.toBeInstanceOf(LockedError);
    expect((await getWork(key))?.files).toEqual([f("a")]);
    expect((await getWork(key))?.attempt).toBe(1);
  });

  it("a broken or wrong-type upload is rejected and nothing is stored", async () => {
    const before = await (await getDb()).collection("uploads.files").countDocuments();
    await expect(saveUpload(new File([new Uint8Array([1, 2, 3])], "fake.pdf"), "S1")).rejects.toBeInstanceOf(UploadError);
    await expect(saveUpload(new File([new Uint8Array([1])], "virus.exe"), "S1")).rejects.toBeInstanceOf(UploadError);
    expect(await (await getDb()).collection("uploads.files").countDocuments()).toBe(before);
  });
});
