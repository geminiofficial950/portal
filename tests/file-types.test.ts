import { describe, expect, it } from "vitest";
import { checkUpload } from "@/lib/file-types";

const bytes = (...head: number[]) => new Uint8Array([...head, ...new Array(100).fill(0x20)]);
const PDF = bytes(0x25, 0x50, 0x44, 0x46);
const DOCX = bytes(0x50, 0x4b, 0x03, 0x04);
const DOC = bytes(0xd0, 0xcf, 0x11, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0);

describe("checkUpload", () => {
  it("accepts real Word, PDF and image files", () => {
    expect(checkUpload("answers.docx", DOCX)).toMatchObject({ ok: true, mime: expect.stringContaining("wordprocessingml") });
    expect(checkUpload("old.doc", DOC)).toMatchObject({ ok: true, mime: "application/msword" });
    expect(checkUpload("log.pdf", PDF)).toMatchObject({ ok: true, mime: "application/pdf" });
    expect(checkUpload("photo.PNG", PNG)).toMatchObject({ ok: true, mime: "image/png" });
    expect(checkUpload("photo.jpeg", JPG)).toMatchObject({ ok: true, mime: "image/jpeg" });
  });

  it("rejects other file types", () => {
    for (const name of ["notes.txt", "run.exe", "page.html", "noextension"]) {
      expect(checkUpload(name, PDF)).toEqual({ ok: false, error: "Only Word, PDF, JPG or PNG files can be uploaded." });
    }
  });

  it("rejects a file whose contents don't match its extension", () => {
    expect(checkUpload("virus.pdf", bytes(0x4d, 0x5a))).toEqual({ ok: false, error: "That file doesn’t look like a real PDF file." });
    expect(checkUpload("fake.docx", PDF).ok).toBe(false);
  });

  it("rejects empty and oversized files", () => {
    expect(checkUpload("empty.pdf", new Uint8Array())).toEqual({ ok: false, error: "That file is empty." });
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set([0x25, 0x50, 0x44, 0x46]);
    expect(checkUpload("big.pdf", big)).toEqual({ ok: false, error: "That file is over 10 MB." });
  });

  it("makes the file name safe to store", () => {
    const res = checkUpload("../../etc/<evil>.pdf", PDF);
    expect(res.ok && res.safeName).toBe(".._.._etc__evil_.pdf");
  });
});
