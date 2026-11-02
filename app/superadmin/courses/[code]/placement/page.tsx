import Link from "next/link";
import { notFound } from "next/navigation";
import { BackIcon } from "../../../../dashboard/_components/icons";
import PlacementAdmin from "./PlacementAdmin";
import { requireAdmin } from "@/lib/auth";
import { getCourse } from "@/lib/courses";
import { countSigned, listPlacementDocs } from "@/lib/documents";

// Super Admin: a course's placement information and the forms students sign and upload
export default async function PlacementPage(props: PageProps<"/superadmin/courses/[code]/placement">) {
  await requireAdmin();
  const course = await getCourse(decodeURIComponent((await props.params).code));
  if (!course) notFound();
  const docs = await listPlacementDocs([course.code]);
  const signed = await countSigned(docs.map((d) => d.docId));

  return (
    <div className="animate-fade-up space-y-6">
      <Link href="/superadmin/courses" className="inline-flex items-center gap-2 text-sm text-ink transition hover:text-plum">
        <BackIcon className="h-4 w-4" />
        All courses
      </Link>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-plum">{course.code}</p>
        <h1 className="mt-1 text-2xl font-medium text-ink">Placement · {course.name}</h1>
        <p className="mt-1 text-sm text-ink">Students of this course see this on their Course page, below “Go to my units”.</p>
      </div>
      <PlacementAdmin courseCode={course.code} initialText={course.placementText} initialDocs={docs} signedCounts={signed} />
    </div>
  );
}
