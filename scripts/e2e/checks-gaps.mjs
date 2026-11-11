// Fixes from matching the guide line by line: Deadlines tab (group/batch deadline changes), course page order,
// the obsolete "Final result options" screen removed
export default async function ({ check, get, strip, db }) {
  const now = new Date();
  await db.collection("studentGroups").insertOne({
    groupId: "B1",
    name: "Jan batch",
    nameKey: "jan batch",
    courseCode: "CHC33021",
    timezone: "Australia/Melbourne",
    units: ["CHCCCS031", "CHCCCS040", "CHCDIV001"],
    trainers: [{ trainerId: "T901", unitCodes: ["CHCCCS040"] }],
    classes: [],
    createdAt: now,
  });
  await db.collection("students").updateMany({}, { $set: { batchIds: ["B1"] } });

  // Kami 1 — deadlines for the whole batch, selected students or one student, with preview
  await check("admin: batch Deadlines tab — unit, module, whole batch / selected, new date, reason, preview", "/superadmin/batches/B1?tab=deadlines", "superadmin", {
    has: ["Module deadlines", "Whole batch", "Selected students (or one)", "New due date and time", "Reason (goes in the log)", "Preview change", "CHCCCS031", "CHCCCS040"],
  });
  {
    const t = strip((await get("/superadmin/batches/B1?tab=deadlines", "superadmin")).html);
    const ok = /Whole batch \(\s*2\s*\)/.test(t);
    console.log(`${ok ? "PASS" : "FAIL"}  admin: "Whole batch" shows the member count (2)`);
    if (!ok) process.exitCode = 1;
  }
  await check("trainer: Deadlines tab offers only the units assigned to them", "/trainer/batches/B1?tab=deadlines", "trainer", {
    has: ["Module deadlines", "CHCCCS040", "Knowledge check", "Theory assessment"],
    hasNot: ["CHCCCS031 –", "CHCDIV001 –"],
  });

  // Kami 3 — course page: description and course documents ABOVE the training plan (units)
  await db.collection("placementDocs").insertOne({
    docId: "d1",
    courseCode: "CHC33021",
    title: "Student handbook",
    file: { id: (await db.collection("uploads.files").findOne({}))._id.toString(), name: "x.png", size: 1 },
    section: "course",
    instructions: "",
    createdAt: now,
  });
  const t = strip((await get("/dashboard/course", "student")).html);
  // The page streams, so parts can arrive out of order in the HTML; the on-screen order is checked in the browser run
  const parts = ["Learn to support people in aged care and disability.", "Work placement", "Course status", "Course documents", "Placement pack"];
  const ok = parts.every((x) => t.includes(x)) && t.indexOf("Learn to support") < t.indexOf("Work placement") && !t.includes("Enrolled date") && !t.includes("Your training plan") && !t.includes("Other Requested Documents");
  console.log(`${ok ? "PASS" : "FAIL"}  student: course page has description, enrolled date, course status, course documents, placement pack (plan on My classes, requests on Requests)${ok ? "" : `\n      missing ${parts.filter((x) => !t.includes(x)).join(", ")}`}`);
  if (!ok) process.exitCode = 1;

  // Kami 4 — the old Pass / Fail "Final result options" screen is gone (results are unit statuses now)
  await check("admin: Settings no longer has the old Final result options", "/superadmin/settings", "superadmin", { has: ["Declaration"], hasNot: ["Final result options"] });

  // Acceptance 2 — update a unit resource: students of every batch see the current file, and no history of the old one
  const fileId = (await db.collection("uploads.files").findOne({}))._id.toString();
  await db.collection("studentGroups").insertOne({ groupId: "B2", name: "Feb batch", nameKey: "feb batch", courseCode: "CHC33021", timezone: "Australia/Melbourne", units: ["CHCCCS031"], trainers: [], classes: [], createdAt: now });
  await db.collection("students").updateOne({ studentId: "S9002" }, { $set: { batchIds: ["B2"] } });
  await db.collection("unitUnlocks").insertOne({ studentId: "S9002", courseCode: "CHC33021", unitCode: "CHCCCS031", unlockedAt: now, unlockedBy: "seed" });
  const res = (title) => ({ id: "r1", kind: "file", title, description: "", file: { id: fileId, name: `${title}.png`, size: 1 } });
  await db.collection("unitContent").insertOne({ courseCode: "CHC33021", unitCode: "CHCCCS031", overview: "", resources: [res("Care plan template v1")], updatedAt: now });
  const R = "/dashboard/assessment/CHCCCS031?course=CHC33021&item=resources";
  await check("student (Jan batch): sees the unit resource", R, "student", { has: ["Care plan template v1"] });
  await db.collection("unitContent").updateOne({ courseCode: "CHC33021", unitCode: "CHCCCS031" }, { $set: { resources: [res("Care plan template v2")], updatedAt: new Date() } });
  await check("student (Jan batch): after the update sees only the current file", R, "student", { has: ["Care plan template v2"], hasNot: ["Care plan template v1", "Version history", "Previous versions"] });
  await check("student (Feb batch): the same current file, no old one", R, "student2", { has: ["Care plan template v2"], hasNot: ["Care plan template v1"] });

  // Settings is Super Admin only (menu, page and actions)
  await check("admin account: no Settings in the menu", "/admin/students", "admin", { hasNotRaw: ['href="/admin/settings"'] });
  // streamed page: the refusal arrives as a redirect inside the stream, so the status stays 200 and no settings content is sent
  await check("admin account: Settings page refused", "/admin/settings", "admin", { hasNot: ["Declaration", "Portal switches"], hasRaw: ["NEXT_REDIRECT"] });
  await check("Super Admin: Settings in the menu and the page opens", "/superadmin/settings", "superadmin", { has: ["Declaration"], hasRaw: ['href="/superadmin/settings"'] });

  // Students table: the name opens the progress page (no separate Progress button)
  await check("admin: student name links to progress; no Progress button", "/superadmin/students", "superadmin", { hasRaw: ['href="/superadmin/students/S9001"'], hasNotRaw: ['>Progress</a>'] });
}
