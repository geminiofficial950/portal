"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { logout } from "../../actions/auth";
import ThemeToggle from "../../components/ThemeToggle";
import { BookIcon, BoxIcon, ChatIcon, ClipboardIcon, CloseIcon, CompressIcon, ExpandIcon, HomeIcon, LogoutIcon, MenuIcon, TicketIcon, VideoIcon } from "./icons";
import { readFull, setFull, subscribeFull } from "./Sidebar";

// The student's menu: light glass panel, each item an icon in a round chip, the open page as a dark pill,
// grouped under small headings, and the student's own card at the bottom. Same pages and links as before.
const GROUPS = [
  {
    heading: "Menu",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: HomeIcon },
      { label: "Courses", href: "/dashboard/course", icon: BoxIcon },
      { label: "My classes", href: "/dashboard/classroom", icon: VideoIcon },
    ],
  },
  {
    heading: "My work",
    items: [
      { label: "Requests", href: "/dashboard/requests", icon: ClipboardIcon },
      { label: "Feedback", href: "/dashboard/feedback", icon: ChatIcon },
    ],
  },
  {
    heading: "Help",
    items: [
      { label: "Student support", href: "/dashboard/tickets", icon: TicketIcon },
      { label: "Portal help", href: "/dashboard/user-guide", icon: BookIcon },
    ],
  },
] as const;

// A unit page (/dashboard/assessment/…) is part of Courses
const ALSO_ACTIVE: Record<string, string[]> = { "/dashboard/course": ["/dashboard/assessment"] };
const isActive = (href: string, pathname: string | null) =>
  pathname !== null && (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href) || (ALSO_ACTIVE[href] ?? []).some((p) => pathname.startsWith(p)));

type Me = { name: string; email: string; initials: string } | null;

function ActiveLinks({ onNavigate }: { onNavigate: () => void }) {
  return <Links onNavigate={onNavigate} pathname={usePathname()} />;
}

function Links({ onNavigate, pathname = null }: { onNavigate: () => void; pathname?: string | null }) {
  return (
    <div className="space-y-6">
      {GROUPS.map((g) => (
        <div key={g.heading}>
          <p className="mb-2 px-2 text-sm font-semibold text-ink">{g.heading}</p>
          <ul className="space-y-1">
            {g.items.map(({ label, href, icon: Icon }) => {
              const active = isActive(href, pathname);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-full p-1.5 pr-4 text-[15px] font-medium transition ${
                      active ? "bg-[var(--s-dark)] text-white" : "text-ink hover:bg-[var(--s-card)]"
                    }`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${active ? "bg-white/15 text-white" : "bg-[var(--s-icon)] text-ink"}`}>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function StudentSidebar({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const full = useSyncExternalStore(subscribeFull, readFull, () => false);

  // The layout's #portal-root carries the flag; globals.css hides the menu and widens the page
  useEffect(() => {
    const root = document.getElementById("portal-root");
    if (root) root.dataset.full = full ? "1" : "";
  }, [full]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* phone / tablet top bar */}
      <div className="portal-sidebar fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--s-line)] bg-[var(--s-card)] px-4 lg:hidden">
        <Image src="/stella-logo.png" alt="Stella College" width={400} height={207} className="h-10 w-auto" />
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-full bg-[var(--s-soft)] text-ink">
          <MenuIcon className="h-5 w-5" />
        </button>
      </div>

      <div onClick={() => setOpen(false)} className={`fixed inset-0 z-40 bg-ink/40 transition-opacity lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />

      <aside
        aria-label="Student menu"
        className={`portal-sidebar no-scrollbar fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col overflow-y-auto bg-[var(--s-card)] px-4 py-5 transition-transform duration-300 lg:sticky lg:top-3 lg:z-auto lg:h-[calc(100dvh-1.5rem)] lg:translate-x-0 lg:rounded-[1.75rem] lg:border lg:border-[var(--s-line)] lg:bg-[var(--s-sidebar-glass)] lg:backdrop-blur-md ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-1">
          <Image src="/stella-logo.png" alt="Stella College" width={400} height={207} preload className="h-12 w-auto" />
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-9 w-9 place-items-center rounded-full text-ink hover:bg-[var(--s-soft)] lg:hidden">
            <CloseIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setFull(true)}
            aria-label="Full screen (hide menu)"
            title="Full screen (hide menu)"
            className="hidden h-9 w-9 place-items-center rounded-full text-ink transition hover:bg-[var(--s-card)] lg:grid"
          >
            <ExpandIcon className="h-[18px] w-[18px]" />
          </button>
        </div>
        <p className="mt-2 px-1 text-sm font-semibold text-ink">Student Portal</p>

        <nav className="mt-6 flex-1">
          <Suspense fallback={<Links onNavigate={() => setOpen(false)} />}>
            <ActiveLinks onNavigate={() => setOpen(false)} />
          </Suspense>
        </nav>

        {/* the student's card */}
        <div className="mt-6 s-card rounded-[1.5rem] p-3">
          <div className="flex items-center gap-2">
            <ThemeToggle look="icon" />
            <form action={logout}>
              <button
                type="submit"
                aria-label="Logout"
                title="Logout"
                className="grid h-10 w-10 place-items-center rounded-full bg-[var(--s-soft)] text-ink transition hover:bg-[var(--s-dark)] hover:text-white"
              >
                <LogoutIcon className="h-5 w-5" />
              </button>
            </form>
          </div>
          <div className="mt-3 flex items-center gap-3 border-t border-[var(--s-line)] pt-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--s-dark)] text-sm font-bold text-white">{me?.initials ?? ""}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{me?.name ?? " "}</span>
              <span className="block truncate text-xs text-ink">{me?.email ?? ""}</span>
            </span>
          </div>
        </div>
      </aside>

      {/* Full screen is on: one button brings the menu back */}
      {full && (
        <button
          type="button"
          onClick={() => setFull(false)}
          className="fixed bottom-4 left-4 z-40 hidden items-center gap-2 rounded-full bg-[var(--s-dark)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg lg:flex"
        >
          <CompressIcon className="h-4 w-4" />
          Show menu
        </button>
      )}
    </>
  );
}
