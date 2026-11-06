import { describe, expect, it } from "vitest";
import { cleanRename, keepTaskFiles, renameInPath } from "@/lib/file-names";

describe("cleanRename", () => {
  it("keeps the original extension", () => {
    expect(cleanRename("Theory task week 1", "upload_3.pdf")).toBe("Theory task week 1.pdf");
    expect(cleanRename("Theory task.pdf", "upload_3.pdf")).toBe("Theory task.pdf");
    expect(cleanRename("Theory task.PDF", "upload_3.pdf")).toBe("Theory task.pdf");
  });

  it("can't change the file type", () => {
    expect(cleanRename("evil.exe", "a.pdf")).toBe("evil.exe.pdf");
    expect(cleanRename("notes.docx", "a.pdf")).toBe("notes.docx.pdf");
  });

  it("replaces unsafe characters and leading dots", () => {
    expect(cleanRename("../../etc/passwd", "a.pdf")).toBe("_.._etc_passwd.pdf");
    expect(cleanRename("Week 1: <intro>", "a.pdf")).toBe("Week 1_ _intro_.pdf");
  });

  it("keeps the old name when the new one is blank", () => {
    expect(cleanRename("   ", "a.pdf")).toBe("a.pdf");
    expect(cleanRename(".pdf", "a.pdf")).toBe("a.pdf");
    expect(cleanRename(undefined, "a.pdf")).toBe("a.pdf");
  });

  it("stays within 120 characters, extension included", () => {
    const name = cleanRename("x".repeat(500), "a.docx");
    expect(name.length).toBe(120);
    expect(name.endsWith(".docx")).toBe(true);
  });
});

describe("keepTaskFiles", () => {
  const oldTheory = { id: "a".repeat(24), name: "Theory.pdf", size: 100 };
  const oldWork = { id: "b".repeat(24), name: "Workplace.pdf", size: 200 };
  const fresh = { id: "c".repeat(24), name: "New.pdf", size: 300 };

  // The bug: an Admin uploaded one Theory document and saved; every file Super Admin had uploaded was thrown away.
  it("keeps files already on the assessment, whoever uploaded them", () => {
    const { files } = keepTaskFiles([oldTheory, fresh], [oldTheory, oldWork], [fresh]);
    expect(files.map((f) => f.id)).toEqual([oldTheory.id, fresh.id]);
  });

  it("drops ids that are neither already attached nor just uploaded by this person", () => {
    const stranger = { id: "d".repeat(24), name: "x.pdf", size: 1 };
    const { files } = keepTaskFiles([stranger, oldTheory], [oldTheory], []);
    expect(files).toEqual([oldTheory]);
  });

  it("takes sizes from storage, not the browser", () => {
    const { files } = keepTaskFiles([{ ...oldTheory, size: 999999 }], [oldTheory], []);
    expect(files[0].size).toBe(100);
  });

  it("treats a changed name as a rename, extension kept", () => {
    const { files, renames } = keepTaskFiles([{ ...oldTheory, name: "Theory Task – Week 1" }], [oldTheory], []);
    expect(files[0].name).toBe("Theory Task _ Week 1.pdf");
    expect(renames).toEqual([{ id: oldTheory.id, name: "Theory Task _ Week 1.pdf" }]);
  });

  it("ignores duplicates", () => {
    const { files } = keepTaskFiles([oldTheory, oldTheory], [oldTheory], []);
    expect(files).toHaveLength(1);
  });
});

describe("renameInPath", () => {
  it("renames only the file, keeping its folder", () => {
    expect(renameInPath("Week 1/Notes.pdf", "Reading notes")).toBe("Week 1/Reading notes.pdf");
    expect(renameInPath("Notes.pdf", "Reading notes")).toBe("Reading notes.pdf");
  });
});
