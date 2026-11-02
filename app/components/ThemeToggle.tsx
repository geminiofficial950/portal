"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "../dashboard/_components/icons";

const STORAGE_KEY = "stella-theme";
const EVENT = "stella-theme-change";

// The root layout sets data-theme on <html> before the page paints (React never touches that attribute,
// so the theme survives page changes); this button just reads and flips it
const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
};
const readTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => null);

  const toggle = () => {
    const next = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // private mode etc. — the theme still applies for this visit
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className={`flex h-11 items-center gap-2 rounded-full border border-ink/15 bg-lilac px-4 text-sm font-medium text-plum transition hover:bg-plum hover:text-white ${className} ${theme ? "opacity-100" : "opacity-0"}`}
    >
      {theme === "dark" ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
