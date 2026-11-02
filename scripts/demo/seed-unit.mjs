// Sample units in the current format, as the Super Admin would set them up:
// overview · Quiz and Activities · Resources (Learner Guide, PowerPoint Presentation, Supporting Document)
// · Theory Task (PDF) · Workplacement Task (PDF). Everything is marked demo: true.
// Usage (from the project folder):
//   node --env-file=.env scripts/demo/seed-unit.mjs fill [UNIT…]     → add them (a unit already set up is skipped, never overwritten)
//   node --env-file=.env scripts/demo/seed-unit.mjs remove [UNIT…]   → delete them and their PDF files
// Without unit codes it uses the three sample units below.
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { UNITS } from "./chc33021-content.mjs";
import { makePdf } from "./pdf.mjs";

const require = createRequire(process.cwd() + "/package.json");
const { MongoClient, GridFSBucket, ObjectId } = require("mongodb");

const COURSE = "CHC33021";
// unit code → days until its due date
const SAMPLE = { CHCCOM005: 14, CHCCCS031: 21, CHCCCS040: 7 };
const ADMIN = "superadmin"; // session id of the .env Super Admin (owner of uploaded files)

const c = await new MongoClient(process.env.MONGODB_URI).connect();
const db = c.db(process.env.MONGODB_DB || undefined);
const bucket = new GridFSBucket(db, { bucketName: "uploads" });
const mode = process.argv[2];
const units = process.argv.slice(3).map((u) => u.toUpperCase());
const codes = units.length ? units : Object.keys(SAMPLE);

async function upload(name, buf) {
  const s = bucket.openUploadStream(name, { metadata: { ownerId: ADMIN, contentType: "application/pdf", demo: true } });
  await new Promise((res, rej) => Readable.from(buf).pipe(s).on("finish", res).on("error", rej));
  return { id: s.id.toString(), name, size: buf.length };
}
const html = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function fill(UNIT, dueDays) {
  const course = await db.collection("courses").findOne({ code: COURSE });
  const unit = course?.units.find((u) => u.code === UNIT);
  if (!unit) return console.log(`${UNIT}: not in ${COURSE} — skipped`);
  const d = UNITS[UNIT];
  if (!d) return console.log(`${UNIT}: no sample text for this unit — skipped`);
  for (const col of ["unitContent", "assessments"]) {
    if (await db.collection(col).countDocuments({ courseCode: COURSE, unitCode: UNIT })) {
      return console.log(`${UNIT}: already set up (${col}) — skipped, not overwriting`);
    }
  }
  const title = `${UNIT} - ${unit.title}`;

  const guide = await upload(`${UNIT} Learner Guide.pdf`, makePdf(`Learner Guide: ${title}`, [
    `In this unit you learn ${d.about}.`,
    "What you will learn:",
    ...d.learn.map((l) => `- ${l}`),
    "Key points:",
    ...d.notes.map((n) => `- ${n}`),
  ]));
  const slides = await upload(`${UNIT} Presentation.pdf`, makePdf(`Presentation: ${title}`, [
    "Slide 1 - What this unit is about",
    `We will learn ${d.about}.`,
    ...d.learn.map((l, i) => `Slide ${i + 2} - ${l}`),
    "(Sample file - replace it with the real PowerPoint from the Super Admin Resources tab.)",
  ]));
  const support = await upload(`${UNIT} Supporting Document.pdf`, makePdf(`Supporting Document: ${title}`, [
    "Use this alongside the Learner Guide.",
    ...d.notes.map((n) => `- ${n}`),
  ]));
  const theoryTask = await upload(`${UNIT} Theory Task.pdf`, makePdf(`Theory Task: ${title}`, [
    "Instructions: answer every question below. Print this task or copy it into Word, complete it,",
    "then upload your completed work in the portal (Theory Task -> Upload your completed work).",
    ...d.theory.map((q, i) => `Question ${i + 1}: ${q.text}`),
  ]));
  const workTask = await upload(`${UNIT} Workplacement Task.pdf`, makePdf(`Workplacement Task: ${title}`, [
    d.workplace.task,
    "Evidence to upload:",
    ...d.workplace.evidence.map((e) => `- ${e}`),
    "Upload your completed task and evidence in the portal (Workplacement Task -> Upload your completed work).",
  ]));

  const file = (f, slot, label) => ({ id: randomUUID(), kind: "file", title: label, description: "", file: f, slot });
  await db.collection("unitContent").insertOne({
    courseCode: COURSE,
    unitCode: UNIT,
    overview:
      `<h2>About this unit</h2><p>In ${html(UNIT)} – ${html(unit.title)} you will learn ${html(d.about)}.</p>` +
      `<h3>What you will learn</h3><ul>${d.learn.map((l) => `<li>${html(l)}</li>`).join("")}</ul>` +
      `<p>Do the <b>Quiz and Activities</b>, read the <b>Resources</b>, then complete the <b>Theory Task</b> and <b>Workplacement Task</b>.</p>`,
    resources: [
      file(guide, "learnerGuide", "Learner Guide"),
      file(slides, "presentation", "PowerPoint Presentation"),
      file(support, "supporting", "Supporting Document"),
    ],
    updatedAt: new Date(),
    demo: true,
  });

  const due = new Date(Date.now() + dueDays * 86400000);
  due.setHours(17, 0, 0, 0);
  await db.collection("assessments").insertOne({
    courseCode: COURSE,
    unitCode: UNIT,
    dueAt: due,
    quiz: { passMark: 75, questions: d.quiz.map((x) => ({ id: randomUUID(), ...x })) },
    theory: { questions: [], files: [theoryTask] },
    rolePlay: { scenario: "", instructions: "", criteria: [] },
    workplace: { task: "", evidence: [], supervisorSignOff: false, files: [workTask] },
    updatedAt: new Date(),
    demo: true,
  });
  console.log(`${UNIT}: overview ✓ · quiz ${d.quiz.length} questions ✓ · 3 resources ✓ · theory task PDF ✓ · workplacement task PDF ✓ · due ${due.toLocaleDateString("en-AU")}`);
}

async function remove(UNIT) {
  const content = await db.collection("unitContent").findOne({ courseCode: COURSE, unitCode: UNIT, demo: true });
  const assessment = await db.collection("assessments").findOne({ courseCode: COURSE, unitCode: UNIT, demo: true });
  const ids = [
    ...(content?.resources ?? []).flatMap((r) => (r.kind === "file" ? [r.file.id] : [])),
    ...(assessment?.theory?.files ?? []).map((f) => f.id),
    ...(assessment?.workplace?.files ?? []).map((f) => f.id),
  ];
  for (const id of ids) await bucket.delete(new ObjectId(id)).catch(() => {});
  await db.collection("unitContent").deleteOne({ courseCode: COURSE, unitCode: UNIT, demo: true });
  await db.collection("assessments").deleteOne({ courseCode: COURSE, unitCode: UNIT, demo: true });
  console.log(`removed ${UNIT} sample (${ids.length} files)`);
}

if (mode === "fill") for (const code of codes) await fill(code, SAMPLE[code] ?? 14);
if (mode === "remove") for (const code of codes) await remove(code);

if (mode !== "fill" && mode !== "remove") console.log("Usage: node --env-file=.env scripts/demo/seed-unit.mjs fill|remove [UNIT…]");
await c.close();
