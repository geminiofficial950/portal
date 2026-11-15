import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

import { EDGE, GOLD, GOLD_TEXT, INK, LILAC, plain, PLUM, readUpload, WHITE, wrap } from "./declaration-pdf";
import { formatStamp } from "./format";
import { legacyResponses, type Module } from "./module-meta";
import { statusLabel, type SubmissionDTO } from "./submission-meta";

// A student's online answers for one module (a quiz and other online activities) as a PDF, for Super Admin, Admins
// and trainers — the same as the staff view of the work (ModuleSubmission): each question, the student's answer
// and, for multiple choice, the reference answer admin ticked (a guide, nothing is scored). A4, carries on over
// as many pages as it needs, in the declaration certificate's style.

const GREEN = rgb(0, 0.478, 0.333); // #007a55
const AMBER = rgb(0.6, 0.35, 0.02); // #995905
type Color = typeof INK;

const W = 595;
const H = 842;
const M = 44;
const RIGHT = W - M;
const FOOTER_TOP = H - 58;
const LEAD = 13.5;

// Wraps text that may have line breaks, and breaks a word too long for the line (a pasted link) into pieces
function lines(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  for (const para of String(text).split(/\r?\n/)) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    for (const line of wrap(para, font, size, width)) {
      if (font.widthOfTextAtSize(line, size) <= width) {
        out.push(line);
        continue;
      }
      let piece = "";
      for (const ch of line) {
        if (font.widthOfTextAtSize(piece + ch, size) > width && piece) {
          out.push(piece);
          piece = ch;
        } else piece += ch;
      }
      if (piece) out.push(piece);
    }
  }
  return out;
}

const letter = (i: number) => String.fromCharCode(65 + i);

