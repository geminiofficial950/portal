// Trainer dashboard banner art (our own vector): a trainer at her laptop with a cup of tea.
export default function WelcomeArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 190" className={className} aria-hidden>
      {/* floating dots */}
      <circle cx="40" cy="70" r="6" fill="none" stroke="#7a62b3" strokeWidth="2" />
      <circle cx="250" cy="58" r="8" fill="none" stroke="#5b3f99" strokeWidth="2" />
      <circle cx="250" cy="58" r="3.5" fill="#5b3f99" />
      <circle cx="70" cy="22" r="3" fill="#5b3f99" />
      <circle cx="226" cy="18" r="2.5" fill="#5b3f99" />
      <path d="M212 6 V70" stroke="#7a62b3" strokeWidth="1.5" />

      {/* chair */}
      <path d="M48 112 C50 86 70 78 92 80 L104 150 L52 150 Z" fill="#5b3f99" />
      {/* hair (back) */}
      <path d="M96 40 C88 6 150 0 150 44 C152 70 156 92 168 110 L100 110 C104 88 98 64 96 40 Z" fill="#3e2a6b" />
      {/* body: peach top, white shirt */}
      <path d="M86 150 C84 112 96 92 122 88 C146 92 160 108 162 150 Z" fill="#fdc580" />
      <path d="M114 90 L122 120 L130 90 Z" fill="#ffffff" />
      {/* neck and face */}
      <rect x="116" y="70" width="12" height="20" rx="4" fill="#efbf9f" />
      <ellipse cx="122" cy="56" rx="17" ry="20" fill="#f6cfb1" />
      <path d="M104 52 C104 30 140 26 141 50 C132 40 116 40 104 52 Z" fill="#3e2a6b" />
      <path d="M116 62 Q122 66 128 62" stroke="#c4566a" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* arm to the keyboard */}
      <path d="M148 112 C164 122 180 128 196 128" stroke="#fdc580" strokeWidth="14" fill="none" strokeLinecap="round" />
      <circle cx="198" cy="128" r="6" fill="#f6cfb1" />
      {/* laptop */}
      <path d="M190 84 L262 72 L252 132 L182 140 Z" fill="#5b3f99" />
      <circle cx="223" cy="105" r="7" fill="#c9bdf0" />
      {/* desk */}
      <path d="M60 140 L270 132 L276 148 L66 158 Z" fill="#c9bdf0" />
      <path d="M66 158 L276 148 L276 154 L66 165 Z" fill="#7a62b3" />
      {/* tea cup */}
      <rect x="118" y="124" width="20" height="18" rx="4" fill="#ffffff" stroke="#5b3f99" strokeWidth="2" />
      <path d="M138 128 C146 128 146 138 138 138" stroke="#5b3f99" strokeWidth="2" fill="none" />
      <path d="M124 118 C122 114 128 112 126 108 M132 118 C130 114 136 112 134 108" stroke="#7a62b3" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
