// Courses: no "Release" anywhere; units can have any code format, different in each course
export default async function ({ check, db }) {
  // a second course whose units use a completely different code style
  await db.collection("courses").insertOne({
    code: "ICT40120",
    name: "Certificate IV in Information Technology",
    category: "Certificate IV",
    duration: "6 months",
    description: "",
    units: [
      { code: "ICT-101", title: "Intro to networks" },
      { code: "MOD.2", title: "Cloud basics" },
    ],
    placementHours: null,
    placementText: "",
    createdAt: new Date(),
  });
  await db.collection("students").updateOne({ studentId: "S9002" }, { $set: { courses: ["ICT40120"], course: "ICT40120" } });
  await db.collection("unitUnlocks").insertOne({ studentId: "S9002", courseCode: "ICT40120", unitCode: "ICT-101", unlockedAt: new Date(), unlockedBy: "seed" });

  await check("admin: Courses page has no Release (seed course had “Release 1”)", "/superadmin/courses", "superadmin", {
    has: ["CHC33021", "ICT40120", "Add course"],
    hasNot: ["Release 1", "(Release", "Release (e.g."],
  });
  await check("admin: a unit with a non-standard code opens", "/superadmin/courses/ICT40120/ICT-101", "superadmin", { has: ["ICT-101", "Intro to networks", "3. Modules"] });
  await check("admin: a unit code with a dot opens", "/superadmin/courses/ICT40120/MOD.2", "superadmin", { has: ["MOD.2", "Cloud basics"] });
  await check("student: the other course's unit with its own code works", "/dashboard/assessment/ICT-101?course=ICT40120", "student2", { has: ["Intro to networks", "Cloud basics"] });

  // student course page: description, the units with their status, and course documents (LMS guide: Courses → Enrolled course)
  await db.collection("unitRecords").insertOne({ studentId: "S9001", courseCode: "CHC33021", unitCode: "CHCCCS040", status: "Competent", history: [] });
  await check("student: course page lists every unit with its status", "/dashboard/course", "student", {
    has: ["Learn to support people in aged care and disability.", "Units", "01", "Provide individualised support", "CHCCCS031", "Open unit", "Support independence and wellbeing", "Competent", "Work with diverse people", "Not open yet"],
  });
  await check("student: an open unit's button goes to that unit", "/dashboard/course", "student", { hasRaw: ["/dashboard/assessment/CHCCCS031?course=CHC33021"], hasNotRaw: ["/dashboard/assessment/CHCCCS040?course=CHC33021", "/dashboard/assessment/CHCDIV001?course=CHC33021"] });
}
