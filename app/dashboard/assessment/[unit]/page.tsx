import StudentUnitPage from "../../_components/StudentUnitPage";

export default async function UnitAssessmentPage(props: PageProps<"/dashboard/assessment/[unit]">) {
  const [{ unit }, { course, item }] = await Promise.all([props.params, props.searchParams]);
  return (
    <StudentUnitPage
      unitCode={decodeURIComponent(unit)}
      courseCode={typeof course === "string" ? course : undefined}
      item={typeof item === "string" ? item : undefined}
    />
  );
}
