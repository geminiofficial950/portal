import { ArrowRightIcon, ClockIcon, VideoIcon } from "../_components/icons";
import { requireStudent } from "@/lib/auth";
import { formatClassTime } from "@/lib/batch-meta";
import { getBatch } from "@/lib/groups";
import { getTrainer } from "@/lib/trainers";
import { listClassLinks } from "@/lib/classroom";
import { getCourse } from "@/lib/courses";
import { listUpcomingMeetings } from "@/lib/meetings";
import { lengthLabel, meetingState, meetingWhen } from "@/lib/meetings-meta";
import { getStudent } from "@/lib/students";
import { listSessions } from "@/lib/class-sessions";
import {
  canJoin,
  nextSession,
  sessionState,
  sessionWhen,
} from "@/lib/session-meta";
import { CalendarIcon } from "../_components/icons";
import TrainingPlan from "../_components/TrainingPlan";

// Hidden for now on the student's My classes page (asked 6 Nov 2026) — set to true to show them again
const SHOW_NEXT_CLASS = false; // "Your next live class" card
const SHOW_MEETINGS = false; // "Upcoming meetings" empty state — the list itself shows whenever a meeting is scheduled (Google Meet link)

// The request time; this page is rendered per request (it reads the session)
const requestTime = () => Date.now();

const tile =
  "rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(91,63,153,0.2)]";

