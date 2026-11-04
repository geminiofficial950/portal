import StaffClassroom from "./StaffClassroom";
import { requireAdmin } from "@/lib/auth";

export default async function SuperAdminClassroomPage() {
  await requireAdmin();
  return <StaffClassroom />;
}
