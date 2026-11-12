import ClassroomManager from "./ClassroomManager";
import MeetingsManager from "./MeetingsManager";
import { listClassLinks } from "@/lib/classroom";
import { listCourses } from "@/lib/courses";
import { googleMeetReady } from "@/lib/google-meet";
import { listUpcomingMeetings } from "@/lib/meetings";
import { zonedParts } from "@/lib/meetings-meta";
import { listStudents } from "@/lib/students";
import { trainerScope } from "@/lib/trainer-access";

// The request time; the page is rendered per request (it reads the session)
const requestTime = () => Date.now();

// Classroom for staff — the same for Super Admin, Admins and trainers (each page checks who's signed in first)
// A trainer only sees (and can invite) the students currently in their own batches, and only those batches' courses.
export default async function StaffClassroom({ trainer }: { trainer?: { trainerId: string; name: string } } = {}) {
  const now = requestTime();
  const [allCourses, links, allMeetings, allStudents, scope] = await Promise.all([
    listCourses(),
    listClassLinks(),
    listUpcomingMeetings(new Date(now)),
    listStudents(),
    trainer ? trainerScope(trainer.trainerId) : null,
  ]);
  const mine = scope ? new Set(scope.students.map((s) => s.studentId)) : null;
  const students = mine ? allStudents.filter((s) => mine.has(s.studentId)) : allStudents;
  const myCourses = scope ? new Set(scope.batches.map((b) => b.courseCode).filter(Boolean)) : null;
  const courses = myCourses ? allCourses.filter((c) => myCourses.has(c.code)) : allCourses;
  const meetings = mine ? allMeetings.filter((m) => (m.studentId ? mine.has(m.studentId) : m.createdBy === trainer!.name)) : allMeetings;
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
        trainerView={!!trainer}
      />

      <ClassroomManager courses={courseList} initial={links} />
    </div>
  );
}
