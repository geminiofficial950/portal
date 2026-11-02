import type { Metadata } from "next";
import { Suspense } from "react";
import { DM_Sans } from "next/font/google";
import Sidebar from "../dashboard/_components/Sidebar";
import Header from "../dashboard/_components/Header";
import AppToaster from "../dashboard/_components/AppToaster";
import { requireTrainer } from "@/lib/auth";
import { initials } from "@/lib/format";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Trainer | Stella College",
};

// Session data streams in behind Suspense so the shell can render first
async function TrainerHeader() {
  const trainer = await requireTrainer();
  return <Header variant="trainer" user={{ initials: initials(trainer.name), email: trainer.email }} />;
}

export default function TrainerLayout({ children }: LayoutProps<"/trainer">) {
  return (
    <div
      id="portal-root"
      className={`${dmSans.variable} flex min-h-dvh flex-1 bg-plum font-dm text-ink lg:p-2 lg:pl-0`}
    >
      <Sidebar variant="trainer" />
      <div className="flex min-w-0 flex-1 flex-col bg-panel lg:rounded-[2rem]">
        <Suspense fallback={<Header variant="trainer" />}>
          <TrainerHeader />
        </Suspense>
        <main className="flex-1 px-4 pb-6 sm:px-4 lg:px-4">
          <Suspense>{children}</Suspense>
        </main>
      </div>
      <AppToaster />
    </div>
  );
}
