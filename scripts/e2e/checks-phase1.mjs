// Phase 1 — course, units, flexible modules, current resources
export default async function ({ check }) {
  const U = "/dashboard/assessment";
  await check("admin: course list shows the description", "/superadmin/courses", "superadmin", {
    has: ["Learn to support people in aged care and disability.", "Add course", "Edit details"],
  });
  await check("admin: unit page has the Modules tab", "/superadmin/courses/CHC33021/CHCCCS040", "superadmin", { has: ["3. Modules"] });
  await check("admin: an older unit opens (fixed parts read as modules)", "/superadmin/courses/CHC33021/CHCCCS031", "superadmin", { has: ["CHCCCS031"] });

  await check("student: unit overview lists only the configured, live modules", `${U}/CHCCCS040?course=CHC33021&item=overview`, "student", {
    has: ["Your unit activities", "Learning materials", "Knowledge check", "Theory assessment", "Pending marking"],
    hasNot: ["Old removed module"],
  });
  await check("student: the older unit shows its Quiz and Theory Task as modules", `${U}/CHCCCS031?course=CHC33021&item=overview`, "student", {
    has: ["Quiz and Activities", "Theory Task"],
  });
  await check("student: a learning module has nothing to submit", `${U}/CHCCCS040?course=CHC33021&item=part:m1`, "student", {
    has: ["Read chapter 2."],
    hasNot: ["Submit to trainer"],
  });
  await check("student: activities module shows all four activity types and Pending marking (no score)", `${U}/CHCCCS040?course=CHC33021&item=part:m2`, "student", {
    has: ["Which is a body system?", "Explain person-centred care.", "Match the terms", "Name the system shown.", "Pending marking"],
    hasNot: ["Score", "reference", "Satisfactory ✓"],
  });
  await check("student: task module shows the download and the named upload + declaration + signature", `${U}/CHCCCS040?course=CHC33021&item=part:m3`, "student", {
    has: ["Theory assessment", "Completed answers", "Your signature", "Submit to trainer", "Save draft"],
  });
  await check("student: a unit that isn't open shows no modules", `${U}/CHCDIV001?course=CHC33021`, "student", {
    has: ["Not open yet"],
    hasNot: ["Your unit activities"],
  });

  await check("staff: marking a new module shows responses with the reference answer", "/superadmin/marking/sub-mcq", "superadmin", {
    has: ["Knowledge check", "Respect choices", "reference", "Skeletal"],
  });
  await check("staff: marking older theory work still works", "/superadmin/marking/sub-legacy", "superadmin", { has: ["Theory Task", "Theory task.png"] });
  await check("a trainer with no batch assignment can't open student work", "/trainer/marking/sub-mcq", "trainer", { hasNot: ["Knowledge check", "Respect choices"] });
  await check("admin: student unit review lists the modules", "/superadmin/students/S9001/CHCCCS040", "superadmin", { has: ["Knowledge check", "Theory assessment"] });
}
