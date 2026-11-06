// Phases 2–3 — batches with trainers per unit, unit statuses, admin opening, access checks, trainer visibility, transfer
export default async function ({ check, db }) {
  const now = new Date();
  await db.collection("studentGroups").insertMany([
    {
      groupId: "B1",
      name: "January 2027 Individual Support",
      nameKey: "january 2027 individual support",
      code: "IS-2027-01",
      courseCode: "CHC33021",
      startDate: "2027-01-11",
      endDate: "2028-01-10",
      timezone: "Australia/Melbourne",
      units: ["CHCCCS031", "CHCCCS040", "CHCDIV001"],
      trainers: [
        { trainerId: "T901", unitCodes: ["CHCCCS031"] },
        { trainerId: "T902", unitCodes: ["CHCCCS040"] },
      ],
      classes: [],
      createdAt: now,
    },
    { groupId: "B2", name: "Catch-up batch", nameKey: "catch-up batch", code: "IS-2027-02", courseCode: "CHC33021", units: ["CHCCCS031", "CHCCCS040", "CHCDIV001"], trainers: [], classes: [], createdAt: now },
  ]);
  await db.collection("students").updateMany({ studentId: { $in: ["S9001", "S9002"] } }, { $set: { batchIds: ["B1"] } });

  // ---- admin: batch planning
  await check("admin: batch page shows the training plan with trainers per unit", "/superadmin/batches/B1", "superadmin", {
    has: ["January 2027 Individual Support", "IS-2027-01", "Training plan", "Sarah Wilson", "Omar Khan", "Open now", "Schedule release", "2 students"],
  });
  await check("admin: batches list shows code and both trainers", "/superadmin/batches", "superadmin", { has: ["IS-2027-01", "Sarah Wilson, Omar Khan"] });

  // ---- trainer visibility: current batch AND assigned unit
  await check("trainer A sees only work in their unit (CHCCCS031)", "/trainer/marking", "trainer", { has: ["Theory Task", "Provide individualised support"], hasNot: ["Knowledge check"] });
  await check("trainer B sees only work in their unit (CHCCCS040)", "/trainer/marking", "trainer2", { has: ["Knowledge check"], hasNot: ["Theory Task"] });
  await check("trainer A can't open trainer B's work by direct link", "/trainer/marking/sub-mcq", "trainer", { hasNot: ["Knowledge check", "Respect choices"] });
  await check("trainer A can open their own unit's work", "/trainer/marking/sub-legacy", "trainer", { has: ["Theory Task"] });
  await check("trainer A's student page lists only their unit", "/trainer/students/S9001", "trainer", {
    has: ["CHCCCS031", "Set unit status"],
    hasNot: ["Support independence and wellbeing"],
  });
  await check("trainer batch page is read-only", "/trainer/batches/B1", "trainer", { has: ["Training plan"], hasNot: ["Open now", "Edit units & trainers"] });

  // ---- unit status: a non-active status hides every module, even though the unit is opened
  await db.collection("unitRecords").insertOne({ studentId: "S9001", courseCode: "CHC33021", unitCode: "CHCCCS040", status: "Deferred", feedback: "Paused at student request", history: [] });
  await check("student: a Deferred unit shows only its name and status", "/dashboard/assessment/CHCCCS040?course=CHC33021&item=part:m2", "student", {
    has: ["Support independence and wellbeing", "Unit status: Deferred", "Deferred", "Paused at student request"],
    hasNot: ["Which is a body system?", "Your unit activities"],
  });
  await check("student: the task file of a Deferred unit can't be downloaded", "/api/files/" + (await db.collection("uploads.files").findOne({ filename: "Body systems.png" }))._id, "student", { status: 403 });
  await check("admin: student progress shows the unit status and Open/Close controls", "/superadmin/students/S9001", "superadmin", {
    has: ["Unit: Deferred", "Set unit status", "Close again", "Open for student"],
  });

  // ---- admin opens a missed unit later for one student: classmates unaffected
  await db.collection("unitUnlocks").insertOne({ studentId: "S9002", courseCode: "CHC33021", unitCode: "CHCDIV001", unlockedAt: now, unlockedBy: "Super Admin" });
  await check("student B: the unit opened only for them is open", "/dashboard/assessment/CHCDIV001?course=CHC33021", "student2", { hasNot: ["isn’t open yet", "Not open yet."] });
  await check("student A: the same unit stays closed", "/dashboard/assessment/CHCDIV001?course=CHC33021", "student", { has: ["Not open yet"] });

  // ---- transfer: work stays, old trainer loses access at once
  await db.collection("students").updateOne({ studentId: "S9001" }, { $set: { batchIds: ["B2"] } });
  await check("after transfer, the old trainer can't open the student's work", "/trainer/marking/sub-legacy", "trainer", { hasNot: ["Theory task.png", "What the student handed in"] });
  await check("after transfer, the old trainer's inbox no longer lists it", "/trainer/marking", "trainer", { hasNot: ["Alex Morgan"] });
  await check("after transfer, the student's work is still there for admin", "/superadmin/students/S9001/CHCCCS031", "superadmin", { has: ["Theory Task", "Theory task.png"] });
}
