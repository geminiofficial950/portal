import { notFound } from "next/navigation";
import { getAssessment } from "@/lib/assessments";
import { requireAdmin } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { getUnitContent } from "@/lib/unit-content";
import UnitAdmin from "./UnitAdmin";

export default async function UnitAdminPage(props: PageProps<"/superadmin/courses/[code]/[unit]">) {
  const admin = await requireAdmin();
  const { code, unit: unitCode } = await props.params;
  const course = await getCourse(decodeURIComponent(code));
  const unit = course?.units.find((u) => u.code === decodeURIComponent(unitCode));
  if (!course || !unit) notFound();

  const [assessment, content] = await Promise.all([getAssessment(course.code, unit.code), getUnitContent(course.code, unit.code)]);
  return (
    <UnitAdmin
      course={{ code: course.code, name: course.name }}
      unit={unit}
      assessment={assessment}
      content={content}
      canEditDue={admin.isSuper}
    />
  );
}
