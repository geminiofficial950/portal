"use client";

import { useId, useState } from "react";

const PREVIEW_LENGTH = 220;
const PREVIEW_LINES = 3;

export default function CourseDescription({ text, className = "" }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const description = text.trim().replace(/\r\n/g, "\n");
  const characters = Array.from(description.split("\n", PREVIEW_LINES).join("\n"));
  const excerpt = characters.slice(0, PREVIEW_LENGTH).join("").trimEnd();
  const canExpand = excerpt !== description;

  if (!description) return null;

  return (
    <div className={className}>
      <p id={id} className={`whitespace-pre-wrap [overflow-wrap:anywhere] leading-relaxed text-ink ${canExpand && !expanded ? "line-clamp-3" : ""}`}>
        {canExpand && !expanded ? excerpt + "?" : description}
      </p>
      {canExpand && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
          className="mt-2 rounded-full border border-[var(--s-line)] bg-[var(--s-soft)] px-3 py-1 text-sm font-semibold text-ink transition hover:bg-[var(--s-icon)]"
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}
