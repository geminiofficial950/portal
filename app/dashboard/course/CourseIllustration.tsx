// Decorative picture for a course card: a stack of books, an open book and a graduation cap
export default function CourseIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 220" preserveAspectRatio="xMidYMid slice" className={className} role="presentation" aria-hidden>
      <rect width="320" height="220" fill="#f6f4fc" />
      <circle cx="262" cy="46" r="26" fill="#fdc580" opacity="0.55" />
      <circle cx="52" cy="58" r="14" fill="#7a62b3" opacity="0.25" />
      <path d="M30 186h260" stroke="#5b3f99" strokeOpacity="0.25" strokeWidth="4" strokeLinecap="round" />
      {/* stack of books */}
      <rect x="70" y="160" width="150" height="24" rx="5" fill="#5b3f99" />
      <rect x="78" y="166" width="134" height="4" rx="2" fill="#ffffff" opacity="0.6" />
      <rect x="84" y="136" width="132" height="24" rx="5" fill="#fdc580" />
      <rect x="92" y="142" width="116" height="4" rx="2" fill="#ffffff" opacity="0.7" />
      <rect x="74" y="112" width="140" height="24" rx="5" fill="#7a62b3" />
      <rect x="82" y="118" width="124" height="4" rx="2" fill="#ffffff" opacity="0.6" />
      {/* open book */}
      <path d="M150 112c-22-12-44-14-64-8v-46c20-6 42-4 64 8z" fill="#ffffff" stroke="#5b3f99" strokeWidth="3" strokeLinejoin="round" />
      <path d="M150 112c22-12 44-14 64-8v-46c-20-6-42-4-64 8z" fill="#ffffff" stroke="#5b3f99" strokeWidth="3" strokeLinejoin="round" />
      <path d="M150 66v46" stroke="#5b3f99" strokeWidth="3" />
      <path d="M100 72c12-3 26-2 38 3M100 84c12-3 26-2 38 3M162 75c12-5 26-6 38-3M162 87c12-5 26-6 38-3" stroke="#7a62b3" strokeWidth="2.5" strokeLinecap="round" />
      {/* graduation cap */}
      <path d="M248 120l34 14-34 14-34-14z" fill="#1d1b33" />
      <path d="M230 141v12c0 6 36 6 36 0v-12l-18 7z" fill="#1d1b33" />
      <path d="M282 134v20" stroke="#fdc580" strokeWidth="3" strokeLinecap="round" />
      <circle cx="282" cy="156" r="4" fill="#fdc580" />
      {/* sparkles */}
      <path d="M54 112l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#fdc580" />
      <path d="M236 70l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#7a62b3" />
    </svg>
  );
}
