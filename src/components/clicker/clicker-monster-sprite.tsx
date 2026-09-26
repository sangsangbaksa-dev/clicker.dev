import type { ReactElement } from "react"
import type { MonsterArchetype, MonsterLook } from "@/domain/entities/clicker"

/**
 * Vector monsters for the hunt: four roles × five region families, all on a 100×100 box.
 * Colors come from the hunt root (`--m-h` hue) through the shared gradients in
 * `HuntSpriteDefs` and the classes in clicker-hunt.css:
 *   .mb body · .md shade · .ml light accent · .me eye · .mo outline · .mw weak-point core
 * Animated parts carry `.a-*` classes (wings, bob, spin, arms) driven by CSS.
 */

export function HuntSpriteDefs() {
  return (
    <svg className="hunt-defs" aria-hidden width="0" height="0">
      <defs>
        <radialGradient id="hunt-g-body" cx="38%" cy="30%" r="75%">
          <stop offset="0%" className="hs-0" />
          <stop offset="55%" className="hs-1" />
          <stop offset="100%" className="hs-2" />
        </radialGradient>
        <radialGradient id="hunt-g-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" className="hc-0" />
          <stop offset="45%" className="hc-1" />
          <stop offset="100%" className="hc-2" />
        </radialGradient>
        <radialGradient id="hunt-g-eye" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="50%" className="he-1" />
          <stop offset="100%" className="he-2" />
        </radialGradient>
        <linearGradient id="hunt-g-wing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" className="hw-0" />
          <stop offset="100%" className="hw-1" />
        </linearGradient>
        <filter id="hunt-f-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  )
}

/** Core center (sprite px on the 100 box) for each sprite — must match its `<Core>` below. */
const CORE_Y: Record<MonsterArchetype, Record<MonsterLook, number>> = {
  SWARMER: { relay: 50, phase: 54, storm: 52, fault: 50, foundry: 51 },
  CASTER: { relay: 58, phase: 66, storm: 50, fault: 68, foundry: 48 },
  BRUTE: { relay: 56, phase: 56, storm: 60, fault: 62, foundry: 60 },
  BOSS: { relay: 60, phase: 56, storm: 74, fault: 66, foundry: 50 },
}

/**
 * Where a tap counts as a weak-point hit (fractions of the sprite box). Generous on purpose:
 * the monster moves, and a thumb covers more than the core.
 */
export function weakSpot(archetype: MonsterArchetype, look: MonsterLook): { x: number; y: number; r: number } {
  const r = archetype === "SWARMER" ? 0.34 : archetype === "CASTER" ? 0.24 : archetype === "BRUTE" ? 0.2 : 0.16
  return { x: 0.5, y: CORE_Y[archetype][look] / 100, r }
}

function Eye({ x, y, r = 5 }: { x: number; y: number; r?: number }) {
  return (
    <g className="a-blink" style={{ transformOrigin: `${x}px ${y}px` }}>
      <circle cx={x} cy={y} r={r * 1.35} className="md" />
      <circle cx={x} cy={y} r={r} fill="url(#hunt-g-eye)" />
      <circle cx={x - r * 0.3} cy={y - r * 0.35} r={r * 0.28} fill="#fff" opacity="0.9" />
    </g>
  )
}

/** Glowing core — the weak point; brighter while open (CSS on `.is-weak`). */
function Core({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g className="mw-g">
      <circle cx={x} cy={y} r={r * 1.7} className="mw-halo" />
      <circle cx={x} cy={y} r={r} fill="url(#hunt-g-core)" className="mw" />
      <circle cx={x} cy={y} r={r * 0.4} fill="#fff" className="mw-dot" />
    </g>
  )
}

/* ---------------- Swarmers ---------------- */

const SWARMERS: Record<MonsterLook, () => ReactElement> = {
  relay: () => (
    <>
      <g className="a-wing-l">
        <path d="M40 48 L8 30 L16 46 L6 56 L20 58 L14 70 L40 58 Z" fill="url(#hunt-g-wing)" className="mo" />
      </g>
      <g className="a-wing-r">
        <path d="M60 48 L92 30 L84 46 L94 56 L80 58 L86 70 L60 58 Z" fill="url(#hunt-g-wing)" className="mo" />
      </g>
      <path d="M44 30 L40 16 M56 30 L60 16" className="mo ml-stroke" />
      <circle cx="40" cy="15" r="2.6" className="ml" />
      <circle cx="60" cy="15" r="2.6" className="ml" />
      <circle cx="50" cy="50" r="20" fill="url(#hunt-g-body)" className="mo" />
      <path d="M36 62 Q50 72 64 62" className="md-stroke" />
      <Eye x={50} y={48} r={8} />
    </>
  ),
  phase: () => (
    <>
      <g className="a-wing-l">
        <path d="M46 46 C20 10 2 26 8 44 C12 56 30 58 46 54 Z" fill="url(#hunt-g-wing)" className="mo" opacity="0.92" />
        <path d="M46 56 C26 62 12 80 24 86 C34 90 44 74 48 60 Z" fill="url(#hunt-g-wing)" className="mo" opacity="0.8" />
        <circle cx="22" cy="38" r="5" className="ml" opacity="0.8" />
      </g>
      <g className="a-wing-r">
        <path d="M54 46 C80 10 98 26 92 44 C88 56 70 58 54 54 Z" fill="url(#hunt-g-wing)" className="mo" opacity="0.92" />
        <path d="M54 56 C74 62 88 80 76 86 C66 90 56 74 52 60 Z" fill="url(#hunt-g-wing)" className="mo" opacity="0.8" />
        <circle cx="78" cy="38" r="5" className="ml" opacity="0.8" />
      </g>
      <ellipse cx="50" cy="54" rx="8" ry="22" fill="url(#hunt-g-body)" className="mo" />
      <path d="M46 34 C40 22 34 20 30 22 M54 34 C60 22 66 20 70 22" className="ml-stroke" />
      <Eye x={46} y={42} r={3.4} />
      <Eye x={54} y={42} r={3.4} />
    </>
  ),
  storm: () => (
    <>
      <path
        className="a-spin-slow mo"
        style={{ transformOrigin: "50px 52px" }}
        d="M50 18 L57 38 L78 30 L64 48 L84 58 L62 62 L66 84 L50 68 L34 84 L38 62 L16 58 L36 48 L22 30 L43 38 Z"
        fill="url(#hunt-g-body)"
      />
      <path d="M40 34 L30 14 L44 28 M60 34 L70 14 L56 28" className="ml ml-stroke" />
      <circle cx="50" cy="52" r="13" className="md" />
      <Eye x={45} y={50} r={4} />
      <Eye x={56} y={50} r={4} />
      <path d="M43 60 L47 57 L50 61 L53 57 L57 60" className="ml-stroke" />
    </>
  ),
  fault: () => (
    <>
      <g className="a-legs">
        {[20, 34, 66, 80].map((x, i) => (
          <path key={x} d={`M${x < 50 ? 38 : 62} 62 L${x} ${74 + (i % 2) * 6} L${x + (x < 50 ? -6 : 6)} 86`} className="mo md-stroke thick" />
        ))}
      </g>
      <path d="M18 64 C18 34 34 22 50 22 C66 22 82 34 82 64 Z" fill="url(#hunt-g-body)" className="mo" />
      <path d="M30 40 L42 48 L38 60 M62 30 L58 46 L70 54" className="ml-stroke crack" />
      <path d="M22 64 L78 64" className="md-stroke thick" />
      <Eye x={42} y={70} r={4} />
      <Eye x={58} y={70} r={4} />
    </>
  ),
  foundry: () => (
    <>
      <g className="a-rotor-l" style={{ transformOrigin: "18px 36px" }}>
        <ellipse cx="18" cy="36" rx="16" ry="3" className="ml" opacity="0.7" />
      </g>
      <g className="a-rotor-r" style={{ transformOrigin: "82px 36px" }}>
        <ellipse cx="82" cy="36" rx="16" ry="3" className="ml" opacity="0.7" />
      </g>
      <path d="M26 44 L18 38 M74 44 L82 38" className="mo md-stroke thick" />
      <rect x="26" y="36" width="48" height="34" rx="14" fill="url(#hunt-g-body)" className="mo" />
      <rect x="34" y="44" width="32" height="14" rx="7" className="md" />
      <circle cx="50" cy="51" r="5.5" fill="url(#hunt-g-eye)" className="a-blink" />
      <path d="M40 70 L36 80 M60 70 L64 80" className="mo md-stroke" />
      <circle cx="50" cy="31" r="3" className="ml a-pulse" />
    </>
  ),
}

/* ---------------- Casters ---------------- */

const CASTERS: Record<MonsterLook, () => ReactElement> = {
  relay: () => (
    <>
      <g className="a-spin" style={{ transformOrigin: "50px 50px" }}>
        <ellipse cx="50" cy="50" rx="44" ry="14" className="ring-stroke" />
      </g>
      <g className="a-spin-rev" style={{ transformOrigin: "50px 50px" }}>
        <ellipse cx="50" cy="50" rx="14" ry="44" className="ring-stroke" opacity="0.6" />
      </g>
      <path d="M50 10 C64 30 72 44 72 58 C72 74 62 86 50 86 C38 86 28 74 28 58 C28 44 36 30 50 10 Z" fill="url(#hunt-g-body)" className="mo a-flicker" />
      <Core x={50} y={58} r={10} />
      <Eye x={42} y={44} r={3.6} />
      <Eye x={58} y={44} r={3.6} />
    </>
  ),
  phase: () => (
    <>
      <path d="M50 12 C72 12 80 32 80 50 L80 78 L72 70 L64 84 L56 72 L50 86 L44 72 L36 84 L28 70 L20 78 L20 50 C20 32 28 12 50 12 Z" fill="url(#hunt-g-body)" className="mo a-sway" style={{ transformOrigin: "50px 20px" }} />
      <path d="M32 44 C32 28 68 28 68 44 C68 56 32 56 32 44 Z" className="md" />
      <Eye x={42} y={44} r={3.8} />
      <Eye x={58} y={44} r={3.8} />
      <Core x={50} y={66} r={7} />
      <path d="M14 58 C8 50 10 40 18 36 M86 58 C92 50 90 40 82 36" className="ml-stroke" />
    </>
  ),
  storm: () => (
    <>
      <g className="a-spin-slow" style={{ transformOrigin: "50px 50px" }}>
        {Array.from({ length: 8 }, (_, i) => (
          <ellipse key={i} cx="50" cy="14" rx="11" ry="8" className="md" opacity="0.9" transform={`rotate(${i * 45} 50 50)`} />
        ))}
      </g>
      <circle cx="50" cy="50" r="28" fill="url(#hunt-g-body)" className="mo" />
      <circle cx="50" cy="50" r="17" className="eye-white" />
      <circle cx="50" cy="50" r="10" fill="url(#hunt-g-core)" className="mw a-look" />
      <circle cx="50" cy="50" r="4" fill="#0a0a12" className="a-look" />
      <path d="M22 76 L30 66 L28 74 L36 64" className="ml-stroke bolt" />
      <path d="M78 76 L70 66 L72 74 L64 64" className="ml-stroke bolt" />
    </>
  ),
  fault: () => (
    <>
      <path d="M16 84 C14 60 24 44 34 40 C36 28 44 20 50 20 C56 20 64 28 66 40 C76 44 86 60 84 84 Z" fill="url(#hunt-g-body)" className="mo" />
      <ellipse cx="50" cy="26" rx="10" ry="5" className="md" />
      <ellipse cx="50" cy="25" rx="6" ry="2.6" fill="url(#hunt-g-core)" className="a-pulse" />
      <path d="M26 60 L34 54 L32 66 M74 62 L66 56 L68 70" className="ml-stroke crack" />
      <Eye x={40} y={50} r={4.2} />
      <Eye x={60} y={50} r={4.2} />
      <Core x={50} y={68} r={8} />
      <circle cx="44" cy="10" r="3" className="ml a-drip" />
      <circle cx="56" cy="6" r="2" className="ml a-drip" style={{ animationDelay: "0.4s" }} />
    </>
  ),
  foundry: () => (
    <>
      <path d="M22 88 L30 64 L70 64 L78 88 Z" className="md mo" />
      <rect x="28" y="30" width="44" height="36" rx="8" fill="url(#hunt-g-body)" className="mo" />
      <g className="a-aim" style={{ transformOrigin: "50px 48px" }}>
        <rect x="44" y="4" width="12" height="30" rx="3" className="md mo" />
        <rect x="42" y="4" width="16" height="6" rx="2" className="ml" />
      </g>
      <circle cx="50" cy="48" r="10" className="md" />
      <circle cx="50" cy="48" r="7" fill="url(#hunt-g-core)" className="mw" />
      <path d="M32 72 L68 72 M36 80 L64 80" className="ml-stroke" opacity="0.6" />
    </>
  ),
}

/* ---------------- Brutes ---------------- */

const BRUTES: Record<MonsterLook, () => ReactElement> = {
  relay: () => (
    <>
      <g className="a-arm-l" style={{ transformOrigin: "24px 40px" }}>
        <rect x="6" y="36" width="18" height="42" rx="6" className="md mo" />
        <rect x="4" y="74" width="22" height="14" rx="4" fill="url(#hunt-g-body)" className="mo" />
      </g>
      <g className="a-arm-r" style={{ transformOrigin: "76px 40px" }}>
        <rect x="76" y="36" width="18" height="42" rx="6" className="md mo" />
        <rect x="74" y="74" width="22" height="14" rx="4" fill="url(#hunt-g-body)" className="mo" />
      </g>
      <rect x="22" y="30" width="56" height="54" rx="10" fill="url(#hunt-g-body)" className="mo" />
      <path d="M30 94 L34 84 M70 94 L66 84" className="mo md-stroke thick" />
      <path d="M36 30 L32 10 A20 8 0 0 0 68 10 L64 30 Z" className="md mo" />
      <path d="M50 12 L50 2" className="ml-stroke" />
      <circle cx="50" cy="2" r="3" className="ml a-pulse" />
      <rect x="34" y="18" width="32" height="7" rx="3" className="eye-bar" />
      <Core x={50} y={56} r={10} />
      <path d="M26 42 L36 42 M64 42 L74 42 M26 72 L34 72 M66 72 L74 72" className="ml-stroke" opacity="0.6" />
    </>
  ),
  phase: () => (
    <>
      <path d="M50 6 L86 24 L86 70 L50 94 L14 70 L14 24 Z" fill="url(#hunt-g-body)" className="mo" />
      <path d="M50 16 L76 29 L76 65 L50 82 L24 65 L24 29 Z" className="md" />
      <g className="a-spin-slow" style={{ transformOrigin: "50px 56px" }}>
        <circle cx="50" cy="56" r="20" className="ring-stroke thick" />
        {[0, 90, 180, 270].map((a) => (
          <rect key={a} x="47" y="33" width="6" height="8" rx="2" className="ml" transform={`rotate(${a} 50 56)`} />
        ))}
      </g>
      <Core x={50} y={56} r={10} />
      <Eye x={40} y={30} r={3.6} />
      <Eye x={60} y={30} r={3.6} />
    </>
  ),
  storm: () => (
    <>
      <g className="a-arm-l" style={{ transformOrigin: "22px 44px" }}>
        <path d="M22 40 C8 46 4 64 8 80 L20 80 C18 66 22 56 30 52 Z" fill="url(#hunt-g-body)" className="mo" />
        <path d="M6 82 L10 90 L14 84 L18 92" className="ml-stroke bolt" />
      </g>
      <g className="a-arm-r" style={{ transformOrigin: "78px 44px" }}>
        <path d="M78 40 C92 46 96 64 92 80 L80 80 C82 66 78 56 70 52 Z" fill="url(#hunt-g-body)" className="mo" />
        <path d="M94 82 L90 90 L86 84 L82 92" className="ml-stroke bolt" />
      </g>
      <path d="M26 92 C22 64 28 40 50 38 C72 40 78 64 74 92 Z" fill="url(#hunt-g-body)" className="mo" />
      <g className="md">
        <circle cx="30" cy="36" r="14" />
        <circle cx="50" cy="28" r="16" />
        <circle cx="70" cy="36" r="14" />
      </g>
      <Eye x={42} y={32} r={3.6} />
      <Eye x={58} y={32} r={3.6} />
      <Core x={50} y={60} r={9} />
    </>
  ),
  fault: () => (
    <>
      <path d="M10 80 C8 54 22 30 50 26 C78 30 92 54 90 80 Z" fill="url(#hunt-g-body)" className="mo" />
      {[
        "M16 60 L26 36 L36 54 Z",
        "M34 40 L46 18 L56 40 Z",
        "M54 36 L68 16 L74 44 Z",
        "M70 52 L84 34 L88 62 Z",
      ].map((d) => (
        <path key={d} d={d} className="md mo" />
      ))}
      <path d="M22 70 L34 62 L30 74 M78 70 L66 62 L70 76 M44 46 L50 54 L56 46" className="ml-stroke crack a-pulse" />
      <path d="M18 80 L18 92 M36 82 L36 94 M64 82 L64 94 M82 80 L82 92" className="mo md-stroke thick" />
      <Eye x={30} y={74} r={3.4} />
      <Eye x={70} y={74} r={3.4} />
      <Core x={50} y={62} r={10} />
    </>
  ),
  foundry: () => (
    <>
      <g className="a-arm-l" style={{ transformOrigin: "20px 46px" }}>
        <rect x="6" y="42" width="16" height="30" rx="4" className="md mo" />
        <path d="M4 72 L2 86 L10 80 L14 90 L20 72 Z" fill="url(#hunt-g-body)" className="mo" />
      </g>
      <g className="a-arm-r" style={{ transformOrigin: "80px 46px" }}>
        <rect x="78" y="42" width="16" height="30" rx="4" className="md mo" />
        <path d="M96 72 L98 86 L90 80 L86 90 L80 72 Z" fill="url(#hunt-g-body)" className="mo" />
      </g>
      <rect x="20" y="30" width="60" height="56" rx="6" fill="url(#hunt-g-body)" className="mo" />
      <rect x="30" y="12" width="40" height="22" rx="4" className="md mo" />
      <rect x="36" y="18" width="28" height="7" rx="2" className="eye-bar" />
      <g className="a-spin" style={{ transformOrigin: "50px 60px" }}>
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <rect key={a} x="47" y="41" width="6" height="7" className="md" transform={`rotate(${a} 50 60)`} />
        ))}
      </g>
      <Core x={50} y={60} r={10} />
      <path d="M28 92 L28 86 M72 92 L72 86" className="mo md-stroke thick" />
    </>
  ),
}