// The student's live classes: meetings scheduled for their course (or just for them), then the standing class links.
// Every "Join" goes through /classroom/[id], which checks access, notes it in the activity log and opens Google Meet.
export default async function ClassroomPage() {
  const session = await requireStudent();
  const now = requestTime();
  const student = await getStudent(session.sub);
  const codes =
    student?.status === "Active" ? student.courses.map((c) => c.code) : [];
  const [links, meetings, courses] = await Promise.all([
    listClassLinks(codes),
    codes.length
      ? listUpcomingMeetings(new Date(now), {
          studentId: session.sub,
          courseCodes: codes,
        })
      : [],
    Promise.all(codes.map((c) => getCourse(c))),
  ]);
  const courseName = (code: string) =>
    courses.find((c) => c?.code === code)?.name ?? code;

  // The student's batch(es): set by the college, shown read-only — day, time and link of each class
  const myBatches = (
    await Promise.all(
      (student?.status === "Active" ? student.batchIds : []).map(async (id) => {
        const b = await getBatch(id);
        if (!b || (b.courseCode && !codes.includes(b.courseCode))) return [];
        const names = (
          await Promise.all(b.trainers.map((t) => getTrainer(t.trainerId)))
        ).flatMap((t) => (t ? [t.name] : []));
        return [{ ...b, trainerName: names.join(", ") || null }];
      }),
    )
  ).flat();
  // Class sessions of the student's batches: the next one gets its own card, the rest are listed
  const sessions = await listSessions(myBatches.map((b) => b.batchId));
  const next = nextSession(sessions, now);
  const sessionsOf = (batchId: string) => sessions.filter((s) => s.batchId === batchId && sessionState(s, now) !== "ended");
  const upcoming = sessions.filter(
    (s) => s !== next && sessionState(s, now) !== "ended",
  );
  const groups = courses
    .flatMap((c) =>
      c
        ? [
            {
              code: c.code,
              name: c.name,
              links: links.filter((l) => l.courseCode === c.code),
            },
          ]
        : [],
    )
    .filter((g) => g.links.length);

  return (
    <div className="animate-fade-up space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
          My classes
        </h1>
      </div>

      {/* Next live class — hidden for now (SHOW_NEXT_CLASS) */}
      {SHOW_NEXT_CLASS && (
        <section aria-labelledby="next-heading" className="space-y-4">
          <h2 id="next-heading" className="text-xl font-semibold text-ink">
            Your next live class
          </h2>
          {next ? (
            <div className="flex flex-wrap items-center gap-5 rounded-[1.5rem] border border-plum/30 bg-lilac p-5 sm:p-6">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-plum text-white">
                <CalendarIcon className="h-7 w-7" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xl font-semibold text-ink">{next.title}</p>
                <p className="flex items-center gap-2 text-base text-ink">
                  <ClockIcon className="h-4 w-4 shrink-0 text-plum" />
                  {sessionWhen(next)}
                </p>
                <p className="text-base text-ink">
                  {next.unitCode ? `${next.unitCode} · ` : ""}Trainer:{" "}
                  {next.trainerName ?? "to be confirmed"}
                </p>
                {next.instructions && (
                  <p className="whitespace-pre-wrap text-base text-ink">
                    {next.instructions}
                  </p>
                )}
                {sessionState(next, now) === "live" && (
                  <span className="inline-block rounded-full bg-emerald-100 px-3 py-0.5 text-sm font-semibold text-emerald-800">
                    Live now
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {canJoin(next, now) ? (
                  <a
                    href={next.link!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-plum px-5 py-3 text-sm font-semibold text-white transition hover:bg-plum-light"
                  >
                    <VideoIcon className="h-4 w-4" />
                    Join Google Meet
                  </a>
                ) : (
                  <span className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-ink">
                    Meeting link coming soon
                  </span>
                )}
                {}
                <a
                  href={`/api/calendar/${next.sessionId}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-plum px-5 py-3 text-sm font-semibold text-plum transition hover:bg-white"
                >
                  <CalendarIcon className="h-4 w-4" />
                  Add to calendar
                </a>
              </div>
            </div>
          ) : (
            <p className="rounded-[1.5rem] bg-lilac/70 px-6 py-6 text-center text-base font-medium text-ink">
              No class is scheduled yet. Your next class will show here.
            </p>
          )}
          {upcoming.length > 0 && (
            <ul className="divide-y divide-ink/10 rounded-[1.5rem] border border-ink/10 bg-white">
              {upcoming.map((s) => (
                <li
                  key={s.sessionId}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-ink">
                      {s.title}
                      {s.cancelled && (
                        <span className="ml-2 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                          Cancelled
                        </span>
                      )}
                    </span>
                    <span className="block text-sm text-ink">
                      {sessionWhen(s)}
                    </span>
                  </span>
                  {!s.cancelled && (
                    <a
                      href={`/api/calendar/${s.sessionId}`}
                      className="text-sm font-semibold text-plum underline"
                    >
                      Add to calendar
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}


      {/* Upcoming meetings with their Google Meet link — shown whenever one is scheduled for the student */}
      {(SHOW_MEETINGS || meetings.length > 0) && (
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
                  <li
                    key={m.id}
                    className={`${tile} flex flex-wrap items-center gap-5 ${live ? "ring-2 ring-emerald-500" : ""}`}
                  >
                    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-plum text-center leading-tight text-white">
                      <span>
                        <span className="block text-2xl font-bold">
                          {when.tileDay}
                        </span>
                        <span className="block text-xs font-semibold uppercase">
                          {when.tileMonth}
                        </span>
                      </span>
                    </span>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-semibold leading-snug text-ink">
                          {m.title}
                        </span>
                        {live && (
                          <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-sm font-semibold text-emerald-800">
                            Live now
                          </span>
                        )}
                        {m.studentId && (
                          <span className="rounded-full bg-lilac px-3 py-0.5 text-sm font-semibold text-plum">
                            Just for you
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-2 text-base text-ink">
                        <ClockIcon className="h-4 w-4 shrink-0 text-plum" />
                        {when.day} · {when.time} (Sydney time) ·{" "}
                        {lengthLabel(m.minutes)}
                      </span>
                      <span className="block text-sm text-ink">
                        {m.courseCode} – {courseName(m.courseCode)}
                      </span>
                      {m.notes && (
                        <span className="block whitespace-pre-wrap text-base text-ink">
                          {m.notes}
                        </span>
                      )}
                    </span>
                    <a
                      href={`/classroom/${m.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition ${
                        live
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-plum hover:bg-plum-light"
                      }`}
                    >
                      {live ? "Join now" : "Join on Google Meet"}
                      <ArrowRightIcon className="h-4 w-4" />
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-[1.5rem] bg-lilac/70 px-6 py-8 text-center text-base font-medium text-ink">
              No meetings scheduled right now. When your trainer or the college
              sets one, it shows here.
            </p>
          )}
        </section>
      )}

      {/* standing class links, only when staff have added some */}
      {groups.length > 0 && (
        <section aria-labelledby="classes-heading" className="space-y-6">
          <h2 id="classes-heading" className="text-xl font-semibold text-ink">
            Class links
          </h2>
          {groups.map((g) => (
            <div key={g.code} className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-plum">
                  {g.code}
                </p>
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
                        <span className="block text-lg font-semibold leading-snug text-ink">
                          {l.title}
                        </span>
                        <span className="block text-sm text-ink">
                          Google Meet
                        </span>
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

      {/* The units of each course with their status (moved here from the Courses page) */}
      {student && <TrainingPlan student={student} />}

      {/* My batch — below the training plan */}
      <section aria-labelledby="batch-heading" className="space-y-4">
        <h2 id="batch-heading" className="text-xl font-semibold text-ink">
          My batch
        </h2>
        {myBatches.length ? (
          myBatches.map((b) => (
            <div
              key={b.batchId}
              className="overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white shadow-md"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 bg-ink px-5 py-3 text-white">
                <span className="text-base font-semibold">{b.name}</span>
                <span className="text-sm">
                  {b.courseCode} · Trainer: {b.trainerName ?? "to be confirmed"}
                </span>
              </div>
              {/* Weekly class times (day, time, link) */}
              {b.classes.length > 0 && (

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left">
                    <thead className="bg-lilac text-sm font-semibold text-ink">
                      <tr>
                        <th className="px-5 py-2.5">Day of class</th>
                        <th className="px-5 py-2.5">Time of class</th>
                        <th className="px-5 py-2.5 text-right">Class link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink/10">
                      {b.classes.map((c) => (
                        <tr key={c.id}>
                          <td className="px-5 py-3.5 text-base font-semibold text-ink">
                            {c.day}
                          </td>
                          <td className="px-5 py-3.5 text-base text-ink">
                            {formatClassTime(c.time)} (Melbourne time)
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <a
                              href={`/classroom/${c.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl bg-plum px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-plum-light"
                            >
                              Join class
                              <ArrowRightIcon className="h-4 w-4" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Scheduled classes of this batch (added by a trainer, Admin or Super Admin — who added it isn't shown) */}
              {sessionsOf(b.batchId).length > 0 && (
                <ul className="divide-y divide-ink/10 border-t border-ink/10">
                  {sessionsOf(b.batchId).map((s) => (
                    <li key={s.sessionId} className="flex flex-wrap items-center gap-3 px-5 py-4">
                      <span className="min-w-0 flex-1 space-y-0.5">
                        <span className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                          {s.title}
                          {s.cancelled && <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">Cancelled</span>}
                          {!s.cancelled && sessionState(s, now) === "live" && (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Live now</span>
                          )}
                        </span>
                        <span className="flex items-center gap-2 text-base text-ink">
                          <ClockIcon className="h-4 w-4 shrink-0 text-plum" />
                          {sessionWhen(s)}
                        </span>
                        {s.unitCode && <span className="block text-sm text-ink">{s.unitCode}</span>}
                        {s.instructions && <span className="block whitespace-pre-wrap text-sm text-ink">{s.instructions}</span>}
                      </span>
                      {!s.cancelled && (
                        <span className="flex flex-wrap items-center gap-2">
                          {canJoin(s, now) ? (
                            <a
                              href={s.link!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl bg-plum px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-plum-light"
                            >
                              <VideoIcon className="h-4 w-4" />
                              Join on Google Meet
                            </a>
                          ) : (
                            <span className="rounded-xl bg-lilac px-4 py-2.5 text-sm font-semibold text-ink">Meeting link coming soon</span>
                          )}
                          <a href={`/api/calendar/${s.sessionId}`} className="text-sm font-semibold text-plum underline">
                            Add to calendar
                          </a>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!b.classes.length && !sessionsOf(b.batchId).length && (
                <p className="px-5 py-5 text-base text-ink">
                  Class times will show here when your trainer adds them.
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="rounded-[1.5rem] bg-lilac/70 px-6 py-6 text-center text-base font-medium text-ink">
            You’re not in a batch yet. The college will put you in one.
          </p>
        )}
      </section>
    </div>
  );
}
