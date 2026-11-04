import ClassroomManager from "./ClassroomManager";
import MeetingsManager from "./MeetingsManager";
import { listClassLinks } from "@/lib/classroom";
import { listCourses } from "@/lib/courses";
import { googleMeetReady } from "@/lib/google-meet";
import { listUpcomingMeetings } from "@/lib/meetings";
import { zonedParts } from "@/lib/meetings-meta";
import { listStudents } from "@/lib/students";

// The request time; the page is rendered per request (it reads the session)
const requestTime = () => Date.now();

// Classroom for staff — the same for Super Admin, Admins and trainers (each page checks who's signed in first)
export default async function StaffClassroom() {
  const now = requestTime();
  const [courses, links, meetings, students] = await Promise.all([listCourses(), listClassLinks(), listUpcomingMeetings(new Date(now)), listStudents()]);
  const courseList = courses.map(({ code, name }) => ({ code, name }));

  return (
    <div className="animate-fade-up space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-[1.65rem]">Classroom</h1>
        <p className="mt-1 text-sm text-ink">Schedule meetings and share class links. Students see them under Classroom and join Google Meet with one click.</p>
      </div>

      <MeetingsManager
        courses={courseList}
        students={students.filter((s) => s.status === "Active").map((s) => ({ studentId: s.studentId, name: s.name, courseCodes: s.courses.map((c) => c.code) }))}
        initial={meetings}
        today={zonedParts(new Date(now).toISOString()).date}
        now={now}
        googleReady={googleMeetReady()}
      />

      <ClassroomManager courses={courseList} initial={links} />
    </div>
  );
}
