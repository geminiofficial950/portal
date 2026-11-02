import Link from "next/link";

// One tab per course a student is enrolled in; the picked one is `?course=` on `baseHref`
export default function CourseTabs({
  baseHref,
  courses,
  current,
}: {
  baseHref: string;
  courses: { code: string; name: string }[];
  current: string;
}) {
  if (courses.length < 2) return null;
  return (
    <nav aria-label="Courses" className="flex flex-wrap gap-2">
      {courses.map((c) => {
        const active = c.code === current;
        return (
          <Link
            key={c.code}
            href={`${baseHref}?course=${encodeURIComponent(c.code)}`}
            aria-current={active ? "page" : undefined}
            className={`rounded-xl px-4 py-2.5 text-left text-sm transition ${
              active ? "bg-plum text-white shadow-md shadow-plum/20" : "bg-lilac text-ink hover:bg-plum/10"
            }`}
          >
            <span className="block font-medium">{c.code}</span>
            <span className="block max-w-64 truncate text-xs">{c.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
