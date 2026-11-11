"use client";

import toast from "react-hot-toast";
import { CheckIcon, CloseIcon } from "../../dashboard/_components/icons";

export type Credentials = { title: string; idLabel: string; id: string; email: string; password: string };

// Shown once after creating a login or resetting a password — the password is never stored in plain text.
export default function CredentialsCard({ credentials, onClose }: { credentials: Credentials; onClose: () => void }) {
  const copy = async () => {
    const text = `Stella College portal login\n${credentials.idLabel}: ${credentials.id}\nEmail: ${credentials.email}\nPassword: ${credentials.password}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Login details copied");
    } catch {
      toast.error("Couldn’t copy — please note them down");
    }
  };

  return (
    <div className="relative rounded-[1.75rem] bg-plum p-5 text-white shadow-lg shadow-plum/25 sm:p-6">
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 rounded-full p-1.5 text-white hover:bg-white/10 hover:text-white"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
      <p className="flex items-center gap-2 text-sm font-medium">
        <CheckIcon className="h-4 w-4 text-peach" />
        {credentials.title}
      </p>
      <p className="mt-1 text-xs text-white">Share these login details. The password won’t be shown again.</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          [credentials.idLabel, credentials.id],
          ["Email", credentials.email],
          ["Password", credentials.password],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-xl bg-white/10 px-4 py-3">
            <dt className="text-[10px] uppercase tracking-wide text-white">{label}</dt>
            <dd className="mt-0.5 truncate font-mono text-sm">{value}</dd>
          </div>
        ))}
      </dl>
      <button
        onClick={copy}
        className="mt-4 rounded-full bg-peach px-5 py-2 text-xs font-medium text-white transition hover:brightness-95"
      >
        Copy login details
      </button>
    </div>
  );
}
