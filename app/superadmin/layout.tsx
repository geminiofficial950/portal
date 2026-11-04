import type { Metadata } from "next";
import { Suspense } from "react";
import { DM_Sans } from "next/font/google";
import Sidebar from "../dashboard/_components/Sidebar";
import Header from "../dashboard/_components/Header";
import AppToaster from "../dashboard/_components/AppToaster";
import { requireAdmin } from "@/lib/auth";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Admin | Stella College",
};

// Super Admin sees "Admins" in the menu; Admin accounts don't
async function AdminSidebar() {
  const admin = await requireAdmin();
  return <Sidebar variant="admin" superAdmin={admin.isSuper} />;
}

export default function SuperAdminLayout({ children }: LayoutProps<"/superadmin">) {
  return (
    <div
      id="portal-root"
      className={`${dmSans.variable} flex min-h-dvh flex-1 bg-plum font-dm text-ink lg:p-2 lg:pl-0`}
    >
      <Suspense fallback={<Sidebar variant="admin" />}>
        <AdminSidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col bg-page lg:rounded-[2rem]">
        <Header variant="admin" />
        <main className="flex-1 px-4 pb-6 sm:px-4 lg:px-4">
          <Suspense>{children}</Suspense>
        </main>
      </div>
      <AppToaster />
    </div>
  );
}
