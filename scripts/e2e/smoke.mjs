// End-to-end smoke test: runs the BUILT app (npm run build first) against a throw-away in-memory MongoDB,
// seeds a course, students, trainers and units, then requests real pages as each role and checks what renders.
// It never touches the database in .env.   Run: node scripts/e2e/smoke.mjs [phase]
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { MongoClient, GridFSBucket } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 3931;
const SECRET = "e2e-secret-e2e-secret-e2e-secret-123456";
const DB = "stella_e2e";
const BASE = `http://localhost:${PORT}`;

// Never test against a server left over from an earlier run (it would talk to the wrong database)
try {
  await fetch(`http://localhost:${PORT}`);
  console.error(`Port ${PORT} is already in use — stop that server first.`);
  process.exit(2);
} catch {}

const mongo = await MongoMemoryServer.create();
const uri = mongo.getUri();
const client = await new MongoClient(uri).connect();
const db = client.db(DB);

// ---------- seed ----------
const now = new Date();
const later = new Date(Date.now() + 14 * 86400000).toISOString();
const pdf = await readFile(new URL("../../public/stella-logo.png", import.meta.url));
const bucket = new GridFSBucket(db, { bucketName: "uploads" });
const upload = (name, owner, bytes = pdf, contentType = "image/png") =>
  new Promise((resolve, reject) => {
    const s = bucket.openUploadStream(name, { metadata: { ownerId: owner, contentType } });
    s.end(bytes, (err) => (err ? reject(err) : resolve({ id: s.id.toString(), name, size: bytes.length })));
  });
const taskFile = await upload("Theory task.png", "superadmin");
const image = await upload("Body systems.png", "superadmin");

await db.collection("courses").insertOne({
  code: "CHC33021",
  name: "Certificate III in Individual Support",
  release: "Release 1",
  category: "Certificate III",
  duration: "12 months",
  description: "Learn to support people in aged care and disability.",
  units: [
    { code: "CHCCCS031", title: "Provide individualised support" },
    { code: "CHCCCS040", title: "Support independence and wellbeing" },
    { code: "CHCDIV001", title: "Work with diverse people" },
  ],
  placementHours: 120,
  placementText: "",
  createdAt: now,
});
const hash = await bcrypt.hash("password123", 4);
await db.collection("students").insertMany([
  { studentId: "S9001", name: "Alex Morgan", email: "alex@test.local", courses: ["CHC33021"], course: "CHC33021", status: "Active", progress: 0, batchIds: [], passwordHash: hash, createdAt: now },
  { studentId: "S9002", name: "Bea Lee", email: "bea@test.local", courses: ["CHC33021"], course: "CHC33021", status: "Active", progress: 0, batchIds: [], passwordHash: hash, createdAt: now },
]);
await db.collection("admins").insertOne({ adminId: "A901", name: "Ada Admin", email: "ada@test.local", active: true, passwordHash: hash, createdAt: now });
await db.collection("trainers").insertMany([
  { trainerId: "T901", name: "Sarah Wilson", email: "sarah@test.local", active: true, passwordHash: hash, createdAt: now },
  { trainerId: "T902", name: "Omar Khan", email: "omar@test.local", active: true, passwordHash: hash, createdAt: now },
]);
// Unit 1 is stored the OLD way (fixed parts); unit 2 uses flexible modules
await db.collection("assessments").insertMany([
  {
    courseCode: "CHC33021",
    unitCode: "CHCCCS031",
    dueAt: new Date(later),
    quiz: { passMark: 80, questions: [{ id: "q1", text: "Legacy question one?", options: ["Yes", "No"], answer: 0 }] },
    theory: { questions: [], files: [taskFile], uploads: [] },
    rolePlay: { scenario: "", instructions: "", criteria: [] },
    workplace: { task: "", evidence: [], supervisorSignOff: false, files: [], uploads: [] },
    updatedAt: now,
  },
  {
    courseCode: "CHC33021",
    unitCode: "CHCCCS040",
    modules: [
      { id: "m1", title: "Learning materials", kind: "learning", instructions: "Read chapter 2.", activities: [], files: [taskFile], upload: { enabled: false, slots: [] }, dueAt: null, archived: false },
      {
        id: "m2",
        title: "Knowledge check",
        kind: "activities",
        instructions: "Answer every question.",
        activities: [
          { id: "a1", type: "mcq", prompt: "Which is a body system?", options: ["Respiratory", "Telephone"], answer: 0 },
          { id: "a2", type: "short", prompt: "Explain person-centred care." },
          { id: "a3", type: "matching", prompt: "Match the terms", pairs: [{ left: "Heart", right: "Pumps blood" }, { left: "Lungs", right: "Exchange gases" }] },
          { id: "a4", type: "image", prompt: "Name the system shown.", image },
        ],
        files: [],
        upload: { enabled: false, slots: [] },
        dueAt: later,
        archived: false,
      },
      { id: "m3", title: "Theory assessment", kind: "task", instructions: "", activities: [], files: [taskFile], upload: { enabled: true, slots: [{ id: "s1", label: "Completed answers" }] }, dueAt: later, archived: false },
      { id: "m4", title: "Old removed module", kind: "task", instructions: "", activities: [], files: [], upload: { enabled: true, slots: [] }, dueAt: null, archived: true },
    ],
    updatedAt: now,
  },
]);
for (const unitCode of ["CHCCCS031", "CHCCCS040"]) {
  await db.collection("unitUnlocks").insertOne({ studentId: "S9001", courseCode: "CHC33021", unitCode, unlockedAt: now, unlockedBy: "seed" });
}
// A submission in the old Theory part (must still show) and one in the new activities module
await db.collection("submissions").insertMany([
  {
    submissionId: "sub-legacy",
    studentId: "S9001",
    studentName: "Alex Morgan",
    courseCode: "CHC33021",
    unitCode: "CHCCCS031",
    unitTitle: "Provide individualised support",
    part: "theory",
    status: "Submitted",
    attempt: 1,
    content: {},
    files: [taskFile],
    photo: null,
    criteriaMet: [],
    feedback: "",
    decidedBy: null,
    decidedAt: null,
    submittedAt: now,
    updatedAt: now,
    history: [],
  },
  {
    submissionId: "sub-mcq",
    studentId: "S9001",
    studentName: "Alex Morgan",
    courseCode: "CHC33021",
    unitCode: "CHCCCS040",
    unitTitle: "Support independence and wellbeing",
    part: "m2",
    status: "Submitted",
    attempt: 1,
    content: { responses: { a1: 0, a2: "Respect choices", a3: ["Pumps blood", "Exchange gases"], a4: "Skeletal" } },
    files: [],
    photo: null,
    criteriaMet: [],
    feedback: "",
    decidedBy: null,
    decidedAt: null,
    submittedAt: now,
    updatedAt: now,
    history: [],
  },
]);

