import { requireAdmin } from "@/lib/auth";
import { listAssessmentSummaries } from "@/lib/assessments";
import { listCourses } from "@/lib/courses";
import { listUnitContentSummaries } from "@/lib/unit-content";
import CoursesClient from "./CoursesClient";

export default async function CoursesAdminPage() {
  await requireAdmin();
  const [courses, summaries, content] = await Promise.all([listCourses(), listAssessmentSummaries(), listUnitContentSummaries()]);
  return <CoursesClient initialCourses={courses} summaries={summaries} content={content} />;
}
