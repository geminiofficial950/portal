import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { listHiddenUnits } from "@/lib/hidden-units";
import { listUnitRecords } from "@/lib/unit-records";
import { unitAccess } from "@/lib/unit-status-meta";
import { logStudent } from "@/lib/student-logs";
import { getStudent, hasCourse } from "@/lib/students";

// "Go to my course" → open the first unlocked unit in the player (or the first unit, which shows as locked)
export default async function OpenCoursePage(props: PageProps<"/dashboard/course/[code]">) {
  const session = await requireStudent();
  const code = decodeURIComponent((await props.params).code);
  const student = await getStudent(session.sub);
  const course = student && hasCourse(student, code) ? await getCourse(code) : null;
  if (!student || !course) notFound();

  await logStudent({ studentId: student.studentId, studentName: student.name, courseCode: course.code, action: "Opened course", detail: course.name }, 30);
  const [hidden, records] = await Promise.all([listHiddenUnits(student.studentId, course.code), listUnitRecords(student.studentId, course.code)]);
  const visible = course.units.filter((u) => !hidden.has(u.code));
  const first = visible.find((u) => unitAccess(records[u.code] ?? null).open) ?? visible[0];
  if (!first) redirect("/dashboard/course");
  redirect(
    `/dashboard/assessment/${encodeURIComponent(first.code)}?course=${encodeURIComponent(course.code)}`,
  );
}
