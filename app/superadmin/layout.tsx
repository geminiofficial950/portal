import type { Metadata } from "next";
import { Suspense } from "react";
import { DM_Sans } from "next/font/google";
import Sidebar from "../dashboard/_components/Sidebar";
import Header from "../dashboard/_components/Header";
import AppToaster from "../dashboard/_components/AppToaster";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Super Admin | Stella College",
};

export default function SuperAdminLayout({ children }: LayoutProps<"/superadmin">) {
  return (
    <div
      id="portal-root"
      className={`${dmSans.variable} flex min-h-dvh flex-1 bg-plum font-dm text-ink lg:p-4 lg:pl-0`}
    >
      <Sidebar variant="admin" />
      <div className="flex min-w-0 flex-1 flex-col bg-white lg:rounded-[2rem]">
        <Header variant="admin" />
        <main className="flex-1 px-4 pb-8 sm:px-8 lg:px-10">
          <Suspense>{children}</Suspense>
        </main>
      </div>
      <AppToaster />
    </div>
  );
}
