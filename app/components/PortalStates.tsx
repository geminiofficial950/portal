"use client";

import Link from "next/link";

// Shared loading / error / no-access states for the three portals (LMS guide: clear loading, error and
// permission-denied states, and every lock explains why and what to do next)

export function PortalLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-4 py-6">
      <div className="h-8 w-64 rounded-xl bg-lilac" />
      <div className="h-24 rounded-[1.5rem] bg-lilac/70" />
      <div className="h-24 rounded-[1.5rem] bg-lilac/70" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function PortalError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="mx-auto my-10 max-w-lg space-y-3 rounded-[1.5rem] border border-rose-200 bg-rose-50 p-6 text-center">
      <p className="text-lg font-semibold text-rose-900">Something went wrong loading this page</p>
      <p className="text-base text-ink">Nothing you saved has been lost. Try again; if it keeps happening, contact the college.</p>
      <button onClick={reset} className="rounded-xl bg-plum px-5 py-2.5 text-sm font-semibold text-white hover:bg-plum-light">
        Try again
      </button>
    </div>
  );
}

export function PortalNotFound({ home }: { home: string }) {
  return (
    <div className="mx-auto my-10 max-w-lg space-y-3 rounded-[1.5rem] border border-ink/10 bg-white p-6 text-center">
      <p className="text-lg font-semibold text-ink">This page isn’t available to you</p>
      <p className="text-base text-ink">It may not exist, or your account doesn’t have access to it (for example, a unit that isn’t assigned to you).</p>
      <Link href={home} className="inline-block rounded-xl bg-plum px-5 py-2.5 text-sm font-semibold text-white hover:bg-plum-light">
        Back to your portal
      </Link>
    </div>
  );
}
