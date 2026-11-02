import { requireAdmin } from "@/lib/auth";
import { listCourses } from "@/lib/courses";
import { listGroups } from "@/lib/groups";
import { listStudents } from "@/lib/students";
import StudentsClient from "./StudentsClient";

export default async function StudentsPage() {
  await requireAdmin();
  const [students, allCourses, groups] = await Promise.all([listStudents(), listCourses(), listGroups()]);
  const courses = allCourses.map(({ code, name }) => ({ code, title: name }));

  return <StudentsClient initialStudents={students} courses={courses} initialGroups={groups} />;
}