// ---------- server ----------
const env = { ...process.env, MONGODB_URI: uri, MONGODB_DB: DB, SESSION_SECRET: SECRET, SUPERADMIN_ID: "e2e-admin", SUPERADMIN_PASSWORD: "e2e-password", PORT: String(PORT) };
const server = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "start", "-p", String(PORT)], { env, shell: process.platform === "win32" });
let log = "";
server.stdout.on("data", (d) => (log += d));
server.stderr.on("data", (d) => (log += d));
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}

const key = new TextEncoder().encode(SECRET);
const token = (payload) => new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(key);
const roles = {
  superadmin: await token({ sub: "superadmin", role: "admin", name: "Super Admin" }),
  admin: await token({ sub: "A901", role: "admin", name: "Ada Admin" }), // an Admin account (not Super Admin)
  student: await token({ sub: "S9001", role: "student", name: "Alex Morgan" }),
  student2: await token({ sub: "S9002", role: "student", name: "Bea Lee" }),
  trainer: await token({ sub: "T901", role: "trainer", name: "Sarah Wilson" }),
  trainer2: await token({ sub: "T902", role: "trainer", name: "Omar Khan" }),
};

const get = async (path, role) => {
  const res = await fetch(BASE + path, { headers: role ? { cookie: `stella_session=${roles[role]}` } : {}, redirect: "manual" });
  return { status: res.status, location: res.headers.get("location"), html: await res.text() };
};
const strip = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");

let failed = 0;
const check = async (name, path, role, { status = 200, has = [], hasNot = [], hasRaw = [], hasNotRaw = [] } = {}) => {
  const r = await get(path, role);
  const text = strip(r.html);
  const problems = [];
  if (r.status !== status) problems.push(`status ${r.status} (wanted ${status}${r.location ? `, → ${r.location}` : ""})`);
  for (const h of has) if (!text.includes(h)) problems.push(`missing “${h}”`);
  for (const h of hasNot) if (text.includes(h)) problems.push(`should not show “${h}”`);
  for (const h of hasRaw) if (!r.html.includes(h)) problems.push(`missing in HTML “${h}”`);
  for (const h of hasNotRaw) if (r.html.includes(h)) problems.push(`should not be in HTML “${h}”`);
  if (problems.length) failed++;
  console.log(`${problems.length ? "FAIL" : "PASS"}  ${name}${problems.length ? `\n      ${problems.join("\n      ")}` : ""}`);
};

const checks = (await import(`./checks-${process.argv[2] ?? "phase1"}.mjs`)).default;
try {
  await checks({ check, get, strip, db });
} finally {
  // stop the whole server process tree before exiting (synchronously, so nothing is left running)
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
  else server.kill();
  await client.close();
  await mongo.stop();
}
if (failed) {
  console.log(`\n${failed} check(s) failed. Server log tail:\n${log.slice(-3000)}`);
  process.exit(1);
}
console.log("\nAll smoke checks passed.");
process.exit(0);
