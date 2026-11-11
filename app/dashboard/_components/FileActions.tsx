"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import BookViewer from "../assessment/_components/BookViewer";
import DocxViewer from "../assessment/_components/DocxViewer";
import type { FileRef } from "@/lib/submission-meta";

const isPdf = (f: FileRef) => /\.pdf$/i.test(f.name);
const isImage = (f: FileRef) => /\.(jpe?g|png)$/i.test(f.name);
const isDocx = (f: FileRef) => /\.docx$/i.test(f.name);
const isSlides = (f: FileRef) => /\.pptx?$/i.test(f.name);

const SIZES = {
  md: "rounded-xl px-5 py-2.5 text-sm",
  sm: "rounded-full px-3 py-1.5 text-xs",
} as const;

// Every document in the portal: View opens it right here — PDFs and pictures like a book (BookViewer, with zoom),
// Word (.docx) as pages (DocxViewer); Download saves it. PowerPoint and old .doc files can't be shown in a browser,
// so View says to download them.
export default function FileActions({
  file,
  title = file.name,
  size = "md",
  downloadLabel = "Download",
  view = true,
}: {
  file: FileRef;
  title?: string;
  size?: keyof typeof SIZES;
  downloadLabel?: string;
  view?: boolean; // false: only Download (e.g. the student's course documents and placement pack)
}) {
  const [open, setOpen] = useState(false);
  const viewable = isPdf(file) || isImage(file) || isDocx(file);
  const btn = `inline-flex items-center font-semibold transition ${SIZES[size]}`;
  return (
    <span className="flex shrink-0 gap-2">
      {view && (
        <button
          type="button"
          onClick={() =>
            viewable
              ? setOpen(true)
              : toast(
                  `This ${isSlides(file) ? "PowerPoint" : "older Word (.doc)"} file can’t open in the browser — use Download to open it on your device.`,
                )
          }
          className={`${btn} border border-plum/30 bg-lilac text-plum hover:bg-plum hover:text-white`}
        >
          View
        </button>
      )}
      <a href={`/api/files/${file.id}`} className={`${btn} bg-plum text-white hover:bg-plum-light`}>
        {downloadLabel}
      </a>
      {open &&
        (isDocx(file) ? (
          <DocxViewer file={file} title={title} onClose={() => setOpen(false)} />
        ) : (
          <BookViewer file={file} title={title} onClose={() => setOpen(false)} />
        ))}
    </span>
  );
}
