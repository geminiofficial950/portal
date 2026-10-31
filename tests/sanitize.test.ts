import { describe, expect, it } from "vitest";
import { cleanEditorHtml } from "@/lib/sanitize";

describe("cleanEditorHtml — student / admin editor HTML", () => {
  it("keeps the editor's own formatting", () => {
    const html = "<h2>Intro</h2><p><b>Bold</b> <i>it</i> <u>u</u></p><ul><li>one</li></ul><ol><li>two</li></ol>";
    expect(cleanEditorHtml(html)).toBe(html);
  });

  it("removes scripts, event handlers and styles", () => {
    expect(cleanEditorHtml('<p onclick="steal()">Hi<script>alert(1)</script></p>')).toBe("<p>Hi</p>");
    expect(cleanEditorHtml('<img src=x onerror="alert(1)"><p style="color:red">x</p>')).toBe("<p>x</p>");
  });

  it("removes links and iframes but keeps their text", () => {
    expect(cleanEditorHtml('<a href="javascript:alert(1)">click</a>')).toBe("click");
    expect(cleanEditorHtml('<iframe src="https://evil.example"></iframe>ok')).toBe("ok");
  });

  it("strips messy markup pasted from Word", () => {
    expect(cleanEditorHtml('<p class="MsoNormal"><span style="font-family:Calibri">Answer</span></p>')).toBe("<p>Answer</p>");
  });

  it("drops trailing empty lines and handles empty input", () => {
    expect(cleanEditorHtml("<p>Text</p><div><br></div><p> </p>")).toBe("<p>Text</p>");
    expect(cleanEditorHtml(undefined)).toBe("");
    expect(cleanEditorHtml(null)).toBe("");
  });

  it("caps the length", () => {
    expect(cleanEditorHtml("a".repeat(500), 100)).toHaveLength(100);
  });
});
