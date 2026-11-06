import { requireAdmin } from "@/lib/auth";
import { listCourses } from "@/lib/courses";
import { listBatches } from "@/lib/groups";
import { COURSE_STATUS_LOG } from "@/lib/course-status";
import { listRecentLogs } from "@/lib/student-logs";
import { listStudents } from "@/lib/students";
import StudentsClient from "./StudentsClient";

export default async function StudentsPage() {
  const admin = await requireAdmin();
  const [students, allCourses, batches, recentChanges] = await Promise.all([listStudents(), listCourses(), listBatches(), listRecentLogs(COURSE_STATUS_LOG, 8)]);
  const courses = allCourses.map(({ code, name }) => ({ code, title: name }));

  return (
    <StudentsClient
      initialStudents={students}
      courses={courses}
      batches={batches}
      canDelete={admin.isSuper}
      batchesHref={admin.isSuper ? "/superadmin/batches" : "/admin/batches"}
      recentChanges={recentChanges}
    />
  );
}
