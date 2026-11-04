"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "../actions/auth";

// Underlined fields, as on the login card
const input =
  "h-10 w-full border-0 border-b border-[#c9d2e3] bg-transparent px-0 text-[15px] text-[#2c3550] outline-none transition placeholder:text-[#7c86a2] focus:border-b-2 focus:border-[#4a6cf6]";
const label = "block text-sm font-medium text-[#4a6cf6]";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p role="alert" className="rounded-md border-l-4 border-rose-600 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
          {state.error}
        </p>
      )}

      <div className="animate-fade-up [animation-delay:0.45s]">
        <label htmlFor="username" className={label}>
          User ID or Email
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          defaultValue={state.username}
          placeholder="e.g. 232111"
          required
          className={input}
        />
      </div>

      <div className="animate-fade-up [animation-delay:0.55s]">
        <label htmlFor="password" className={label}>
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            className={`${input} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 text-xs font-semibold text-[#4a6cf6] hover:underline"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-11 w-full animate-fade-up rounded-md bg-[#4a6cf6] text-[15px] font-semibold text-white shadow-[0_10px_22px_-12px_rgba(74,108,246,0.9)] transition [animation-delay:0.65s] hover:-translate-y-0.5 hover:bg-[#3d5ce0] hover:shadow-[0_16px_28px_-12px_rgba(74,108,246,0.95)] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4a6cf6] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Signing in…" : "Sign In"}
      </button>

      <p className="animate-fade-up text-center text-sm [animation-delay:0.75s]">
        <a href="mailto:admin@stellacollege.edu.au?subject=Portal%20login%20help" className="font-medium text-[#ff4f86] hover:underline">
          Need help signing in?
        </a>
      </p>
    </form>
  );
}
