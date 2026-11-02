"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "../actions/auth";

const input =
  "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-[15px] text-ink outline-none transition placeholder:text-slate-400 focus:border-navy focus:ring-2 focus:ring-navy/15";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p role="alert" className="border-l-4 border-rose-600 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
          User ID or email
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          defaultValue={state.username}
          required
          className={input}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className={`${input} pr-16`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-slate-500 hover:text-navy"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-md bg-navy text-[15px] font-medium text-white transition hover:bg-navy-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>

      <p className="text-sm">
        <a href="mailto:admin@stellacollege.edu.au?subject=Portal%20password%20reset" className="text-royal underline-offset-2 hover:underline">
          Forgotten your password?
        </a>
      </p>
    </form>
  );
}
