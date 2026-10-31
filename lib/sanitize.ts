import "server-only";
import sanitizeHtml from "sanitize-html";

// The student editor only produces simple formatting; anything else (scripts, styles,
// pasted Word markup) is stripped before it is stored or shown to a trainer.
export function cleanEditorHtml(html: unknown, maxLength = 60000) {
  return sanitizeHtml(String(html ?? "").slice(0, maxLength * 2), {
    allowedTags: ["p", "div", "br", "b", "strong", "i", "em", "u", "h2", "h3", "ul", "ol", "li"],
    allowedAttributes: {},
  })
    .replace(/(<(p|div)>(\s|&nbsp;|<br\s*\/?>)*<\/\2>\s*)+$/g, "") // trailing empty lines
    .slice(0, maxLength)
    .trim();
}
