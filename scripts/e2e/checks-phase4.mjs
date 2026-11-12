// Phases 4–6 — manual marking, publish vs save, feedback response, review replies, deadlines, extensions, navigation
export default async function ({ check, db }) {
  const now = new Date();
  const past = new Date(Date.now() - 2 * 86400000);
  const future = new Date(Date.now() + 10 * 86400000);
  await db.collection("studentGroups").insertOne({
    groupId: "B1",
    name: "Jan batch",
    nameKey: "jan batch",
    code: "IS-2027-01",
    courseCode: "CHC33021",
    units: ["CHCCCS031", "CHCCCS040", "CHCDIV001"],
    trainers: [{ trainerId: "T901", unitCodes: ["CHCCCS031", "CHCCCS040"] }],
    classes: [],
    createdAt: now,
  });
  await db.collection("students").updateMany({}, { $set: { batchIds: ["B1"] } });
  const U = "/dashboard/assessment/CHCCCS040?course=CHC33021";

  // ---- portals
  await check("admin portal title and navigation", "/superadmin", "superadmin", { has: ["Super Admin Portal", "Courses", "Batches", "Requests", "Settings"], hasNotRaw: ['href="/superadmin/classroom"'] });
  await check("Admin account sees “Admin Portal” (not Super Admin)", "/admin", "admin", { has: ["Admin Portal"], hasNot: ["Super Admin Portal"] });
  await check("trainer portal title and navigation", "/trainer", "trainer", { has: ["Trainer Portal", "My batches", "Assigned units", "Submissions", "Feedback responses", "Extension requests"] });
  await check("student portal title and navigation", "/dashboard", "student", { has: ["Student Portal", "Courses", "My classes", "Requests", "Feedback", "Student support Portal help"], hasNot: ["Help Support"] });

  // ---- marking screen
  await check("trainer: marking screen has manual status, publish, marked copy and due date", "/trainer/marking/sub-mcq", "trainer", {
    has: ["Student submission", "Module status", "Pending marking", "Save marking", "Publish feedback", "Attach marked copy", "Extend due date", "Previous attempts", "Unit Active"],
  });
  await check("trainer: assigned units page lists their units with work waiting", "/trainer/units", "trainer", { has: ["CHCCCS040", "Jan batch", "to mark"] });

  // ---- saved (unpublished) marking is private
  await db.collection("submissions").updateOne({ submissionId: "sub-mcq" }, { $set: { draft: { status: "Rejected", feedback: "SECRET DRAFT NOTE", savedBy: "Sarah", savedAt: now } } });
  await check("student: unpublished marking is not visible", `${U}&item=part:m2`, "student", { has: ["Pending marking"], hasNot: ["SECRET DRAFT NOTE", "Not satisfactory"] });

  // ---- published feedback → student responds → trainer review list
  await db.collection("submissions").updateOne(
    { submissionId: "sub-mcq" },
    { $set: { status: "Rejected", feedback: "Explain question 2 in more detail.", decidedBy: "Sarah Wilson · Trainer", decidedAt: now, draft: null, response: null } },
  );
  await check("student: published feedback asks for a response (accept or review)", `${U}&item=part:m2`, "student", {
    has: ["Not satisfactory", "Explain question 2 in more detail.", "Accept feedback", "Request review"],
  });
  await db.collection("submissions").updateOne({ submissionId: "sub-mcq" }, { $set: { response: { state: "review", comment: "Which part of Q2?", signature: null, at: now, replies: [] } } });
  await check("trainer: feedback reviews lists the request", "/trainer/reviews", "trainer", { has: ["Alex Morgan", "Which part of Q2?", "not answered yet"] });
  await check("trainer: marking screen shows the student's response with a reply box", "/trainer/marking/sub-mcq", "trainer", { has: ["Review requested", "Which part of Q2?", "Reply to student"] });
  await check("student: feedback page lists it", "/dashboard/feedback", "student", { has: ["Knowledge check", "Not satisfactory", "You asked for a review"] });

  // ---- deadline lock + extension request
  await db.collection("moduleDueDates").insertOne({ studentId: "S9001", courseCode: "CHC33021", unitCode: "CHCCCS040", moduleId: "m3", dueAt: past, setAt: now, setBy: "seed" });
  await check("student: overdue module locks content and offers Request extension", `${U}&item=part:m3`, "student", {
    has: ["The due date has passed — this module is locked", "Request an extension"],
    hasNot: ["Completed answers", "Submit to trainer"],
  });
  await db.collection("extensionRequests").insertOne({
    requestId: "ext-1",
    studentId: "S9001",
    studentName: "Alex Morgan",
    courseCode: "CHC33021",
    unitCode: "CHCCCS040",
    moduleId: "m3",
    moduleTitle: "Theory assessment",
    reason: "Hospital stay",
    proposedDue: future,
    status: "Pending",
    decidedBy: null,
    decidedAt: null,
    decisionReason: "",
    newDue: null,
    createdAt: now,
  });
  await check("student: module stays locked while the request is pending", `${U}&item=part:m3`, "student", {
    has: ["Extension requested — waiting for a decision", "Hospital stay"],
    hasNot: ["Submit to trainer"],
  });
  await check("trainer: extension requests lists it with Approve / Decline", "/trainer/extensions", "trainer", { has: ["Alex Morgan", "Theory assessment", "Hospital stay", "Approve", "Decline"] });
  await check("admin: Requests lists it too", "/superadmin/requests", "superadmin", { has: ["Hospital stay"] });
  await check("student: Requests page shows it", "/dashboard/requests", "student", { has: ["Theory assessment", "Pending", "Hospital stay"] });

  // ---- approved extension unlocks only that student/module…
  await db.collection("extensionRequests").updateOne({ requestId: "ext-1" }, { $set: { status: "Approved", newDue: future, decidedBy: "Sarah", decidedAt: now } });
  await db.collection("moduleDueDates").updateOne({ studentId: "S9001", moduleId: "m3" }, { $set: { dueAt: future } });
  await check("student: after approval the module is open again", `${U}&item=part:m3`, "student", { has: ["Completed answers", "Submit to trainer"] });
  await check("other student keeps the module's own date", `${U}&item=part:m3`, "student2", { hasNot: ["Hospital stay"] });

  // ---- …but never reactivates a non-active unit
  await db.collection("unitRecords").insertOne({ studentId: "S9001", courseCode: "CHC33021", unitCode: "CHCCCS040", status: "Withdrawn", history: [] });
  await check("an extension can't reopen a Withdrawn unit", `${U}&item=part:m3`, "student", { has: ["Unit status: Withdrawn"], hasNot: ["Completed answers", "Submit to trainer"] });
}
