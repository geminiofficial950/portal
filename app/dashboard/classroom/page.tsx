import { ArrowRightIcon, ClockIcon, VideoIcon } from "../_components/icons";
import { requireStudent } from "@/lib/auth";
import { listClassLinks } from "@/lib/classroom";
import { getCourse } from "@/lib/courses";
import { listUpcomingMeetings } from "@/lib/meetings";
import { lengthLabel, meetingState, meetingWhen } from "@/lib/meetings-meta";
import { getStudent } from "@/lib/students";

// The request time; this page is rendered per request (it reads the session)
const requestTime = () => Date.now();

const tile = "rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.2)]";

// The student's live classes: meetings scheduled for their course (or just for them), then the standing class links.
// Every "Join" goes through /classroom/[id], which checks access, notes it in the activity log and opens Google Meet.
export default async function ClassroomPage() {
  const session = await requireStudent();
  const now = requestTime();
  const student = await getStudent(session.sub);
  const codes = student?.status === "Active" ? student.courses.map((c) => c.code) : [];
  const [links, meetings, courses] = await Promise.all([
    listClassLinks(codes),
    codes.length ? listUpcomingMeetings(new Date(now), { studentId: session.sub, courseCodes: codes }) : [],
    Promise.all(codes.map((c) => getCourse(c))),
  ]);
  const courseName = (code: string) => courses.find((c) => c?.code === code)?.name ?? code;
  const groups = courses
    .flatMap((c) => (c ? [{ code: c.code, name: c.name, links: links.filter((l) => l.courseCode === c.code) }] : []))
    .filter((g) => g.links.length);

  return (
    <div className="animate-fade-up space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Classroom</h1>
        <p className="mt-1 text-base text-ink">Your meetings and live classes. Click “Join” and Google Meet opens in a new tab.</p>
      </div>

      <section aria-labelledby="meetings-heading" className="space-y-4">
        <h2 id="meetings-heading" className="text-xl font-semibold text-ink">
          Upcoming meetings
        </h2>
        {meetings.length ? (
          <ul className="space-y-4">
            {meetings.map((m) => {
              const when = meetingWhen(m);
              const live = meetingState(m, now) === "live";
              return (
                <li key={m.id} className={`${tile} flex flex-wrap items-center gap-5 ${live ? "ring-2 ring-emerald-500" : ""}`}>
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-plum text-center leading-tight text-white">
                    <span>
                      <span className="block text-2xl font-bold">{when.tileDay}</span>
                      <span className="block text-xs font-semibold uppercase">{when.tileMonth}</span>
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold leading-snug text-ink">{m.title}</span>
                      {live && <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-sm font-semibold text-emerald-800">Live now</span>}
                      {m.studentId && <span className="rounded-full bg-lilac px-3 py-0.5 text-sm font-semibold text-plum">Just for you</span>}
                    </span>
                    <span className="flex items-center gap-2 text-base text-ink">
                      <ClockIcon className="h-4 w-4 shrink-0 text-plum" />
                      {when.day} · {when.time} (Sydney time) · {lengthLabel(m.minutes)}
                    </span>
                    <span className="block text-sm text-ink">
                      {m.courseCode} – {courseName(m.courseCode)}
                    </span>
                    {m.notes && <span className="block whitespace-pre-wrap text-base text-ink">{m.notes}</span>}
                  </span>
                  <a
                    href={`/classroom/${m.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition ${
                      live ? "bg-emerald-600 hover:bg-emerald-700" : "bg-plum hover:bg-plum-light"
                    }`}
                  >
                    {live ? "Join now" : "Join meeting"}
                    <ArrowRightIcon className="h-4 w-4" />
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-[1.5rem] bg-lilac/70 px-6 py-8 text-center text-base font-medium text-ink">
            No meetings scheduled right now. When your trainer or the college sets one, it shows here.
          </p>
        )}
      </section>

      {/* standing class links, only when staff have added some */}
      {groups.length > 0 && (
        <section aria-labelledby="classes-heading" className="space-y-6">
          <h2 id="classes-heading" className="text-xl font-semibold text-ink">
            Class links
          </h2>
          {groups.map((g) => (
            <div key={g.code} className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-plum">{g.code}</p>
                <h3 className="text-lg font-semibold text-ink">{g.name}</h3>
              </div>
              <ul className="grid gap-4 md:grid-cols-2">
                {g.links.map((l) => (
                  <li key={l.id}>
                    <a
                      href={`/classroom/${l.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${tile} group flex h-full items-center gap-4 transition hover:-translate-y-0.5 hover:border-plum/30`}
                    >
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-lilac text-plum">
                        <VideoIcon className="h-7 w-7" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-semibold leading-snug text-ink">{l.title}</span>
                        <span className="block text-sm text-ink">Google Meet</span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-plum px-4 py-2.5 text-sm font-semibold text-white transition group-hover:bg-plum-light">
                        Join class
                        <ArrowRightIcon className="h-4 w-4" />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
