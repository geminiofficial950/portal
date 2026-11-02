import Link from "next/link";
import { EditIcon } from "./icons";
import { requireStudent } from "@/lib/auth";
import { getStudent } from "@/lib/students";

export default async function Notification() {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  const first = student?.courses[0];
  const courseHref = first
    ? `/dashboard/course/${encodeURIComponent(first.code)}`
    : "/dashboard/course";

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-ink">Notification</h2>
        <Link href="/dashboard/course" className="text-xs text-peach hover:underline">
          View all
        </Link>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-xl bg-plum p-4 text-white sm:px-4 sm:py-5">
        <span className="absolute -bottom-10 -right-6 h-24 w-24 rounded-full border border-white/20" />
        <span className="absolute -bottom-6 -right-2 h-16 w-16 rounded-full border border-white/20" />

        <div className="relative flex gap-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/20">
            <EditIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium sm:text-base">
              Your course materials are ready — continue where you left off
            </p>
            <p className="mt-1 text-[11px] text-white/75">Open your course to view units and resources</p>
            <Link
              href={courseHref}
              className="mt-3 inline-block rounded-md bg-peach px-4 py-1.5 text-[11px] font-medium text-white transition hover:brightness-95"
            >
              Go to my course
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
