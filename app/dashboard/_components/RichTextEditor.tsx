"use client";

import { useEffect, useRef, useState } from "react";
import { countWords } from "@/lib/submission-meta";

// Word-style editor: contentEditable + the browser's built-in formatting commands.
// The HTML it produces is sanitised on the server before it's stored.
const TOOLS = [
  { cmd: "bold", label: "B", title: "Bold (Ctrl+B)", className: "font-bold" },
  { cmd: "italic", label: "I", title: "Italic (Ctrl+I)", className: "italic" },
  { cmd: "underline", label: "U", title: "Underline (Ctrl+U)", className: "underline" },
  { cmd: "formatBlock", arg: "h2", label: "H", title: "Heading", className: "font-semibold" },
  { cmd: "formatBlock", arg: "p", label: "¶", title: "Normal text", className: "" },
  { cmd: "insertUnorderedList", label: "• List", title: "Bullet list", className: "" },
  { cmd: "insertOrderedList", label: "1. List", title: "Numbered list", className: "" },
  { cmd: "undo", label: "↶", title: "Undo (Ctrl+Z)", className: "" },
  { cmd: "redo", label: "↷", title: "Redo (Ctrl+Y)", className: "" },
] as const;

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  label,
  wordLimit,
  minHeight = "12rem",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  label: string;
  wordLimit?: number | null;
  minHeight?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [words, setWords] = useState(() => countWords(value));

  // Uncontrolled after mount so the caret doesn't jump; only reset when the value is replaced from outside
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) {
      el.innerHTML = value;
      setWords(countWords(value));
    }
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    // An editor the user cleared still holds "<br>" — treat it as empty so the placeholder shows
    const html = el.innerText.trim() === "" && !el.querySelector("li") ? "" : el.innerHTML;
    if (html === "") el.innerHTML = "";
    setWords(countWords(html));
    onChange(html);
  };

  const run = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };

  const over = !!wordLimit && words > wordLimit;

  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-ink/10 focus-within:ring-plum/40">
      <div className="flex flex-wrap gap-1 border-b border-ink/5 bg-[#faf9fd] px-2 py-1.5" role="toolbar" aria-label={`${label} formatting`}>
        {TOOLS.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            aria-label={t.title}
            // mousedown keeps the text selection inside the editor
            onMouseDown={(e) => {
              e.preventDefault();
              run(t.cmd, "arg" in t ? `<${t.arg}>` : undefined);
            }}
            className={`min-w-8 rounded-md px-2 py-1 text-xs text-ink/70 transition hover:bg-lilac hover:text-plum ${t.className}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        data-placeholder={placeholder}
        onInput={emit}
        className="rich-text px-4 py-3 text-sm leading-relaxed text-ink outline-none"
        style={{ minHeight }}
      />
      <div className={`flex justify-end border-t border-ink/5 px-4 py-1.5 text-[11px] ${over ? "text-rose-600" : "text-ink/40"}`}>
        {words} word{words === 1 ? "" : "s"}
        {wordLimit ? ` / ${wordLimit} limit` : ""}
      </div>
    </div>
  );
}
