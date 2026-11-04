import StaffClassroom from "../../superadmin/classroom/StaffClassroom";
import { requireTrainer } from "@/lib/auth";

// Same Classroom tools as Super Admin / Admin
export default async function TrainerClassroomPage() {
  await requireTrainer();
  return <StaffClassroom />;
}
