"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { logout } from "../../actions/auth";
import ThemeToggle from "../../components/ThemeToggle";
import {
  BookIcon,
  BoxIcon,
  CalendarIcon,
  ChatIcon,
  ClipboardIcon,
  CloseIcon,
  CompressIcon,
  ExpandIcon,
  HomeIcon,
  LogoutIcon,
  MenuIcon,
  SettingsIcon,
  TicketIcon,
  UserPlusIcon,
  ShieldIcon,
  UsersIcon,
  VideoIcon,
} from "./icons";

export type PortalVariant = "student" | "trainer" | "admin";

// A unit page (/dashboard/assessment/…) is part of the student's Course
const ALSO_ACTIVE: Record<string, string[]> = { "/dashboard/course": ["/dashboard/assessment"] };

// Navigation per portal, as named in the LMS guide
const variants = {
  student: {
    title: "Student Portal",
    home: "/dashboard",
    nav: [
      { label: "Dashboard", href: "/dashboard", icon: HomeIcon },
      { label: "Courses", href: "/dashboard/course", icon: BoxIcon },
      { label: "My classes", href: "/dashboard/classroom", icon: VideoIcon },
      { label: "Requests", href: "/dashboard/requests", icon: ClipboardIcon },
      { label: "Feedback", href: "/dashboard/feedback", icon: ChatIcon },
      { label: "Help", href: "/dashboard/user-guide", icon: BookIcon },
      { label: "Support", href: "/dashboard/tickets", icon: TicketIcon },
    ],
  },
  trainer: {
    title: "Trainer Portal",
    home: "/trainer",
    nav: [
      { label: "Dashboard", href: "/trainer", icon: HomeIcon },
      { label: "My batches", href: "/trainer/batches", icon: UsersIcon },
      { label: "Assigned units", href: "/trainer/units", icon: BookIcon },
      { label: "Submissions", href: "/trainer/marking", icon: ClipboardIcon },
      { label: "Feedback reviews", href: "/trainer/reviews", icon: ChatIcon },
      { label: "Extension requests", href: "/trainer/extensions", icon: CalendarIcon },
      { label: "Students", href: "/trainer/students", icon: UserPlusIcon },
      { label: "Classes", href: "/trainer/classroom", icon: VideoIcon },
      { label: "Support", href: "/trainer/tickets", icon: TicketIcon },
    ],
  },
  admin: {
    title: "Admin Portal",
    home: "/superadmin",
    nav: [
      { label: "Overview", href: "/superadmin", icon: HomeIcon },
      { label: "Courses", href: "/superadmin/courses", icon: BoxIcon },
      { label: "Students", href: "/superadmin/students", icon: UsersIcon },
      { label: "Trainers", href: "/superadmin/trainers", icon: UserPlusIcon },
      { label: "Batches", href: "/superadmin/batches", icon: CalendarIcon },
      { label: "Classes", href: "/superadmin/classroom", icon: VideoIcon },
      { label: "Requests", href: "/superadmin/requests", icon: ClipboardIcon },
      { label: "Admins", href: "/superadmin/admins", icon: ShieldIcon, superOnly: true },
      { label: "Support", href: "/superadmin/tickets", icon: TicketIcon },
      { label: "Settings", href: "/superadmin/settings", icon: SettingsIcon },
    ],
  },
} as const;

