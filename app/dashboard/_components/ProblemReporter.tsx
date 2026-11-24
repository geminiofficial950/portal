"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TechSupport, { type TechSupportRequest } from "./TechSupport";
import { CloseIcon, HeadsetIcon } from "./icons";

// When something goes wrong in the student portal, this takes a screenshot of the page (in the browser only) and
// offers to report it. Nothing is uploaded or saved unless the student selects Report and then Raise ticket in the
// Tech support form — dismissing it throws the screenshot away.
//
// What counts as a problem:
//  • "crash"     — a page failed to load and showed the error screen (error.tsx)
//  • "not-found" — a page or link that doesn't exist / isn't theirs (not-found.tsx)
//  • "script"    — an uncaught error in the page's code
//  • "promise"   — a failed background task nobody handled (an unhandled promise rejection)
//  • "request"   — a request to our own server failed with a server error (5xx), e.g. a save or upload
// Not counted: "you must fill in X" messages (those are normal answers), errors from browser extensions or other
// sites, the student going offline, and requests they cancelled.

export type ProblemKind = "crash" | "not-found" | "script" | "promise" | "request";
export type ProblemDetail = { kind: ProblemKind; message: string; digest?: string };

const EVENT = "stella:problem";
const COOLDOWN_MS = 30_000; // after one prompt, stay quiet for a while
const CAPTURE_TIMEOUT_MS = 8_000;

// A page that fails on first load can report before the reporter has started listening (child effects run
// first), so reports wait here until it does.
let listening = false;
const waiting: ProblemDetail[] = [];

/** Tell the problem reporter something went wrong (used by the error and not-found pages). */
export function reportProblem(detail: ProblemDetail) {
  if (listening) window.dispatchEvent(new CustomEvent<ProblemDetail>(EVENT, { detail }));
  else waiting.push(detail);
}

/** Put on a page that is itself the problem (the error and not-found pages): reports it once when it shows. */
export function ProblemOnShow(detail: ProblemDetail) {
  const { kind, message, digest } = detail;
  useEffect(() => {
    reportProblem({ kind, message, digest });
  }, [kind, message, digest]);
  return null;
}

const KIND_TEXT: Record<ProblemKind, string> = {
  crash: "This page didn’t load properly.",
  "not-found": "This page couldn’t be found.",
  script: "Something on this page stopped working.",
  promise: "Something on this page stopped working.",
  request: "We couldn’t reach the portal just now.",
};

// noise that isn't a portal problem
const IGNORED = [/ResizeObserver loop/i, /^Script error\.?$/i, /AbortError/i, /NEXT_REDIRECT/, /NEXT_HTTP_ERROR_FALLBACK/, /NEXT_NOT_FOUND/];
const ignored = (message: string) => IGNORED.some((r) => r.test(message));

const messageOf = (reason: unknown) =>
  reason instanceof Error ? `${reason.name}: ${reason.message}` : typeof reason === "string" ? reason : (() => { try { return JSON.stringify(reason); } catch { return String(reason); } })();

type Found = ProblemDetail & { page: string; at: Date; screenshot: string | null };

