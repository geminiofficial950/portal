import { requireAdmin } from "@/lib/auth";
import { listCourses } from "@/lib/courses";
import { listBatches } from "@/lib/groups";
import { listStudents } from "@/lib/students";
import StudentsClient from "./StudentsClient";

export default async function StudentsPage() {
  const admin = await requireAdmin();
  const [students, allCourses, batches] = await Promise.all([listStudents(), listCourses(), listBatches()]);
  const courses = allCourses.map(({ code, name }) => ({ code, title: name }));

  return (
    <StudentsClient
      initialStudents={students}
      courses={courses}
      batches={batches}
      canDelete={admin.isSuper}
      batchesHref={admin.isSuper ? "/superadmin/batches" : "/admin/batches"}
    />
  );
}
