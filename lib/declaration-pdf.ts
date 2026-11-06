import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

import { agreedDeclaration, declarationRef, declarationTitle } from "./declaration";
import { getUpload } from "./files";
import { formatStamp } from "./format";
import type { SubmissionDTO } from "./submission-meta";

// The declaration certificate as a downloadable PDF (A4 portrait), in the same style as the certificate page
// (app/declaration/[id]/page.tsx). A long declaration carries on to a second page rather than squeezing.

const PLUM = rgb(0.357, 0.247, 0.6); // #5b3f99
const GOLD = rgb(0.722, 0.576, 0.247); // #b8933f
const GOLD_TEXT = rgb(0.541, 0.416, 0.122); // #8a6a1f
const INK = rgb(0.114, 0.106, 0.2); // #1d1b33
const LILAC = rgb(0.965, 0.957, 0.988); // #f6f4fc
const EDGE = rgb(0.886, 0.863, 0.949); // #e2dcf2
const WHITE = rgb(1, 1, 1);
type Color = typeof INK;

const W = 595;
const H = 842;
const M = 44; // content margin inside the frame
const RIGHT = W - M;
const FOOTER_TOP = H - 58; // content stops above this line

// Standard PDF fonts only cover basic Latin: swap smart quotes/dashes, drop anything else
const plain = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/•/g, "-").replace(/[^\x20-\x7e]/g, "");

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of plain(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function readUpload(id: string) {
  const file = await getUpload(id);
  if (!file) return null;
  const chunks: Buffer[] = [];
  for await (const c of file.open()) chunks.push(c as Buffer);
  // a fresh Uint8Array: Node buffers can sit at an offset inside a shared pool, which pdf-lib would misread
  return { bytes: new Uint8Array(Buffer.concat(chunks)), type: file.contentType };
}

export async function buildDeclarationPdf(
  sub: SubmissionDTO,
  info: {
    studentName: string;
    courseName: string;
    withPhoto: boolean;
    moduleTitle: string;
    college: { name: string; rto: string; email: string; phone: string };
  },
) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${declarationTitle(sub.part, info.moduleTitle)} - ${info.studentName} - ${sub.unitCode}`);
  pdf.setAuthor(info.college.name || "Stella College");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const collegeName = plain(info.college.name || "Stella College");
  const text = agreedDeclaration(sub.content.declaration);

  // Everything is placed by distance from the top of the page
  const y = (top: number) => H - top;
  let page: PDFPage;
  const write = (s: string, x: number, top: number, size: number, font: PDFFont, color: Color = INK) =>
    page.drawText(plain(s), { x, y: y(top), size, font, color });
  const writeRight = (s: string, right: number, top: number, size: number, font: PDFFont, color: Color = INK) =>
    write(s, right - font.widthOfTextAtSize(plain(s), size), top, size, font, color);
  const rect = (x: number, top: number, w: number, h: number, opts: { fill?: Color; border?: Color; bw?: number }) =>
    page.drawRectangle({ x, y: y(top + h), width: w, height: h, color: opts.fill, borderColor: opts.border, borderWidth: opts.border ? (opts.bw ?? 1) : 0 });
  // A ticked plum box, 11pt square, top-left at (x, top)
  const tick = (x: number, top: number) => {
    rect(x, top, 11, 11, { fill: PLUM });
    page.drawLine({ start: { x: x + 2.5, y: y(top + 5.8) }, end: { x: x + 5, y: y(top + 8.3) }, thickness: 1.4, color: WHITE });
    page.drawLine({ start: { x: x + 5, y: y(top + 8.3) }, end: { x: x + 8.8, y: y(top + 2.6) }, thickness: 1.4, color: WHITE });
  };

  // Each page: frame (plum border, fine gold inner line, plum band) and the college contact footer
  const newPage = () => {
    page = pdf.addPage([W, H]);
    rect(16, 16, W - 32, H - 32, { border: PLUM, bw: 2 });
    rect(22, 22, W - 44, H - 44, { border: GOLD, bw: 0.7 });
    rect(22, 22, W - 44, 5, { fill: PLUM });
    page.drawLine({ start: { x: M, y: y(FOOTER_TOP + 8) }, end: { x: RIGHT, y: y(FOOTER_TOP + 8) }, thickness: 0.6, color: EDGE });
    const parts = (
      [
        ["Email", info.college.email],
        ["Phone", info.college.phone],
      ] as const
    ).filter(([, v]) => v);
    const gap = 26;
    const partW = (l: string, v: string) => bold.widthOfTextAtSize(l, 8.5) + 5 + regular.widthOfTextAtSize(plain(v), 8.5);
    let fx = (W - (parts.reduce((n, [l, v]) => n + partW(l, v), 0) + gap * (parts.length - 1))) / 2;
    parts.forEach(([l, v], i) => {
      if (i) page.drawLine({ start: { x: fx - gap / 2, y: y(FOOTER_TOP + 18) }, end: { x: fx - gap / 2, y: y(FOOTER_TOP + 28) }, thickness: 0.8, color: GOLD });
      write(l, fx, FOOTER_TOP + 26, 8.5, bold, PLUM);
      write(v, fx + bold.widthOfTextAtSize(l, 8.5) + 5, FOOTER_TOP + 26, 8.5, regular);
      fx += partW(l, v) + gap;
    });
  };
  newPage();

  // Header: logo + college | title
  const logo = await pdf.embedPng(new Uint8Array(await readFile(path.join(process.cwd(), "public", "stella-logo.png"))));
  const logoH = 46;
  const logoW = (logo.width / logo.height) * logoH;
  page!.drawImage(logo, { x: M, y: y(42 + logoH), width: logoW, height: logoH });
  const divX = M + logoW + 12;
  page!.drawLine({ start: { x: divX, y: y(46) }, end: { x: divX, y: y(84) }, thickness: 1.5, color: GOLD });
  write(collegeName, divX + 12, 62, 13, bold);
  if (info.college.rto) write(`RTO ${info.college.rto}`, divX + 12, 77, 9.5, regular);
  writeRight("STUDENT DECLARATION", RIGHT, 54, 8, bold, GOLD_TEXT);
  writeRight(declarationTitle(sub.part, info.moduleTitle), RIGHT, 74, 17, bold, PLUM);
  writeRight(`Reference ${declarationRef(sub.submissionId)}`, RIGHT, 89, 9, regular);
  page!.drawLine({ start: { x: M, y: y(102) }, end: { x: RIGHT, y: y(102) }, thickness: 0.8, color: GOLD });

  // Details panel (left) beside the photo card (right)
  const top0 = 116;
  const photoCardW = 150;
  const panelW = RIGHT - M - photoCardW - 14;
  const colW = (panelW - 36) / 2;
  const colX = (c: number) => M + 14 + c * (colW + 8);
  const rows: [string, string, number][][] = [
    [["Student", info.studentName, 1], ["Student ID", sub.studentId, 1]],
    [["Course code", sub.courseCode, 1], ["Unit code", sub.unitCode, 1]],
    [["Course name", info.courseName, 2]],
    [["Unit name", sub.unitTitle, 2]],
    [
      ["Module", info.moduleTitle, 1],
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

  // Photo card, as tall as the details panel
  const cardX = RIGHT - photoCardW;
  rect(cardX, top0, photoCardW, panelH, { border: EDGE, bw: 0.8 });
  const inner = { x: cardX + 8, top: top0 + 8, w: photoCardW - 16, h: panelH - 38 };
  rect(inner.x, inner.top, inner.w, inner.h, { fill: LILAC });
  const photo = info.withPhoto && sub.photo ? await readUpload(sub.photo.id) : null;
  if (photo) {
    const img = /png/i.test(photo.type) ? await pdf.embedPng(photo.bytes) : await pdf.embedJpg(photo.bytes);
    const scale = Math.min(inner.w / img.width, inner.h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    page!.drawImage(img, { x: inner.x + (inner.w - dw) / 2, y: y(inner.top + (inner.h + dh) / 2), width: dw, height: dh });
  } else {
    const msg = sub.photo ? "Photo not included" : "No photo was taken";
    write(msg, inner.x + (inner.w - regular.widthOfTextAtSize(msg, 9)) / 2, inner.top + inner.h / 2 + 3, 9, regular);
  }
  const caption = "PHOTO TAKEN AT SUBMISSION";
  write(caption, cardX + (photoCardW - bold.widthOfTextAtSize(caption, 7)) / 2, top0 + panelH - 13, 7, bold, PLUM);

  // Declaration, full width: each point ticked, then the agreement. Moves to a new page when it runs out of room.
  let t = top0 + panelH + 30;
  const room = (h: number) => {
    if (t + h <= FOOTER_TOP) return;
    newPage();
    t = 48;
    write("Declaration (continued)", M, t, 12, bold, PLUM);
    t += 24;
  };
  const size = 10;
  const lead = 13.5;
  const textX = M + 20;
  const textW = RIGHT - textX;

  write("Declaration", M, t, 14, bold, PLUM);
  t += 22;
  for (const l of wrap(text.intro, bold, 10.5, RIGHT - M)) {
    room(lead);
    write(l, M, t, 10.5, bold);
    t += lead;
  }
  t += 6;
  for (const p of text.points) {
    const lines = wrap(p, regular, size, textW);
    room(lines.length * lead + 6);
    tick(M + 1, t - 9);
    lines.forEach((l, j) => write(l, textX, t + j * lead, size, regular));
    t += lines.length * lead + 6;
  }

  const agree = wrap(text.agree, bold, 10.5, RIGHT - M - 44);
  const boxH = agree.length * lead + 12;
  t += 6;
  room(boxH + 4);
  rect(M, t - 4, RIGHT - M, boxH, { fill: LILAC, border: PLUM, bw: 0.9 });
  tick(M + 12, t + 1.5);
  agree.forEach((l, i) => write(l, M + 32, t + 10.5 + i * lead, 10.5, bold));
  t += boxH + 10;

  // The student's signature (drawn or uploaded), on a signing line
  const signature = sub.content.declaration?.signature ? await readUpload(sub.content.declaration.signature.file.id) : null;
  if (signature) {
    const sigW = 170;
    const sigH = 52;
    room(sigH + 34);
    write("STUDENT SIGNATURE", M, t + 6, 7, bold, PLUM);
    const img = /png/i.test(signature.type) ? await pdf.embedPng(signature.bytes) : await pdf.embedJpg(signature.bytes);
    const scale = Math.min(sigW / img.width, sigH / img.height);
    page!.drawImage(img, { x: M, y: y(t + 12 + sigH), width: img.width * scale, height: img.height * scale });
    page!.drawLine({ start: { x: M, y: y(t + 14 + sigH) }, end: { x: M + sigW + 20, y: y(t + 14 + sigH) }, thickness: 0.8, color: INK });
    write(`${info.studentName} - ${sub.submittedAt ? formatStamp(new Date(sub.submittedAt)) : ""}`, M, t + 26 + sigH, 8.5, regular);
  }

  return pdf.save();
}