// Full screen: hides the purple menu so the white page fills the screen (desktop). Remembered in this browser.
const FULL_KEY = "portal-full";
const FULL_EVENT = "portal-full-change";
const subscribeFull = (cb: () => void) => {
  window.addEventListener(FULL_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(FULL_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
const readFull = () => {
  try {
    return localStorage.getItem(FULL_KEY) === "1";
  } catch {
    return false;
  }
};
const setFull = (on: boolean) => {
  try {
    localStorage.setItem(FULL_KEY, on ? "1" : "0");
  } catch {
    // private window: it still works until the page reloads
  }
  window.dispatchEvent(new Event(FULL_EVENT));
};

type NavItem = Omit<(typeof variants)[PortalVariant]["nav"][number], "href"> & { href: string }; // href may be /admin/… for Admin accounts
type NavLinksProps = { nav: readonly NavItem[]; home: string; onNavigate: () => void };

// Reading the URL suspends during prerender, so the plain list doubles as the fallback.
function ActiveNavLinks(props: NavLinksProps) {
  return <NavLinks {...props} pathname={usePathname()} />;
}

function NavLinks({ nav, home, onNavigate, pathname = null }: NavLinksProps & { pathname?: string | null }) {
  return (
    <ul className="space-y-2">
      {nav.map(({ label, href, icon: Icon }) => {
        const active =
          pathname !== null &&
          (href === home ? pathname === home : pathname.startsWith(href) || (ALSO_ACTIVE[href] ?? []).some((p) => pathname.startsWith(p)));
        return (
          <li key={label}>
            <Link
              href={href}
              onClick={onNavigate}
              className={`relative -ml-4 flex items-center gap-4 py-2.5 pl-4 text-sm transition ${
                active ? "text-peach" : "text-white/85 hover:text-white"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-peach" />
              )}
              <Icon className="h-6 w-6 shrink-0" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// superAdmin: the .env Super Admin (vs an Admin account) — only they get "Admins"
// `superAdmin` is unknown (undefined) while the admin layout is still loading; links stay on /superadmin until it's known
export default function Sidebar({ variant = "student", superAdmin }: { variant?: PortalVariant; superAdmin?: boolean }) {
  const base = variants[variant];
  // Admin accounts see the admin pages under /admin instead of /superadmin (proxy.ts)
  const asAdmin = variant === "admin" && superAdmin === false;
  const href = (h: string) => (asAdmin ? h.replace(/^\/superadmin/, "/admin") : h);
  const home = href(base.home);
  const nav = base.nav.filter((item) => !!superAdmin || !("superOnly" in item)).map((item) => ({ ...item, href: href(item.href) }));
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
      <div className="portal-sidebar fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between bg-plum px-4 lg:hidden">
        <Image src="/stella-logo.png" alt="Stella College" width={400} height={207} className="h-10 w-auto" />
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-2 text-white hover:bg-white/10"
        >
          <MenuIcon className="h-6 w-6" />
        </button>
      </div>

      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-ink/50 transition-opacity lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />

      <aside
        className={`portal-sidebar no-scrollbar fixed inset-y-0 left-0 z-50 flex w-56 shrink-0 flex-col overflow-y-auto bg-plum px-4 py-8 transition-transform duration-300 lg:sticky lg:top-2 lg:z-auto lg:h-[calc(100dvh-1rem)] lg:translate-x-0 lg:py-4 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between">
          <Image
            src="/stella-logo.png"
            alt="Stella College"
            width={400}
            height={207}
            preload
            className="h-16 w-auto"
          />
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 lg:hidden"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-sm font-semibold tracking-wide text-white">{base.title}</p>
        <nav className="mt-8 flex-1">
          <Suspense fallback={<NavLinks nav={nav} home={home} onNavigate={() => setOpen(false)} />}>
            <ActiveNavLinks nav={nav} home={home} onNavigate={() => setOpen(false)} />
          </Suspense>
        </nav>

        <button
          type="button"
          onClick={() => setFull(true)}
          className="mt-4 hidden w-full items-center gap-3 rounded-lg px-1 py-2 text-sm text-white transition hover:text-peach lg:flex"
        >
          <ExpandIcon className="h-5 w-5" />
          Full screen (hide menu)
        </button>
        <ThemeToggle look="menu" className="mt-1" />
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-sm text-white/75 transition hover:text-white"
          >
            <LogoutIcon className="h-5 w-5" />
            Logout
          </button>
        </form>
      </aside>

      {/* Full screen is on: one button brings the menu back */}
      {full && (
        <button
          type="button"
          onClick={() => setFull(false)}
          className="fixed bottom-4 left-4 z-40 hidden items-center gap-2 rounded-full bg-plum px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-plum-light lg:flex"
        >
          <CompressIcon className="h-4 w-4" />
          Show menu
        </button>
      )}
    </>
  );
}
