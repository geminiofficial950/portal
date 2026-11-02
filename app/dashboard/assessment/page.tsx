import { redirect } from "next/navigation";

// Units are opened from the Course page ("Go to my course") and the unit page's sidebar
export default function AssessmentsPage() {
  redirect("/dashboard/course");
}
