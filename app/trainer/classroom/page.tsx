import StaffClassroom from "../../superadmin/classroom/StaffClassroom";
import { requireTrainer } from "@/lib/auth";

// Same Classroom tools as Super Admin / Admin, limited to the trainer's own batch students
export default async function TrainerClassroomPage() {
  const trainer = await requireTrainer();
  return <StaffClassroom trainer={{ trainerId: trainer.trainerId, name: trainer.name }} />;
}
