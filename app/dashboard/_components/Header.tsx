"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { BellIcon, BroadcastIcon, SearchIcon } from "./icons";
import type { PortalVariant } from "./Sidebar";

type HeaderUser = { initials: string; email: string };

const users: Record<PortalVariant, HeaderUser> = {
  student: { initials: "ST", email: "student@stellacollege.edu.au" },
  trainer: { initials: "TR", email: "Trainer" },
  admin: { initials: "SA", email: "admin@stellacollege.edu.au" },
};

const titles: Record<string, string> = {
  "/superadmin": "Super Admin overview",
  "/superadmin/students": "Student management",
  "/superadmin/trainers": "Trainers",
  "/superadmin/courses": "Course management",
  "/superadmin/tickets": "Support tickets",
  "/superadmin/settings": "Portal settings",
  "/trainer": "My tickets",
  "/trainer/marking": "Assessment marking",
  "/trainer/students": "Students & results",
  "/dashboard": "Welcome back",
  "/dashboard/assessment": "Assessment hub",
  "/dashboard/course": "My course",
  "/dashboard/tickets": "Need help?",
  "/dashboard/user-guide": "How do I…?",
  "/dashboard/support": "Support desk",
};

function HeaderTitle() {
  const pathname = usePathname();
  const title =
    titles[pathname] ??
    (pathname.startsWith("/superadmin/courses/")
      ? "Unit"
      : pathname.startsWith("/trainer/marking/course/")
      ? "Assessment marking"
      : pathname.startsWith("/trainer/marking/") || pathname.startsWith("/superadmin/marking/")
      ? "Review submission"
      : pathname.startsWith("/trainer/students/") || pathname.startsWith("/superadmin/students/")
      ? "Student progress"
      : pathname.startsWith("/dashboard/assessment/")
        ? "Open assessment"
        : "Stella Portal");

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-lilac px-4 py-3 text-sm text-plum/80 sm:text-base">
      <BroadcastIcon className="h-5 w-5 text-plum/60" />
      {title}
    </div>
  );
}

// `user` overrides the variant's placeholder with the signed-in person (fetched by the layout)
export default function Header({ variant = "student", user = users[variant] }: { variant?: PortalVariant; user?: HeaderUser }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-4 pb-6 pt-22 sm:px-8 lg:px-10 lg:pt-6">
      <Suspense
        fallback={
          <div className="flex items-center gap-3 rounded-2xl bg-lilac px-4 py-3 text-sm text-plum/80 sm:text-base">
            <BroadcastIcon className="h-5 w-5 text-plum/60" />
            Stella Portal
          </div>
        }
      >
        <HeaderTitle />
      </Suspense>

      <div className="flex items-center gap-4 sm:gap-5">
        <label className="hidden items-center gap-2 rounded-full bg-lilac px-3 py-2 md:flex">
          <SearchIcon className="h-4 w-4 text-plum/50" />
          <input
            placeholder="Search…"
            className="w-36 bg-transparent text-sm text-ink outline-none placeholder:text-ink/35 lg:w-44"
          />
        </label>
        <button aria-label="Notifications" className="relative text-plum">
          <BellIcon className="h-5 w-5" />
          <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-peach ring-2 ring-white" />
        </button>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-peach text-sm font-bold text-white">
            {user.initials}
          </span>
          <span className="hidden text-sm text-ink/80 sm:block">
            {user.email}
          </span>
        </div>
      </div>
    </header>
  );
}
