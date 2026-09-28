"use client"

import "./clicker-monster.css"

/** Inline SVG creature art (the core guardian uses `warden`). Parts carry classes the CSS animates. */
export function MonsterArt({ kind }: { kind: string }) {
  switch (kind) {
    case "wisp":
      return (
        <svg viewBox="0 0 100 110" aria-hidden>
          <path className="mon-tail" d="M50 100 C30 80 70 70 50 50" stroke="#66d9ff" strokeWidth="10" fill="none" strokeLinecap="round" opacity="0.6" />
          <circle cx="50" cy="42" r="30" fill="#8ee8ff" />
          <circle cx="50" cy="42" r="20" fill="#e6fbff" />
          <circle className="mon-eye" cx="42" cy="40" r="4" fill="#123" />
          <circle className="mon-eye" cx="58" cy="40" r="4" fill="#123" />
          <path d="M42 52 Q50 58 58 52" stroke="#123" strokeWidth="3" fill="none" />
        </svg>
      )
    case "golem":
      return (
        <svg viewBox="0 0 110 120" aria-hidden>
          <rect className="mon-arm" x="4" y="46" width="20" height="46" rx="6" fill="#6f6a8a" />
          <rect className="mon-arm is-right" x="86" y="46" width="20" height="46" rx="6" fill="#6f6a8a" />
          <rect x="22" y="30" width="66" height="70" rx="10" fill="#8a84aa" />
          <rect x="34" y="6" width="42" height="30" rx="8" fill="#9b95bd" />
          <circle className="mon-eye" cx="55" cy="21" r="7" fill="#c49bff" />
          <path d="M40 60 L55 50 L70 60 L55 80 Z" fill="#c49bff" opacity="0.8" />
          <rect x="30" y="100" width="18" height="16" fill="#6f6a8a" /><rect x="62" y="100" width="18" height="16" fill="#6f6a8a" />
        </svg>
      )
    case "stormbird":
      return (
        <svg viewBox="0 0 140 90" aria-hidden>
          <path className="mon-wing" d="M70 44 L10 10 L30 50 Z" fill="#7a68d8" />
          <path className="mon-wing is-right" d="M70 44 L130 10 L110 50 Z" fill="#7a68d8" />
          <ellipse cx="70" cy="50" rx="22" ry="16" fill="#4d3fa8" />
          <circle cx="70" cy="32" r="12" fill="#5e4fc2" />
          <path d="M70 34 L82 40 L70 42 Z" fill="#ffd34a" />
          <circle className="mon-eye" cx="66" cy="30" r="3" fill="#fff38a" />
          <path d="M60 64 L66 84 L70 68 L74 84 L80 64" stroke="#ffe66b" strokeWidth="3" fill="none" />
        </svg>
      )
    case "worm":
      return (
        <svg viewBox="0 0 140 90" aria-hidden>
          <g className="mon-body">
            <circle cx="24" cy="66" r="14" fill="#7a2410" />
            <circle cx="46" cy="56" r="16" fill="#942d12" />
            <circle cx="70" cy="48" r="18" fill="#ad3a15" />
            <circle cx="96" cy="42" r="20" fill="#c24a1a" />
          </g>
          <circle cx="110" cy="36" r="18" fill="#d9601f" />
          <circle cx="110" cy="36" r="9" fill="#ffb347" />
          <circle className="mon-eye" cx="116" cy="28" r="3" fill="#fff4b0" />
          <path d="M40 50 L44 44 M66 40 L70 32 M92 32 L96 24" stroke="#ffb347" strokeWidth="3" />
        </svg>
      )
    case "hunter":
      return (
        <svg viewBox="0 0 130 90" aria-hidden>
          <g className="mon-rotor"><rect x="4" y="12" width="44" height="6" rx="3" fill="#ffc266" /></g>
          <g className="mon-rotor is-right"><rect x="82" y="12" width="44" height="6" rx="3" fill="#ffc266" /></g>
          <path d="M26 16 L26 36 M104 16 L104 36" stroke="#8a6a3a" strokeWidth="4" />
          <rect x="24" y="30" width="82" height="40" rx="14" fill="#6a5130" />
          <circle className="mon-eye" cx="65" cy="50" r="12" fill="#ff3b3b" />
          <circle cx="65" cy="50" r="5" fill="#fff" />
          <path d="M40 70 L34 84 M90 70 L96 84" stroke="#8a6a3a" strokeWidth="4" />
        </svg>
      )
    case "warden":
      return (
        <svg viewBox="0 0 220 240" aria-hidden>
          <path className="mon-arm" d="M40 100 L6 170 L28 180 L62 120 Z" fill="#4a2a18" />
          <path className="mon-arm is-right" d="M180 100 L214 170 L192 180 L158 120 Z" fill="#4a2a18" />
          <path d="M50 70 L170 70 L190 190 L110 230 L30 190 Z" fill="#5d3620" />
          <path d="M70 90 L150 90 L162 180 L110 206 L58 180 Z" fill="#7a4526" />
          <path d="M80 20 L140 20 L156 72 L64 72 Z" fill="#6a3c22" />
          <path d="M84 14 L96 0 L100 20 M136 14 L124 0 L120 20" fill="#ffb347" />
          <circle className="mon-core" cx="110" cy="138" r="28" fill="#ff8c1a" />
          <circle cx="110" cy="138" r="14" fill="#fff1c2" />
          <rect className="mon-eye" x="88" y="42" width="44" height="10" rx="5" fill="#ffdd55" />
        </svg>
      )
    default:
      return null
  }
}

