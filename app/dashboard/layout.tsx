import type { Metadata } from "next";
import { Suspense } from "react";
import { DM_Sans } from "next/font/google";
import Sidebar from "./_components/Sidebar";
import Header from "./_components/Header";
import AppToaster from "./_components/AppToaster";
import { requireStudent } from "@/lib/auth";
import { initials } from "@/lib/format";
import { getStudent } from "@/lib/students";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Dashboard | Stella College",
};

// Session data streams in behind Suspense so the shell can render first
async function StudentHeader() {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  return <Header user={{ initials: initials(student?.name ?? session.name), email: student?.email ?? "" }} />;
}

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div
      id="portal-root"
      className={`${dmSans.variable} flex min-h-dvh flex-1 bg-plum font-dm text-ink lg:p-2 lg:pl-0`}
    >
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col bg-page lg:rounded-[2rem]">
        <Suspense fallback={<Header />}>
          <StudentHeader />
        </Suspense>
        <main className="flex-1 px-4 pb-6 sm:px-4 lg:px-4">
          <Suspense>{children}</Suspense>
        </main>
      </div>
      <AppToaster />
    </div>
  );
}
