"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { logout } from "../../actions/auth";
import ThemeToggle from "../../components/ThemeToggle";
import {
  BookIcon,
  BoxIcon,
  ChatIcon,
  ClipboardIcon,
  CloseIcon,
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

const variants = {
  student: {
    home: "/dashboard",
    nav: [
      { label: "Dashboard", href: "/dashboard", icon: HomeIcon },
      { label: "Course", href: "/dashboard/course", icon: BoxIcon },
      { label: "Classroom", href: "/dashboard/classroom", icon: VideoIcon },
      { label: "Tickets", href: "/dashboard/tickets", icon: TicketIcon },
      { label: "User Guide", href: "/dashboard/user-guide", icon: BookIcon },
      { label: "Support", href: "/dashboard/support", icon: ChatIcon },
    ],
    help: {
      title: "Need Help?",
      text: "Book a meeting with our student support team anytime you need assistance.",
      cta: "Book Now",
      href: "/dashboard/support",
    },
  },
  trainer: {
    home: "/trainer",
    nav: [
      { label: "Dashboard", href: "/trainer", icon: HomeIcon },
      { label: "My tickets", href: "/trainer/tickets", icon: TicketIcon },
      { label: "Marking", href: "/trainer/marking", icon: ClipboardIcon },
      { label: "Students", href: "/trainer/students", icon: UsersIcon },
      { label: "Classroom", href: "/trainer/classroom", icon: VideoIcon },
    ],
    help: {
      title: "Trainer",
      text: "Answer your assigned tickets and mark the assessments students submit.",
      cta: "Contact admin",
      href: "mailto:admin@stellacollege.edu.au",
    },
  },
  admin: {
    home: "/superadmin",
    nav: [
      { label: "Overview", href: "/superadmin", icon: HomeIcon },
      { label: "Students", href: "/superadmin/students", icon: UsersIcon },
      { label: "Trainers", href: "/superadmin/trainers", icon: UserPlusIcon },
      { label: "Admins", href: "/superadmin/admins", icon: ShieldIcon, superOnly: true },
      { label: "Courses", href: "/superadmin/courses", icon: BoxIcon },
      { label: "Classroom", href: "/superadmin/classroom", icon: VideoIcon },
      { label: "Tickets", href: "/superadmin/tickets", icon: TicketIcon },
      { label: "Settings", href: "/superadmin/settings", icon: SettingsIcon },
    ],
    help: {
      title: "Super Admin",
      text: "You have full access to students, trainers, courses and portal settings.",
      cta: "Portal Settings",
      href: "/superadmin/settings",
    },
  },
} as const;

function SofaIllustration() {
  return (
    <svg viewBox="0 0 160 110" className="mx-auto mt-4 w-full max-w-[150px] [@media(max-height:760px)]:hidden" aria-hidden>
      <ellipse cx="80" cy="104" rx="70" ry="5" fill="#000" opacity="0.12" />
      <rect x="18" y="44" width="124" height="40" rx="10" fill="#6c5bd6" />
      <rect x="10" y="58" width="24" height="38" rx="8" fill="#5a49c4" />
      <rect x="126" y="58" width="24" height="38" rx="8" fill="#5a49c4" />
      <rect x="30" y="70" width="100" height="24" rx="6" fill="#7b6be0" />
      <rect x="22" y="94" width="6" height="8" rx="2" fill="#3e2f86" />
      <rect x="132" y="94" width="6" height="8" rx="2" fill="#3e2f86" />
      <circle cx="68" cy="22" r="8" fill="#f2b591" />
      <path d="M60 20c0-9 16-9 16 0v14h-4V22c-3 2-8 2-12-2Z" fill="#1d1b33" />
      <path d="M58 36c0-6 5-9 10-9s10 3 10 9v26H58Z" fill="#fdc580" />
      <path d="M62 62h22l8 22h-6l-7-16H62Z" fill="#2e4f6e" />
      <path d="M86 84h8v4h-9Z" fill="#1d1b33" />
      <rect x="74" y="44" width="26" height="17" rx="2" fill="#e8e6f5" transform="rotate(-8 87 52)" />
      <rect x="70" y="60" width="32" height="3" rx="1.5" fill="#cfcbe8" />
    </svg>
  );
}

type NavItem = (typeof variants)[PortalVariant]["nav"][number];
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
export default function Sidebar({ variant = "student", superAdmin = false }: { variant?: PortalVariant; superAdmin?: boolean }) {
  const base = variants[variant];
  const { home } = base;
  const nav = base.nav.filter((item) => superAdmin || !("superOnly" in item));
  const help =
    variant === "admin" && !superAdmin
      ? { ...base.help, title: "Admin", text: "You can manage students, trainers, courses and settings. Only Super Admin can change dates." }
      : base.help;
  const [open, setOpen] = useState(false);

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

        <nav className="mt-12 flex-1">
          <Suspense fallback={<NavLinks nav={nav} home={home} onNavigate={() => setOpen(false)} />}>
            <ActiveNavLinks nav={nav} home={home} onNavigate={() => setOpen(false)} />
          </Suspense>
        </nav>

        <div className="mt-6 rounded-xl bg-plum-light/70 p-4 text-white">
          <h3 className="text-base font-medium">{help.title}</h3>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/75">{help.text}</p>
          <Link
            href={help.href}
            onClick={() => setOpen(false)}
            className="mt-3 inline-block rounded-md bg-peach px-4 py-1.5 text-[11px] font-medium text-white transition hover:brightness-95"
          >
            {help.cta}
          </Link>
          <SofaIllustration />
        </div>

        <ThemeToggle look="menu" className="mt-4" />
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
    </>
  );
}
