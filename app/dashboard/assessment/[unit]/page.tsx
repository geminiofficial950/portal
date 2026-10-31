import StudentUnitPage from "../../_components/StudentUnitPage";

export default async function UnitAssessmentPage(props: PageProps<"/dashboard/assessment/[unit]">) {
  const { unit } = await props.params;
  return <StudentUnitPage unitCode={decodeURIComponent(unit)} back={{ href: "/dashboard/assessment", label: "All units" }} />;
}