export default function ProblemReporter() {
  const [found, setFound] = useState<Found | null>(null);
  const [request, setRequest] = useState<TechSupportRequest | null>(null);
  const busy = useRef(false); // capturing, showing a prompt or the form is open
  const quietUntil = useRef(0);
  const seen = useRef(new Set<string>()); // each problem (kind + message + page) is offered once per visit

  const handle = useCallback(async (detail: ProblemDetail) => {
    const message = (detail.message || "").slice(0, 500);
    const key = `${detail.kind}|${message}|${window.location.pathname}`;
    if (busy.current || Date.now() < quietUntil.current || seen.current.has(key) || ignored(message)) return;
    busy.current = true;
    seen.current.add(key);
    // let the error screen finish drawing, then take the picture
    await new Promise((r) => setTimeout(r, 400));
    let screenshot: string | null = null;
    try {
      const { toJpeg } = await import("html-to-image");
      const root = document.getElementById("portal-root") ?? document.body;
      screenshot = await Promise.race([
        toJpeg(root, {
          quality: 0.8,
          pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
          backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
          // the prompt itself and anything marked private stay out of the picture
          filter: (node) => !(node instanceof HTMLElement && node.dataset.noScreenshot !== undefined),
        }),
        new Promise<null>((r) => setTimeout(() => r(null), CAPTURE_TIMEOUT_MS)),
      ]);
    } catch {
      screenshot = null; // still offer the report, just without a picture
    }
    setFound({ ...detail, message, page: window.location.pathname + window.location.search, at: new Date(), screenshot });
  }, []);

  useEffect(() => {
    const onProblem = (e: Event) => void handle((e as CustomEvent<ProblemDetail>).detail);
    const onError = (e: ErrorEvent) => {
      // only errors from our own code (not browser extensions or other sites)
      if (e.filename && !e.filename.startsWith(window.location.origin)) return;
      void handle({ kind: "script", message: e.error ? messageOf(e.error) : e.message });
    };
    const onRejection = (e: PromiseRejectionEvent) => void handle({ kind: "promise", message: messageOf(e.reason) });

    // a request to our own server that fails with a server error
    const original = window.fetch;
    const watched: typeof window.fetch = async (input, init) => {
      const res = await original(input, init);
      try {
        const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
        if (res.status >= 500 && url.origin === window.location.origin) {
          const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
          void handle({ kind: "request", message: `${method} ${url.pathname} → ${res.status} ${res.statusText}`.trim() });
        }
      } catch {
        // never let the watcher break a request
      }
      return res;
    };
    window.fetch = watched;
    window.addEventListener(EVENT, onProblem);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    listening = true;
    waiting.splice(0).forEach((d) => void handle(d));
    return () => {
      listening = false;
      if (window.fetch === watched) window.fetch = original;
      window.removeEventListener(EVENT, onProblem);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [handle]);

  const dismiss = () => {
    setFound(null); // the screenshot is dropped here — never uploaded
    busy.current = false;
    quietUntil.current = Date.now() + COOLDOWN_MS;
  };

  const report = async () => {
    if (!found) return;
    const files: File[] = [];
    if (found.screenshot) {
      const blob = await (await fetch(found.screenshot)).blob();
      files.push(new File([blob], `screenshot-${found.at.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.jpg`, { type: "image/jpeg" }));
    }
    // the student writes what they were doing on the first line; the rest is filled in for the tech team
    const facts = [
      `Problem: ${KIND_TEXT[found.kind]}`,
      `Page: ${found.page}`,
      `Error: ${found.message || "(no message)"}`,
      ...(found.digest ? [`Reference: ${found.digest}`] : []),
      `Time: ${found.at.toLocaleString("en-AU", { timeZone: "Australia/Melbourne" })} (Melbourne)`,
      `Browser: ${navigator.userAgent}`,
      `Screen: ${window.innerWidth}×${window.innerHeight}`,
    ];
    const details = ["What were you doing when this happened? ", "", "— Details for the tech team —", ...facts].join("\n");
    setRequest({ id: Date.now(), subject: `Problem: ${KIND_TEXT[found.kind].replace(/\.$/, "")}`.slice(0, 140), details: details.slice(0, 4000), files });
    setFound(null);
    busy.current = false;
    quietUntil.current = Date.now() + COOLDOWN_MS;
  };

  return (
    <>
      {found && (
        <div
          data-no-screenshot
          role="alertdialog"
          aria-labelledby="problem-title"
          aria-describedby="problem-text"
          className="support-rise fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-[1.5rem] border border-[var(--s-line)] bg-[var(--s-card)] p-4 text-ink shadow-[0_24px_60px_-24px_rgba(11,18,20,0.55)] sm:inset-x-auto sm:right-5 sm:bottom-5"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-800">
              <HeadsetIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p id="problem-title" className="text-base font-bold">
                {KIND_TEXT[found.kind]}
              </p>
              <p id="problem-text" className="mt-0.5 text-sm text-ink/80">
                {found.screenshot ? "We took a screenshot of this page. " : ""}Report it and our tech team will look into it. Nothing is sent unless you report it.
              </p>
            </div>
            <button type="button" onClick={dismiss} aria-label="Dismiss" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink/70 hover:bg-[var(--s-soft)]">
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          {found.screenshot && (
            // eslint-disable-next-line @next/next/no-img-element -- a local picture of the page, not uploaded
            <img src={found.screenshot} alt="Screenshot of the page" className="mt-3 max-h-40 w-full rounded-xl border border-[var(--s-line)] object-cover object-top" />
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={dismiss} className="rounded-full px-4 py-2 text-sm font-semibold text-ink hover:bg-[var(--s-soft)]">
              Not now
            </button>
            <button type="button" onClick={report} className="rounded-full bg-[var(--s-dark)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90">
              Report problem
            </button>
          </div>
        </div>
      )}
      <TechSupport showButton={false} request={request} />
    </>
  );
}
