import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { listHiddenUnits } from "@/lib/hidden-units";
import { logStudent } from "@/lib/student-logs";
import { getStudent, hasCourse } from "@/lib/students";

// "Go to my course" → open the first unit player directly (no middle page)
export default async function OpenCoursePage(props: PageProps<"/dashboard/course/[code]">) {
  const session = await requireStudent();
  const code = decodeURIComponent((await props.params).code);
  const student = await getStudent(session.sub);
  const course = student && hasCourse(student, code) ? await getCourse(code) : null;
  if (!student || !course) notFound();

  await logStudent({ studentId: student.studentId, studentName: student.name, courseCode: course.code, action: "Opened course", detail: course.name }, 30);
  const hidden = await listHiddenUnits(student.studentId, course.code);
  const first = course.units.find((u) => !hidden.has(u.code));
  if (!first) redirect("/dashboard/course");
  redirect(
    `/dashboard/assessment/${encodeURIComponent(first.code)}?course=${encodeURIComponent(course.code)}`,
  );
}
