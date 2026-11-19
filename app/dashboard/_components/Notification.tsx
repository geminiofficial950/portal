import Link from "next/link";
import NotificationFeed from "./NotificationFeed";
import { EditIcon } from "./icons";
import { requireStudent } from "@/lib/auth";
import { listStudentNotifications } from "@/lib/student-notifications";
import { getStudent } from "@/lib/students";

const requestTime = () => Date.now();

export default async function Notification() {
  const session = await requireStudent();
  const [student, notes] = await Promise.all([getStudent(session.sub), listStudentNotifications(session.sub)]);
  const first = student?.courses[0];
  const courseHref = first
    ? `/dashboard/course/${encodeURIComponent(first.code)}`
    : "/dashboard/course";

  return (
    <section>
      <h2 className="text-lg font-semibold text-ink">Notifications</h2>

      <NotificationFeed initialItems={notes} initialTime={requestTime()}>
        <div className="rounded-2xl bg-[var(--s-soft)] p-3.5 text-ink">
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--s-icon)]">
              <EditIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-snug">
                Course materials are ready
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink/75">Pick up where you left off.</p>
              <Link
                href={courseHref}
                className="mt-2.5 inline-block rounded-full bg-[var(--s-dark)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:brightness-95"
              >
                Go to my course
              </Link>
            </div>
          </div>
        </div>
      </NotificationFeed>
    </section>
  );
}
