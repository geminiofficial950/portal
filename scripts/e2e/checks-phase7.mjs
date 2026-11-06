// Phases 7–8 remaining items: transfer (7.1), course documents & requests (7.2–7.3), class sessions (7.4–7.5),
// student statuses (8.2), deletion (8.3), no-access state (8.4)
export default async function ({ check, get, db }) {
  const now = new Date();
  const day = 86400000;
  const upload = (await db.collection("uploads.files").findOne({ filename: "Theory task.png" }))._id.toString();
  const file = { id: upload, name: "Theory task.png", size: 100 };

  await db.collection("studentGroups").insertMany([
    {
      groupId: "B1",
      name: "Jan batch",
      nameKey: "jan batch",
      code: "IS-2027-01",
      courseCode: "CHC33021",
      timezone: "Australia/Melbourne",
      units: ["CHCCCS031", "CHCCCS040", "CHCDIV001"],
      trainers: [{ trainerId: "T901", unitCodes: ["CHCCCS031", "CHCCCS040"] }],
      classes: [],
      createdAt: now,
    },
    { groupId: "B2", name: "Catch-up batch", nameKey: "catch-up batch", courseCode: "CHC33021", units: ["CHCCCS031"], trainers: [], classes: [], createdAt: now },
  ]);
  await db.collection("students").updateOne({ studentId: "S9001" }, { $set: { batchIds: ["B1"] } });

  // ---- 7.1 transfer (preview logic is unit-tested; here: the admin transfer control is there, the trainer's isn't)
  await check("7.1 admin: Students tab has a Transfer control", "/superadmin/batches/B1?tab=students", "superadmin", { has: ["Transfer", "Alex Morgan", "Catch-up batch"] });
  await check("7.1 trainer: no Transfer control (admin only)", "/trainer/batches/B1?tab=students", "trainer", { has: ["Alex Morgan"], hasNot: ["Transfer", "Take out of this batch"] });

  // ---- 7.2 / 7.3 course documents, placement pack, requests with due date + review
  await db.collection("placementDocs").insertMany([
    { docId: "d-course", courseCode: "CHC33021", title: "Student handbook", file, section: "course", instructions: "Read before week 1", createdAt: now },
    { docId: "d-pack", courseCode: "CHC33021", title: "Workplace Agreement", file, section: "placement", instructions: "Sign page 3 and upload", createdAt: now },
  ]);
  await db.collection("placementSigned").insertOne({
    studentId: "S9001",
    docId: "d-pack",
    courseCode: "CHC33021",
    uploads: [{ file, uploadedAt: now }],
    review: { status: "Changes requested", comment: "Supervisor signature missing", by: "Super Admin", at: now.toISOString() },
  });
  await db.collection("documentRequests").insertMany([
    { requestId: "r1", studentId: "S9001", name: "Police check", note: "Not older than 6 months", file, uploadedAt: now, createdAt: now, dueAt: new Date(Date.now() + 7 * day), review: { status: "Approved", comment: "", by: "Super Admin", at: now.toISOString() } },
    { requestId: "r2", studentId: "S9001", name: "First aid certificate", note: "", file: null, uploadedAt: null, createdAt: now, dueAt: new Date(Date.now() + 14 * day), review: null },
  ]);
  await check("7.2 student: course description, course documents and placement pack", "/dashboard/course", "student", {
    has: ["Learn to support people in aged care and disability.", "Course documents", "Student handbook", "Read before week 1", "Placement pack", "Workplace Agreement", "Sign page 3 and upload", "Upload another file", "Changes requested", "Supervisor signature missing"],
    hasNot: ["Replace signed copy", "Other Requested Documents"],
    hasNotRaw: [">View</button>"], // course page: Download only, no View buttons; requested documents are on Requests
  });
  await check("7.3 student: Requests shows the requested documents with count, instructions, due date and approval status", "/dashboard/requests", "student", {
    has: ["Other Requested Documents 2 1 needed", "Police check", "Not older than 6 months", "Needed by", "Approved", "First aid certificate", "Upload document"],
  });
  await check("7.3 admin: review controls on the student page", "/superadmin/students/S9001", "superadmin", { has: ["Approve", "Request changes", "Request document"] });
  await check("7.3 trainer of the batch: review controls only", "/trainer/students/S9001", "trainer", {
    has: ["Approve", "Request changes", "Police check"],
    hasNotRaw: ["Upload / manage", "Delete request"],
  });

  // ---- 7.4 / 7.5 class sessions
  const s = (id, offsetDays, extra) => ({
    sessionId: id,
    batchId: "B1",
    courseCode: "CHC33021",
    unitCode: "CHCCCS040",
    title: id,
    trainerId: "T901",
    trainerName: "Sarah Wilson",
    startsAt: new Date(Date.now() + offsetDays * day),
    endsAt: new Date(Date.now() + offsetDays * day + 2 * 3600000),
    timezone: "Australia/Melbourne",
    link: null,
    instructions: "",
    cancelled: false,
    updatedAt: now,
    createdBy: "seed",
    ...extra,
  });
  await db.collection("classSessions").insertMany([
    s("Past class", -2, {}),
    s("Supporting choice", 1, { instructions: "Read chapter 2 before class." }),
    s("Wellbeing workshop", 2, { link: "https://meet.google.com/abc-defg-hij" }),
    s("Cancelled session", 3, { cancelled: true }),
  ]);
  await check("7.4 admin: Classes tab lists sessions with add / edit / cancel", "/superadmin/batches/B1?tab=classes", "superadmin", {
    has: ["Class sessions", "Supporting choice", "Wellbeing workshop", "Cancelled", "Add a class session", "Add session", "Cancel class", "Meeting link coming soon", "(Australia/Melbourne)"],
  });
  await check("7.4 trainer: sessions are read-only", "/trainer/batches/B1?tab=classes", "trainer", { has: ["Supporting choice"], hasNot: ["Add a class session", "Cancel class"] });
  // "Your next live class" and "Upcoming meetings" are hidden on My classes for now (SHOW_NEXT_CLASS / SHOW_MEETINGS = false)
  await check("7.5 student: next-class card and upcoming meetings hidden for now; My batch and training plan still there", "/dashboard/classroom", "student", {
    has: ["My classes", "My batch", "Your training plan"],
    hasNot: ["Your next live class", "Upcoming meetings", "Join Google Meet"],
  });
  const ics = await get("/api/calendar/Wellbeing%20workshop", "student");
  await check("7.5 Add to calendar gives a calendar file", "/api/calendar/Wellbeing%20workshop", "student", { has: ["BEGIN:VCALENDAR", "SUMMARY:Wellbeing workshop"] });
  if (!ics.html.includes("DTSTART:")) console.log("FAIL  calendar file has no start time");
  await check("7.5 a student not in the batch can't download it", "/api/calendar/Wellbeing%20workshop", "student2", { status: 403 });

  // ---- 8.2 statuses
  await db.collection("students").updateOne({ studentId: "S9002" }, { $set: { status: "Suspended" } });
  await check("8.2 admin: one row per course with read-only course status, account Enabled / Disabled, Manage", "/superadmin/students", "superadmin", {
    has: ["Student Course Course status Account Actions", "Enabled", "Disabled", "Manage", "Status badges are read-only. Select Manage to make a change.", "Recent changes"],
    hasNot: ["Deactivate", "Release"],
  });

  // ---- 8.3 delete is Super Admin only
  // Delete and Disable live in the Manage panel (browser-tested); the page gets canDelete only for Super Admin
  await check("8.3 Super Admin's Students page allows Delete", "/superadmin/students", "superadmin", { hasRaw: ['canDelete\\":true'] });
  await check("8.3 an Admin account's page doesn't", "/admin/students", "admin", { hasRaw: ['canDelete\\":false'] });

  // ---- 8.4 no-access state explains itself
  // the page streams, so the server sends a 404 marker and the browser shows the portal's "This page isn’t available to you" page
  await check("8.4 trainer opening a unit not assigned to them is refused (404 → no-access page), nothing of the work is sent", "/trainer/students/S9001/CHCDIV001", "trainer", {
    hasRaw: ["NEXT_HTTP_ERROR_FALLBACK;404"],
    hasNot: ["Work with diverse people", "Theory task.png"],
  });
}