export async function buildAnswersPdf(
  sub: SubmissionDTO,
  module: Module,
  info: { studentName: string; courseName: string; college: { name: string; rto: string; email: string; phone: string } },
) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${module.title} answers - ${info.studentName} - ${sub.unitCode}`);
  pdf.setAuthor(info.college.name || "Stella College");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const responses = legacyResponses(module.activities, sub.content);

  const y = (top: number) => H - top;
  let page: PDFPage;
  const pages: PDFPage[] = [];
  const write = (s: string, x: number, top: number, size: number, font: PDFFont, color: Color = INK) =>
    page.drawText(plain(s), { x, y: y(top), size, font, color });
  const writeRight = (s: string, right: number, top: number, size: number, font: PDFFont, color: Color = INK) =>
    write(s, right - font.widthOfTextAtSize(plain(s), size), top, size, font, color);
  const rect = (x: number, top: number, w: number, h: number, opts: { fill?: Color; border?: Color; bw?: number }) =>
    page.drawRectangle({ x, y: y(top + h), width: w, height: h, color: opts.fill, borderColor: opts.border, borderWidth: opts.border ? (opts.bw ?? 1) : 0 });

  // Each page: the frame, then (once every page exists) "Student - unit - Page n of N" in the footer
  const newPage = () => {
    page = pdf.addPage([W, H]);
    pages.push(page);
    rect(16, 16, W - 32, H - 32, { border: PLUM, bw: 2 });
    rect(22, 22, W - 44, H - 44, { border: GOLD, bw: 0.7 });
    rect(22, 22, W - 44, 5, { fill: PLUM });
    page.drawLine({ start: { x: M, y: y(FOOTER_TOP + 8) }, end: { x: RIGHT, y: y(FOOTER_TOP + 8) }, thickness: 0.6, color: EDGE });
  };
  newPage();

  // Header: logo + college | title
  const logo = await pdf.embedPng(new Uint8Array(await readFile(path.join(process.cwd(), "public", "stella-logo.png"))));
  const logoH = 46;
  const logoW = (logo.width / logo.height) * logoH;
  page!.drawImage(logo, { x: M, y: y(42 + logoH), width: logoW, height: logoH });
  const divX = M + logoW + 12;
  page!.drawLine({ start: { x: divX, y: y(46) }, end: { x: divX, y: y(84) }, thickness: 1.5, color: GOLD });
  write(plain(info.college.name || "Stella College"), divX + 12, 62, 13, bold);
  if (info.college.rto) write(`RTO ${info.college.rto}`, divX + 12, 77, 9.5, regular);
  writeRight("STUDENT ANSWERS", RIGHT, 54, 8, bold, GOLD_TEXT);
  const titleSize = bold.widthOfTextAtSize(plain(module.title), 17) > RIGHT - divX - 190 ? 13 : 17;
  writeRight(module.title, RIGHT, 74, titleSize, bold, PLUM);
  writeRight(`Attempt ${sub.attempt} - ${statusLabel[sub.status]}`, RIGHT, 89, 9, regular);
  page!.drawLine({ start: { x: M, y: y(102) }, end: { x: RIGHT, y: y(102) }, thickness: 0.8, color: GOLD });

  // Details panel
  const top0 = 116;
  const panelW = RIGHT - M;
  const colW = (panelW - 36) / 2;
  const colX = (c: number) => M + 14 + c * (colW + 8);
  const rows: [string, string, number][][] = [
    [["Student", info.studentName, 1], ["Student ID", sub.studentId, 1]],
    [["Course code", sub.courseCode, 1], ["Unit code", sub.unitCode, 1]],
    [["Course name", info.courseName, 2]],
    [["Unit name", sub.unitTitle, 2]],
    [
      ["Module", module.title, 1],
      ["Date and time of submission", sub.submittedAt ? formatStamp(new Date(sub.submittedAt)) : "-", 1],
    ],
  ];
  const laidOut = rows.map((row) => {
    let c = 0;
    const cells = row.map(([label, value, span]) => {
      const cell = { label, lines: wrap(value, bold, 10.5, colW * span + 8 * (span - 1) - 4), x: colX(c) };
      c += span;
      return cell;
    });
    return { cells, height: 13 + Math.max(...cells.map((cl) => cl.lines.length)) * 12.5 + 9 };
  });
  const panelH = 12 + laidOut.reduce((n, r) => n + r.height, 0);
  rect(M, top0, panelW, panelH, { fill: LILAC, border: EDGE, bw: 0.8 });
  let rowTop = top0 + 12;
  for (const r of laidOut) {
    for (const cell of r.cells) {
      write(cell.label.toUpperCase(), cell.x, rowTop + 6, 7, bold, PLUM);
      cell.lines.forEach((l, i) => write(l, cell.x, rowTop + 20 + i * 12.5, 10.5, bold));
    }
    rowTop += r.height;
  }

  // Questions, one after another; a new page when the next piece doesn't fit
  let t = top0 + panelH + 30;
  const room = (h: number) => {
    if (t + h <= FOOTER_TOP) return;
    newPage();
    t = 48;
    write(`${module.title} (continued)`, M, t, 12, bold, PLUM);
    t += 24;
  };
  const textX = M + 18;
  const textW = RIGHT - textX;
  // A block of answer text in a white box with a lilac edge (split over pages if long)
  const answerBox = (text: string, color: Color = INK) => {
    const ls = lines(text, regular, 10, textW - 16);
    for (let i = 0; i < ls.length; ) {
      room(LEAD + 12);
      const fit = Math.max(1, Math.min(ls.length - i, Math.floor((FOOTER_TOP - t - 12) / LEAD)));
      const h = fit * LEAD + 10;
      rect(textX, t, textW, h, { fill: WHITE, border: EDGE, bw: 0.8 });
      ls.slice(i, i + fit).forEach((l, j) => write(l, textX + 8, t + 14 + j * LEAD, 10, regular, color));
      t += h + 6;
      i += fit;
    }
  };

  write("Answers", M, t, 14, bold, PLUM);
  t += 22;
  if (!module.activities.length) {
    write("This module has no online questions.", M, t, 10, regular);
  }

  for (const [n, a] of module.activities.entries()) {
    const v = responses[a.id];
    const prompt = lines(`${n + 1}. ${a.prompt}`, bold, 10.5, RIGHT - M);
    room(prompt.length * LEAD + LEAD + 8);
    prompt.forEach((l) => {
      room(LEAD);
      write(l, M, t, 10.5, bold);
      t += LEAD;
    });
    t += 4;

    if (a.type === "mcq") {
      a.options.forEach((o, k) => {
        const picked = v === k;
        const tag = [picked ? "Student's answer" : "", a.answer === k ? "Reference" : ""].filter(Boolean).join(" - ");
        const tagW = tag ? bold.widthOfTextAtSize(tag, 8) + 12 : 0;
        const ls = lines(`${letter(k)}. ${o}`, picked ? bold : regular, 10, textW - 16 - tagW);
        const h = ls.length * LEAD + 8;
        room(h + 4);
        rect(textX, t, textW, h, { fill: picked ? PLUM : WHITE, border: picked ? PLUM : EDGE, bw: 0.8 });
        ls.forEach((l, j) => write(l, textX + 8, t + 13 + j * LEAD, 10, picked ? bold : regular, picked ? WHITE : INK));
        if (tag) writeRight(tag, RIGHT - 8, t + 13, 8, bold, picked ? WHITE : GREEN);
        t += h + 4;
      });
      if (typeof v !== "number") {
        room(LEAD);
        write("Not answered", textX, t + 10, 10, bold, AMBER);
        t += LEAD + 4;
      }
    } else if (a.type === "matching") {
      a.pairs.forEach((p, k) => {
        const pick = Array.isArray(v) ? v[k] : "";
        const note = pick === p.right ? "matches the pair set by admin" : `pair set by admin: ${p.right}`;
        const leftW = (textW - 24) * 0.38;
        const rightW = (textW - 24) * 0.62;
        const left = lines(p.left, bold, 10, leftW);
        const answer = lines(pick || "Not answered", regular, 10, rightW);
        const noteLines = lines(note, regular, 8, rightW);
        const h = Math.max(left.length, answer.length + noteLines.length) * LEAD + 8;
        room(h + 4);
        rect(textX, t, textW, h, { fill: WHITE, border: EDGE, bw: 0.8 });
        const rx = textX + 16 + leftW;
        left.forEach((l, j) => write(l, textX + 8, t + 13 + j * LEAD, 10, bold));
        answer.forEach((l, j) => write(l, rx, t + 13 + j * LEAD, 10, regular, pick ? INK : AMBER));
        noteLines.forEach((l, j) => write(l, rx, t + 13 + (answer.length + j) * LEAD, 8, regular, pick === p.right ? GREEN : AMBER));
        t += h + 4;
      });
    } else {
      // short answer, or an image question (the picture, then the answer)
      if (a.type === "image" && a.image) {
        const img = await readUpload(a.image.id).catch(() => null);
        if (img && /png|jpe?g/i.test(img.type)) {
          const pic = /png/i.test(img.type) ? await pdf.embedPng(img.bytes) : await pdf.embedJpg(img.bytes);
          const scale = Math.min(textW / pic.width, 170 / pic.height, 1);
          const dh = pic.height * scale;
          room(dh + 8);
          page!.drawImage(pic, { x: textX, y: y(t + dh), width: pic.width * scale, height: dh });
          t += dh + 8;
        }
      }
      if (typeof v === "string" && v.trim()) answerBox(v);
      else answerBox("Not answered", AMBER);
    }
    t += 12;
  }

  // Footer on every page
  pages.forEach((p, i) => {
    page = p;
    write(`${info.studentName} (${sub.studentId}) - ${sub.unitCode}`, M, FOOTER_TOP + 26, 8.5, regular);
    writeRight(`Page ${i + 1} of ${pages.length}`, RIGHT, FOOTER_TOP + 26, 8.5, bold, PLUM);
  });

  return pdf.save();
}
