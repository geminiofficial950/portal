import type { SupportGroup } from "@/lib/support-booking-meta";

// One picture per support group, drawn for the portal (two-tone, so they read well in the round badge on each card)
const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export default function SupportIcon({ name, className = "" }: { name: SupportGroup["icon"]; className?: string }) {
  switch (name) {
    case "learning": // open book with a graduation cap
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <path d="M4 11.5c3.8-1.3 7.6-1 12 1.8 4.4-2.8 8.2-3.1 12-1.8v13.2c-3.8-1.3-7.6-1-12 1.8-4.4-2.8-8.2-3.1-12-1.8z" fill="currentColor" opacity=".14" />
          <path d="M4 11.5c3.8-1.3 7.6-1 12 1.8 4.4-2.8 8.2-3.1 12-1.8v13.2c-3.8-1.3-7.6-1-12 1.8-4.4-2.8-8.2-3.1-12-1.8zM16 13.3v13.2" {...common} />
          <path d="M9.5 6.2 16 3.5l6.5 2.7L16 8.9z" fill="currentColor" />
          <path d="M12 7.6v2.2c2.4 1.2 5.6 1.2 8 0V7.6M22.5 6.2v3.3" {...common} />
        </svg>
      );
    case "access": // accessible person in a circle
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <circle cx="16" cy="16" r="12.5" fill="currentColor" opacity=".14" />
          <circle cx="16" cy="16" r="12.5" {...common} />
          <circle cx="16" cy="9.2" r="1.9" fill="currentColor" />
          <path d="M9.5 12.6c4.3 1.1 8.7 1.1 13 0M16 13.4v4.6M16 18l-3 5.6M16 18l3 5.6" {...common} />
        </svg>
      );
    case "placement": // clipboard with a tick and a map pin
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <rect x="6" y="6" width="15" height="21" rx="3" fill="currentColor" opacity=".14" />
          <rect x="6" y="6" width="15" height="21" rx="3" {...common} />
          <path d="M10.5 6V4.5h6V6M10 14l2.2 2.2L17 11.5M10 21h6" {...common} />
          <path d="M24.5 15.5c-2.2 0-4 1.8-4 4 0 3 4 7 4 7s4-4 4-7c0-2.2-1.8-4-4-4z" fill="currentColor" />
          <circle cx="24.5" cy="19.5" r="1.4" fill="#fff" />
        </svg>
      );
    case "wellbeing": // heart held in a hand
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <path d="M16 18.5s-6.5-3.8-6.5-8.3c0-2.2 1.7-3.9 3.7-3.9 1.3 0 2.3.6 2.8 1.6.5-1 1.5-1.6 2.8-1.6 2 0 3.7 1.7 3.7 3.9 0 4.5-6.5 8.3-6.5 8.3z" fill="currentColor" />
          <path d="M3.5 21.5h4l5.3 2h6.3c1.2 0 1.2-1.8 0-1.8h-4.6M7.5 27h11.2l9-4.6c1-.6.3-2.1-.8-1.7L19.5 23.5" {...common} />
        </svg>
      );
    case "admin": // document with a dollar coin
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <path d="M7 4.5h11l6 6V26a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 26V6A1.5 1.5 0 0 1 7 4.5z" fill="currentColor" opacity=".14" />
          <path d="M7 4.5h11l6 6V26a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 26V6A1.5 1.5 0 0 1 7 4.5zM18 4.5v6h6M9.5 13h6M9.5 17h4" {...common} />
          <circle cx="21.5" cy="21.5" r="6" fill="currentColor" />
          <path d="M23.3 19.4c-.4-.6-1.1-.9-1.8-.9-1 0-1.8.6-1.8 1.4 0 1.9 3.6 1 3.6 2.9 0 .8-.8 1.4-1.8 1.4-.8 0-1.5-.3-1.9-.9M21.5 17.6v1M21.5 24.2v1" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "feedback": // speech bubble with a flag
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <path d="M6 6.5h20A2.5 2.5 0 0 1 28.5 9v11a2.5 2.5 0 0 1-2.5 2.5H13l-6 5v-5H6A2.5 2.5 0 0 1 3.5 20V9A2.5 2.5 0 0 1 6 6.5z" fill="currentColor" opacity=".14" />
          <path d="M6 6.5h20A2.5 2.5 0 0 1 28.5 9v11a2.5 2.5 0 0 1-2.5 2.5H13l-6 5v-5H6A2.5 2.5 0 0 1 3.5 20V9A2.5 2.5 0 0 1 6 6.5z" {...common} />
          <path d="M12 18.5v-8M12 11h7l-1.5 2.2L19 15.5h-7" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case "career": // briefcase with a rising arrow
      return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
          <rect x="4" y="10" width="24" height="16" rx="3" fill="currentColor" opacity=".14" />
          <rect x="4" y="10" width="24" height="16" rx="3" {...common} />
          <path d="M12 10V7.5A1.5 1.5 0 0 1 13.5 6h5A1.5 1.5 0 0 1 20 7.5V10M4 16.5h24" {...common} />
          <path d="M9.5 23l4.5-4 3 2.5 5.5-5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19.5 16h3v3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}