/* ---------------- Bosses ---------------- */

const BOSSES: Record<MonsterLook, () => ReactElement> = {
  relay: () => (
    <>
      <g className="a-spin-slow" style={{ transformOrigin: "50px 50px" }}>
        {[0, 1, 2].map((i) => (
          <path key={i} d="M50 4 A46 46 0 0 1 90 28" className="ring-stroke thick" transform={`rotate(${i * 120} 50 50)`} />
        ))}
      </g>
      <g className="a-wing-l">
        <path d="M34 44 L4 20 L12 44 L2 58 L16 60 L10 78 L34 62 Z" fill="url(#hunt-g-wing)" className="mo" />
      </g>
      <g className="a-wing-r">
        <path d="M66 44 L96 20 L88 44 L98 58 L84 60 L90 78 L66 62 Z" fill="url(#hunt-g-wing)" className="mo" />
      </g>
      <path d="M50 8 L70 30 L66 74 L50 92 L34 74 L30 30 Z" fill="url(#hunt-g-body)" className="mo" />
      <path d="M36 16 L32 2 M44 12 L42 0 M56 12 L58 0 M64 16 L68 2" className="ml-stroke" />
      <path d="M40 34 L60 34 L56 42 L44 42 Z" className="eye-bar" />
      <Core x={50} y={60} r={9} />
    </>
  ),
  phase: () => (
    <>
      <circle cx="50" cy="16" r="15" className="ring-stroke a-pulse" />
      <g className="a-wing-l">
        <path d="M46 44 C16 0 -4 24 4 48 C10 62 30 62 46 56 Z" fill="url(#hunt-g-wing)" className="mo" opacity="0.94" />
        <path d="M46 58 C22 64 6 88 20 94 C32 98 44 80 48 62 Z" fill="url(#hunt-g-wing)" className="mo" opacity="0.85" />
        <circle cx="20" cy="36" r="7" className="ml" opacity="0.85" />
        <circle cx="20" cy="36" r="3" className="md" />
      </g>
      <g className="a-wing-r">
        <path d="M54 44 C84 0 104 24 96 48 C90 62 70 62 54 56 Z" fill="url(#hunt-g-wing)" className="mo" opacity="0.94" />
        <path d="M54 58 C78 64 94 88 80 94 C68 98 56 80 52 62 Z" fill="url(#hunt-g-wing)" className="mo" opacity="0.85" />
        <circle cx="80" cy="36" r="7" className="ml" opacity="0.85" />
        <circle cx="80" cy="36" r="3" className="md" />
      </g>
      <ellipse cx="50" cy="56" rx="12" ry="34" fill="url(#hunt-g-body)" className="mo" />
      <Eye x={45} y={34} r={3.6} />
      <Eye x={55} y={34} r={3.6} />
      <Core x={50} y={56} r={7} />
    </>
  ),
  storm: () => (
    <>
      <g className="a-spin-slow" style={{ transformOrigin: "50px 58px" }}>
        {Array.from({ length: 10 }, (_, i) => (
          <ellipse key={i} cx="50" cy="18" rx="12" ry="9" className="md" opacity="0.85" transform={`rotate(${i * 36} 50 58)`} />
        ))}
      </g>
      <path d="M26 30 L14 4 L32 22 L30 8 L40 26 M74 30 L86 4 L68 22 L70 8 L60 26" className="ml ml-stroke bolt" />
      <circle cx="50" cy="58" r="30" fill="url(#hunt-g-body)" className="mo" />
      <path d="M30 34 L38 22 L44 32 L50 18 L56 32 L62 22 L70 34 Z" className="ml mo" />
      <path d="M34 50 L46 54 M66 50 L54 54" className="md-stroke thick" />
      <Eye x={41} y={57} r={4.4} />
      <Eye x={59} y={57} r={4.4} />
      <Core x={50} y={74} r={7} />
    </>
  ),
  fault: () => (
    <>
      <path d="M8 60 C6 30 26 10 50 10 C74 10 94 30 92 60 C90 80 74 94 50 94 C26 94 10 80 8 60 Z" fill="url(#hunt-g-body)" className="mo" />
      {["M16 34 L26 10 L34 30 Z", "M40 18 L50 0 L60 18 Z", "M66 30 L74 10 L84 34 Z"].map((d) => (
        <path key={d} d={d} className="md mo" />
      ))}
      <g className="a-jaw" style={{ transformOrigin: "50px 58px" }}>
        <path d="M22 58 C30 84 70 84 78 58 Z" className="md" />
        <path d="M26 60 L32 70 L38 61 L44 72 L50 62 L56 72 L62 61 L68 70 L74 60" className="tooth" />
      </g>
      <path d="M22 58 C30 44 70 44 78 58 Z" className="md" opacity="0.8" />
      <path d="M26 58 L32 50 L38 57 L44 48 L50 56 L56 48 L62 57 L68 50 L74 58" className="tooth" />
      <Eye x={32} y={36} r={4.6} />
      <Eye x={68} y={36} r={4.6} />
      <Core x={50} y={66} r={6} />
      <path d="M14 70 L24 64 L20 78 M86 70 L76 64 L80 78" className="ml-stroke crack a-pulse" />
    </>
  ),
  foundry: () => (
    <>
      <g className="a-spin" style={{ transformOrigin: "50px 50px" }}>
        <circle cx="50" cy="50" r="46" className="ring-stroke" strokeDasharray="10 6" />
      </g>
      <g className="a-spin-rev" style={{ transformOrigin: "50px 50px" }}>
        <ellipse cx="50" cy="50" rx="44" ry="16" className="ring-stroke thick" />
      </g>
      <circle cx="50" cy="50" r="30" fill="url(#hunt-g-body)" className="mo" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <rect key={a} x="46" y="16" width="8" height="8" rx="2" className="md mo" transform={`rotate(${a} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="18" className="md" />
      <Core x={50} y={50} r={12} />
      <path d="M36 36 L44 44 M64 36 L56 44 M36 64 L44 56 M64 64 L56 56" className="ml-stroke" opacity="0.7" />
    </>
  ),
}

const TABLE: Record<MonsterArchetype, Record<MonsterLook, () => ReactElement>> = {
  SWARMER: SWARMERS,
  CASTER: CASTERS,
  BRUTE: BRUTES,
  BOSS: BOSSES,
}

export function MonsterSprite({ archetype, look }: { archetype: MonsterArchetype; look: MonsterLook }) {
  const Art = TABLE[archetype][look]
  return (
    <svg className={`hunt-sprite is-${archetype.toLowerCase()}`} viewBox="0 0 100 100" aria-hidden>
      <g className="hunt-sprite-body">
        <Art />
      </g>
    </svg>
  )
}
