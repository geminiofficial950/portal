import { listAdmins } from "@/lib/admins";
import { requireSuperAdmin } from "@/lib/auth";
import AdminsClient from "./AdminsClient";

export default async function AdminsPage() {
  await requireSuperAdmin();
  return <AdminsClient initialAdmins={await listAdmins()} />;
}
