import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCourse } from "@/lib/courses";
import { ASSESSMENT_PARTS } from "@/lib/assessment-meta";
import { agreedDeclaration, declarationRef, declarationTitle } from "@/lib/declaration";
import { formatStamp } from "@/lib/format";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getStudent } from "@/lib/students";
import { getSubmission } from "@/lib/submissions";
import { getTrainer } from "@/lib/trainers";

export const metadata: Metadata = { title: "Declaration | Stella College" };

// The declaration certificate made when a student submitted a Theory Task or Workplacement Task.
// The student sees their own; Super Admin, Admins and active trainers see all. "Download PDF" gives the same layout as a file
// (lib/declaration-pdf.ts) — keep the two in step.
export default function DeclarationPage(props: PageProps<"/declaration/[id]">) {
  return (
    <Suspense>
      <Certificate params={props.params} />
    </Suspense>
  );
}

async function Certificate({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) notFound();
  const sub = await getSubmission((await params).id);
  if (!sub?.content.declaration) notFound();

  const isOwner = session.role === "student" && session.sub === sub.studentId;
  const isAdmin = session.role === "admin";
  const isTrainer = session.role === "trainer" && !!(await getTrainer(session.sub))?.active;
  if (!isOwner && !isAdmin && !isTrainer) notFound();
  const text = agreedDeclaration(sub.content.declaration);
  const partLabel = ASSESSMENT_PARTS.find((p) => p.key === sub.part)?.label ?? sub.part;
  const submittedAt = sub.submittedAt ? formatStamp(new Date(sub.submittedAt)) : "—";

  const [student, course, { college }] = await Promise.all([getStudent(sub.studentId), getCourse(sub.courseCode), getSettings()]);

  const label = "text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5b3f99]";
  const value = "mt-0.5 text-[15px] font-semibold leading-snug text-[#1d1b33]";
  const detail = (l: string, v: string, wide = false) => (
    <div className={wide ? "col-span-2" : ""}>
      <p className={label}>{l}</p>
      <p className={value}>{v}</p>
    </div>
  );

  return (
    <main className="min-h-dvh bg-[#ecebf2] px-3 py-6 text-[#1d1b33] sm:py-10 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm font-semibold">Declaration</p>
        <a
          href={`/api/declaration/${sub.submissionId}`}
          className="rounded-full bg-[#5b3f99] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7a62b3]"
        >
          Download PDF
        </a>
      </div>

      <article className="mx-auto max-w-5xl border-2 border-[#5b3f99] bg-white p-1.5 shadow-xl print:max-w-none print:shadow-none">
        <div className="border border-[#b8933f] px-5 pb-5 pt-0 sm:px-9 sm:pb-7">
          <div className="-mx-5 h-1.5 bg-[#5b3f99] sm:-mx-9" />

          <header className="flex flex-wrap items-center justify-between gap-5 pb-4 pt-5">
            <div className="flex items-center gap-4">
              <Image src="/stella-logo.png" alt="Stella College" width={400} height={207} className="h-16 w-auto" />
              <div className="border-l-2 border-[#b8933f] pl-4">
                <p className="text-lg font-bold">{college.name || "Stella College"}</p>
                {college.rto && <p className="text-sm font-medium">RTO {college.rto}</p>}
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a6a1f]">Student declaration</p>
              <h1 className="mt-1 text-2xl font-bold text-[#5b3f99] sm:text-[1.75rem]">{declarationTitle(sub.part)}</h1>
              <p className="mt-1 text-sm font-medium">Reference {declarationRef(sub.submissionId)}</p>
            </div>
          </header>

          <div className="h-px bg-[#b8933f]" />

          {/* Details beside the photo, then the declaration across the full width (points in two columns on wide screens) */}
          <section className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_190px]">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-[#e2dcf2] bg-[#f6f4fc] px-5 py-4">
              {detail("Student", student?.name ?? sub.studentName)}
              {detail("Student ID", sub.studentId)}
              {detail("Course code", sub.courseCode)}
              {detail("Unit code", sub.unitCode)}
              {detail("Course name", course?.name ?? "", true)}
              {detail("Unit name", sub.unitTitle, true)}
              {detail("Assessment part", partLabel)}
              {detail("Date and time of submission", submittedAt)}
            </div>
            <figure className="flex flex-col rounded-lg border border-[#e2dcf2] p-2.5 sm:max-md:w-56">
              {sub.photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file route
                <img
                  src={`/api/files/${sub.photo.id}`}
                  alt={`Photo of ${sub.studentName} taken at submission`}
                  className="aspect-[4/3] w-full flex-1 rounded-md object-cover"
                />
              ) : (
                <div className="grid aspect-[4/3] flex-1 place-items-center rounded-md bg-[#f6f4fc] text-sm font-medium">No photo was taken</div>
              )}
              <figcaption className={`mt-2 text-center ${label}`}>Photo taken at submission</figcaption>
            </figure>
          </section>

          <section className="mt-5">
            <h2 className="text-lg font-bold text-[#5b3f99]">Declaration</h2>
            <p className="mt-1 text-[15px] font-semibold">{text.intro}</p>
            <ol className="mt-3 gap-x-8 lg:columns-2">
              {text.points.map((p, i) => (
                <li key={i} className="mb-2 flex break-inside-avoid gap-2.5 text-sm leading-snug">
                  <span aria-hidden className="mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded bg-[#5b3f99] text-[11px] font-bold text-white">
                    ✓
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-[#5b3f99] bg-[#f6f4fc] px-4 py-2.5">
              <span aria-hidden className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded bg-[#5b3f99] text-[11px] font-bold text-white">
                ✓
              </span>
              <p className="text-[15px] font-bold">{text.agree}</p>
            </div>
          </section>

          {(college.email || college.phone) && (
            <footer className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 border-t border-[#e2dcf2] pt-4 text-sm">
              {college.email && (
                <p>
                  <span className="font-semibold text-[#5b3f99]">Email</span> <span className="font-medium">{college.email}</span>
                </p>
              )}
              {college.email && college.phone && <span aria-hidden className="hidden h-4 w-px bg-[#b8933f] sm:block" />}
              {college.phone && (
                <p>
                  <span className="font-semibold text-[#5b3f99]">Phone</span> <span className="font-medium">{college.phone}</span>
                </p>
              )}
            </footer>
          )}
        </div>
      </article>
    </main>
  );
}
