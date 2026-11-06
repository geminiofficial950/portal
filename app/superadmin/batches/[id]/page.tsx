import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import BatchDetail from "../BatchDetail";
import { loadBatchDetail } from "../load";

export default async function BatchPage(props: PageProps<"/superadmin/batches/[id]">) {
  const admin = await requireAdmin();
  const data = await loadBatchDetail(decodeURIComponent((await props.params).id));
  if (!data) notFound();
  return <BatchDetail data={data} role="admin" canDelete={admin.isSuper} initialTab={typeof (await props.searchParams).tab === "string" ? String((await props.searchParams).tab) : undefined} backHref={admin.isSuper ? "/superadmin/batches" : "/admin/batches"} />;
}
