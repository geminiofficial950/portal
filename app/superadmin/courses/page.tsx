import { requireAdmin } from "@/lib/auth";
import { summarise } from "@/lib/assessment-meta";
import { listAllAssessments } from "@/lib/assessments";
import { listCourses } from "@/lib/courses";
import { listUnitContentSummaries } from "@/lib/unit-content";
import CoursesClient from "./CoursesClient";

export default async function CoursesAdminPage() {
  const admin = await requireAdmin();
  const [courses, summaries, content] = await Promise.all([listCourses(), listAllAssessments().then((all) => Object.fromEntries(Object.entries(all).map(([k, a]) => [k, summarise(a)]))), listUnitContentSummaries()]);
  return <CoursesClient initialCourses={courses} summaries={summaries} content={content} canDelete={admin.isSuper} />;
}
