// Fill CHC33021 with demo Main unit / Resources / Assessment content, as the Super Admin would.
// Usage (from the project folder):
//   node --env-file=.env scripts/demo/seed-chc33021.mjs fill     → add content (refuses to overwrite anything)
//   node --env-file=.env scripts/demo/seed-chc33021.mjs remove   → delete all demo content + its PDF files
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { UNITS } from "./chc33021-content.mjs";

const require = createRequire(process.cwd() + "/package.json");
const { MongoClient, GridFSBucket, ObjectId } = require("mongodb");
const COURSE = "CHC33021";
const ADMIN = "superadmin"; // session id of the .env Super Admin (owner of uploaded resources)

const c = await new MongoClient(process.env.MONGODB_URI).connect();
const db = c.db(process.env.MONGODB_DB || undefined);
const bucket = new GridFSBucket(db, { bucketName: "uploads" });
const mode = process.argv[2];

// ---- tiny valid PDF (one page of Helvetica text) ----
const ascii = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/→/g, "->").replace(/[^\x20-\x7e]/g, "");
const esc = (s) => ascii(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
function wrap(text, width = 88) {
  const out = [];
  let line = "";
  for (const w of ascii(text).split(" ")) {
    if ((line + " " + w).trim().length > width) { out.push(line); line = w; } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  return out;
}
function makePdf(title, lines) {
  const body = [`BT /F1 16 Tf 50 790 Td (${esc(title)}) Tj ET`];
  let y = 760;
  for (const l of lines) {
    for (const part of wrap(l)) {
      body.push(`BT /F1 11 Tf 50 ${y} Td (${esc(part)}) Tj ET`);
      y -= 16;
    }
    y -= 6;
  }
  const stream = body.join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
async function upload(name, buf) {
  const s = bucket.openUploadStream(name, { metadata: { ownerId: ADMIN, contentType: "application/pdf", demo: true } });
  await new Promise((res, rej) => Readable.from(buf).pipe(s).on("finish", res).on("error", rej));
  return { id: s.id.toString(), name, size: buf.length };
}

const html = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

if (mode === "fill") {
  const course = await db.collection("courses").findOne({ code: COURSE });
  if (!course) throw new Error("CHC33021 not found");
  for (const col of ["unitContent", "assessments"]) {
    const n = await db.collection(col).countDocuments({ courseCode: COURSE });
    if (n) throw new Error(`${col} already has ${n} CHC33021 record(s) — not overwriting. Run "remove" first if they're demo data.`);
  }
  const missing = course.units.filter((u) => !UNITS[u.code]).map((u) => u.code);
  if (missing.length) throw new Error("no content written for: " + missing.join(", "));

  // Due 5 pm local time: first unit in 2 weeks, then one week apart
  const base = new Date();
  base.setHours(17, 0, 0, 0);
  let i = 0;
  for (const u of course.units) {
    const d = UNITS[u.code];
    const pdf = makePdf(`${u.code} - ${u.title}`, [
      `Unit fact sheet - ${COURSE} Certificate III in Individual Support`,
      `In this unit you learn ${d.about}.`,
      "What you will learn:",
      ...d.learn.map((l) => `- ${l}`),
      "Key points:",
      ...d.notes.map((n) => `- ${n}`),
      "Assessment: online quiz, theory questions, role play and a workplace task.",
    ]);
    const file = await upload(`${u.code}-fact-sheet.pdf`, pdf);

    await db.collection("unitContent").insertOne({
      courseCode: COURSE,
      unitCode: u.code,
      overview:
        `<h2>About this unit</h2><p>In ${html(u.code)} – ${html(u.title)} you will learn ${html(d.about)}.</p>` +
        `<h3>What you will learn</h3><ul>${d.learn.map((l) => `<li>${html(l)}</li>`).join("")}</ul>` +
        `<p>Start with the <b>Resources</b>, then complete all four parts of the <b>Assessment</b> before the due date.</p>`,
      resources: [
        { id: randomUUID(), kind: "link", title: `${u.code} on training.gov.au`, description: "Official unit details: elements, performance criteria and assessment requirements.", url: `https://training.gov.au/Training/Details/${u.code}` },
        { id: randomUUID(), kind: "note", title: "Key points to remember", description: "Read these before you start the quiz.", body: `<ul>${d.notes.map((n) => `<li>${html(n)}</li>`).join("")}</ul>` },
        { id: randomUUID(), kind: "file", title: "Unit fact sheet (PDF)", description: "A one-page summary you can download and keep.", file },
      ],
      updatedAt: new Date(),
      demo: true,
    });

    const due = new Date(base.getTime() + (14 + 7 * i) * 86400000);
    await db.collection("assessments").insertOne({
      courseCode: COURSE,
      unitCode: u.code,
      dueAt: due,
      quiz: { passMark: 75, questions: d.quiz.map((x) => ({ id: randomUUID(), ...x })) },
      theory: { questions: d.theory.map((x) => ({ id: randomUUID(), ...x })) },
      rolePlay: { ...d.rolePlay, criteria: d.rolePlay.criteria.map((text) => ({ id: randomUUID(), text })) },
      workplace: { task: d.workplace.task, evidence: d.workplace.evidence.map((text) => ({ id: randomUUID(), text })), supervisorSignOff: true },
      updatedAt: new Date(),
      demo: true,
    });
    console.log(`${u.code}  overview ✓  3 resources ✓  quiz ${d.quiz.length} · theory ${d.theory.length} · role play ✓ · workplace ✓  due ${due.toLocaleString("en-AU")}`);
    i++;
  }
  await db.collection("activity").insertOne({ who: "Super Admin", what: `added overview, resources and assessments for all ${course.units.length} units of ${COURSE}`, kind: "course", at: new Date(), demo: true });
  console.log("done");
}

if (mode === "remove") {
  const docs = await db.collection("unitContent").find({ courseCode: COURSE, demo: true }).toArray();
  const fileIds = docs.flatMap((d) => d.resources.filter((r) => r.kind === "file").map((r) => r.file.id));
  for (const id of fileIds) await bucket.delete(new ObjectId(id)).catch(() => {});
  console.log("removed", JSON.stringify({
    files: fileIds.length,
    unitContent: (await db.collection("unitContent").deleteMany({ courseCode: COURSE, demo: true })).deletedCount,
    assessments: (await db.collection("assessments").deleteMany({ courseCode: COURSE, demo: true })).deletedCount,
    activity: (await db.collection("activity").deleteMany({ demo: true })).deletedCount,
  }));
}
await c.close();
