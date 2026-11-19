import type { Metadata } from "next";
import { Suspense } from "react";
import { Urbanist } from "next/font/google";
import StudentSidebar from "./_components/StudentSidebar";
import Header from "./_components/Header";
import AppToaster from "./_components/AppToaster";
import ServerClock from "./_components/ServerClock";
import { requireStudent } from "@/lib/auth";
import { initials } from "@/lib/format";
import { getStudent } from "@/lib/students";

const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Dashboard | Stella College",
};

// The menu shows the student's name and email at the bottom
async function StudentMenu() {
  const session = await requireStudent();
  const student = await getStudent(session.sub);
  return <StudentSidebar me={{ name: student?.name ?? session.name, email: student?.email ?? "", initials: initials(student?.name ?? session.name) }} />;
}

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
      className={`${urbanist.variable} student-ui flex min-h-dvh flex-1 font-dm text-ink lg:gap-2 lg:p-3`}
    >
      <Suspense fallback={<StudentSidebar me={null} />}>
        <StudentMenu />
      </Suspense>
      <div className="portal-main relative flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<Header />}>
          <StudentHeader />
        </Suspense>
        <main className="flex-1 px-4 pb-6 sm:px-4 lg:px-4 lg:pt-4">
          <Suspense>{children}</Suspense>
        </main>
      </div>
      <AppToaster />
      <ServerClock />
    </div>
  );
}
