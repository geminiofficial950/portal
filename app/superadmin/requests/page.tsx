import ExtensionInbox from "../../trainer/extensions/ExtensionInbox";
import { requireAdmin } from "@/lib/auth";
import { listExtensionRequests } from "@/lib/deadlines";

// Admin: every extension request
export default async function AdminRequestsPage() {
  await requireAdmin();
  const requests = await listExtensionRequests();
  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink sm:text-[1.65rem]">Requests</h1>
        <p className="mt-1 text-sm text-ink">Students’ extension requests. Approving sets a new deadline for that student and module only; it never changes a result.</p>
      </div>
      <ExtensionInbox initial={requests} />
    </div>
  );
}
