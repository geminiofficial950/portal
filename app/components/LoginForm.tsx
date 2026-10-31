"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "../actions/auth";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="animate-fade-up relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-linear-to-b from-[#1520e0] to-royal px-6 py-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] ring-1 ring-white/15 sm:px-8 sm:py-10">
      {/* Soft glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />

      <h1 className="text-center text-2xl font-semibold uppercase leading-tight tracking-wide text-white sm:text-[1.75rem]">
        Login to your
        <br />
        account
      </h1>

      <form action={formAction} className="mt-7 space-y-4">
        <label className="flex h-14 items-center gap-3 rounded-xl bg-white px-4 text-slate-900 shadow-sm ring-gold transition focus-within:ring-[3px]">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-slate-700" aria-hidden>
            <path d="M2 6.5A2.5 2.5 0 0 1 4.5 4h15A2.5 2.5 0 0 1 22 6.5v.3l-10 6.2L2 6.8v-.3Zm0 2.65V17.5A2.5 2.5 0 0 0 4.5 20h15a2.5 2.5 0 0 0 2.5-2.5V9.15l-9.47 5.87a1 1 0 0 1-1.06 0L2 9.15Z" />
          </svg>
          <span className="sr-only">Student ID or email</span>
          <input
            name="username"
            type="text"
            autoComplete="username"
            placeholder="Student ID or email"
            defaultValue={state.username}
            required
            className="w-full min-w-0 bg-transparent text-sm font-medium outline-none placeholder:text-slate-500"
          />
        </label>

        <label className="flex h-14 items-center gap-3 rounded-xl bg-white px-4 text-slate-900 shadow-sm ring-gold transition focus-within:ring-[3px]">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-slate-700" aria-hidden>
            <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z" />
          </svg>
          <span className="sr-only">Password</span>
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Password"
            required
            className="w-full min-w-0 bg-transparent text-sm font-medium outline-none placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="shrink-0 rounded p-1 text-slate-500 transition hover:text-slate-800"
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
                <path d="M3.3 2.3 2 3.6l3.1 3.1A11.6 11.6 0 0 0 1 12c1.7 4.4 6 7.5 11 7.5 1.8 0 3.5-.4 5-1.1l3.4 3.4 1.3-1.3L3.3 2.3ZM12 17a5 5 0 0 1-4.6-7l1.6 1.6a3 3 0 0 0 3.4 3.4l1.6 1.6c-.6.3-1.3.4-2 .4Zm11-5c-.7 1.9-2 3.6-3.6 4.8l-2.5-2.5A5 5 0 0 0 10.7 7l-2-2c1-.3 2.1-.5 3.3-.5 5 0 9.3 3.1 11 7.5Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
                <path d="M12 4.5c-5 0-9.3 3.1-11 7.5 1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5c-1.7-4.4-6-7.5-11-7.5ZM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
              </svg>
            )}
          </button>
        </label>

        {state.error && (
          <p role="alert" className="rounded-lg bg-rose-500/20 px-3 py-2 text-center text-xs font-medium text-white ring-1 ring-rose-300/40">
            {state.error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 px-1 text-xs text-white/85">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" name="remember" className="h-4 w-4 accent-gold" />
            Remember me
          </label>
          <a
            href="mailto:admin@stellacollege.edu.au?subject=Student%20Portal%20password%20reset"
            className="font-medium text-gold-soft hover:underline"
          >
            Forgot password?
          </a>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-2 w-full rounded-xl bg-gold-soft py-3.5 text-lg font-semibold text-royal shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:translate-y-0 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {pending ? "Logging in…" : "Login"}
        </button>
      </form>
    </div>
  );
}
