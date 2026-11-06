import Link from "next/link";
import LocalTime from "../assessment/_components/LocalTime";
import { requireStudent } from "@/lib/auth";
import { listExtensionRequests } from "@/lib/deadlines";
import { listRequests } from "@/lib/documents";

const tone = { Pending: "bg-amber-100 text-amber-900", Approved: "bg-emerald-100 text-emerald-800", Declined: "bg-rose-100 text-rose-800" } as const;

// The student's requests: extension requests they made, and documents the college asked them for
export default async function StudentRequestsPage() {
  const session = await requireStudent();
  const [extensions, documents] = await Promise.all([listExtensionRequests({ studentId: session.sub }), listRequests(session.sub)]);
  return (
    <div className="animate-fade-up space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Requests</h1>
        <p className="mt-1 text-base text-ink">Your extension requests and the documents the college has asked you for.</p>
      </div>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-ink">Extension requests</h2>
        {extensions.map((r) => (
          <div key={r.requestId} className="rounded-[1.5rem] border border-ink/10 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-semibold text-ink">
                {r.moduleTitle} · {r.unitCode}
              </p>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${tone[r.status]}`}>{r.status}</span>
            </div>
            <p className="mt-1 text-base text-ink">
              You asked for <LocalTime iso={r.proposedDue} />: “{r.reason}”
            </p>
            {r.status === "Approved" && r.newDue && (
              <p className="mt-1 text-base font-semibold text-emerald-800">
                New due date: <LocalTime iso={r.newDue} />
              </p>
            )}
            {r.status === "Declined" && <p className="mt-1 text-base text-rose-800">Reason: {r.decisionReason}</p>}
          </div>
        ))}
        {!extensions.length && <p className="rounded-[1.5rem] bg-lilac/70 px-5 py-6 text-base text-ink">No extension requests yet.</p>}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-ink">Documents requested by the college</h2>
        {documents.map((d) => (
          <div key={d.requestId} className="flex flex-wrap items-center justify-between gap-2 rounded-[1.5rem] border border-ink/10 bg-white p-5">
            <span className="text-lg font-semibold text-ink">{d.name}</span>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${d.file ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{d.file ? "Uploaded" : "Needed"}</span>
          </div>
        ))}
        {!documents.length && <p className="rounded-[1.5rem] bg-lilac/70 px-5 py-6 text-base text-ink">No documents requested.</p>}
        <Link href="/dashboard/course" className="inline-block text-base font-semibold text-plum underline">
          Upload documents on your course page
        </Link>
      </section>
    </div>
  );
}
