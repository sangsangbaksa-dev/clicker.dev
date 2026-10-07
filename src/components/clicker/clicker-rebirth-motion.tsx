"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { REBIRTH_CHAMBER_REMINDER } from "@/data/clicker/onboarding"
import { RebirthPhaseArt } from "@/data/clicker/rebirth-assets"
import { RebirthMwParams, type MwEaseSample } from "@/data/clicker/rebirth-mw-params"
import {
  REBIRTH_AUDIO_CUES,
  REBIRTH_DURATION_FULL_MS,
  REBIRTH_DURATION_REDUCED_MS,
  rebirthAudioCueKey,
  rebirthPhaseAt,
  rebirthVariantFor,
  type RebirthPhaseId,
  type WorldlineMotionVariant,
} from "@/data/clicker/rebirth-motion"
import { useClickerDialogFocus, useClickerEscape } from "@/components/clicker/clicker-a11y"
import { playRebirthCue, playRebirthDrone } from "@/lib/clicker-sfx"
import "./clicker-rebirth-motion.css"

type Props = {
  transcendenceId: string
  worldlineLabel: string
  muted?: boolean
  onComplete: () => void
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  alpha: number
  accent: boolean
}

const HOLD_TO_SKIP_MS = 700
const PHASE_ORDER: RebirthPhaseId[] = ["select_confirm", "collapse", "void_tear", "stamp", "rebuild", "settle"]

/** Cinematic subtitle per beat: a small kicker and one narrated line. */
function narration(phase: RebirthPhaseId, label: string): { kicker: string; line: string } {
  switch (phase) {
    case "select_confirm":
      return { kicker: "WORLD LINE PROTOCOL", line: `${label} — 세계선을 고정합니다` }
    case "collapse":
      return { kicker: "COLLAPSE", line: "지금의 세계가 무너져 내립니다" }
    case "void_tear":
      return { kicker: "VOID TEAR", line: "시간의 틈이 열립니다" }
    case "stamp":
      return { kicker: "WORLDLINE STAMP", line: `${label} · 새로운 운명이 새겨집니다` }
    case "rebuild":
      return { kicker: "REBUILD", line: "세계가 다시 짜여집니다" }
    default:
      return { kicker: "SETTLE", line: "새로운 세계선에 도착합니다" }
  }
}

function cueName(phase: RebirthPhaseId, variant: WorldlineMotionVariant): string {
  if (phase === "select_confirm") return REBIRTH_AUDIO_CUES.confirm
  if (phase === "collapse") return REBIRTH_AUDIO_CUES.collapse
  if (phase === "void_tear") return REBIRTH_AUDIO_CUES.voidTear
  if (phase === "stamp") return REBIRTH_AUDIO_CUES.stamp(rebirthAudioCueKey(variant.transcendenceId))
  if (phase === "rebuild") return REBIRTH_AUDIO_CUES.rebuild
  return REBIRTH_AUDIO_CUES.settle
}

function spawnParticles(
  count: number,
  w: number,
  h: number,
  mode: WorldlineMotionVariant["particleMode"],
  bias: MwEaseSample["particleBias"],
  phase: RebirthPhaseId,
): Particle[] {
  const cx = w / 2
  const cy = h / 2
  const out: Particle[] = []
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    let x = 0
    let y = 0
    let vx = 0
    let vy = 0
    let maxLife = 40 + Math.random() * 50

    if (bias === "suck" || phase === "collapse") {
      // MW-01: spawn at HUD edges, suck to center.
      const edge = Math.floor(Math.random() * 4)
      if (edge === 0) {
        x = Math.random() * w
        y = Math.random() * h * 0.12
      } else if (edge === 1) {
        x = Math.random() * w
        y = h * (0.88 + Math.random() * 0.12)
      } else if (edge === 2) {
        x = Math.random() * w * 0.1
        y = Math.random() * h
      } else {
        x = w * (0.9 + Math.random() * 0.1)
        y = Math.random() * h
      }
      vx = (cx - x) * 0.045
      vy = (cy - y) * 0.045
      maxLife = 28 + Math.random() * 36
    } else if (bias === "rift") {
      x = cx + (Math.random() - 0.5) * 8
      y = cy + (Math.random() - 0.5) * h * 0.35
      vx = (Math.random() - 0.5) * 0.6
      vy = (Math.random() - 0.5) * 1.2
      maxLife = 20 + Math.random() * 24
    } else if (bias === "lanes_burst" || (phase === "stamp" && mode === "lanes")) {
      // MW-02 Pulse: vertical lanes, not circle spray.
      const lane = (Math.floor(Math.random() * 7) - 3) * (w * 0.07)
      x = cx + lane + (Math.random() - 0.5) * 6
      y = cy + (Math.random() - 0.5) * h * 0.55
      vx = (Math.random() - 0.5) * 0.8
      vy = (Math.random() < 0.5 ? -1 : 1) * (2.5 + Math.random() * 4)
      maxLife = 18 + Math.random() * 22
    } else if (bias === "outward" || phase === "rebuild") {
      const dist = 8 + Math.random() * 24
      x = cx + Math.cos(angle) * dist
      y = cy + Math.sin(angle) * dist
      if (mode === "lanes") {
        x = cx + (Math.floor(Math.random() * 5) - 2) * (w * 0.06)
        vx = 0
        vy = (y < cy ? -1 : 1) * (1.5 + Math.random() * 2.5)
      } else if (mode === "grid") {
        const step = Math.min(w, h) * 0.06
        x = cx + Math.round((Math.cos(angle) * dist) / step) * step
        y = cy + Math.round((Math.sin(angle) * dist) / step) * step
        vx = (x - cx) * 0.04
        vy = (y - cy) * 0.04
      } else {
        vx = Math.cos(angle) * (2 + Math.random() * 3)
        vy = Math.sin(angle) * (2 + Math.random() * 3)
      }
      maxLife = 26 + Math.random() * 30
    } else {
      const dist = Math.random() * Math.min(w, h) * 0.4
      x = cx + Math.cos(angle) * dist
      y = cy + Math.sin(angle) * dist
    }

    out.push({
      x,
      y,
      vx,
      vy,
      life: 0,
      maxLife,
      size: bias === "suck" ? 1.2 + Math.random() * 3.2 : 1.5 + Math.random() * 2.5,
      alpha: 0.35 + Math.random() * 0.55,
      accent: Math.random() < 0.35,
    })
  }
  return out
}

function RebirthAssetImage({
  src,
  className,
  placeholderClassName,
  alt = "",
}: {
  src?: string
  className: string
  placeholderClassName: string
  alt?: string
}) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <div className={placeholderClassName} aria-hidden />
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
}

function PlateLayer({ variant, phase, incoming }: { variant: WorldlineMotionVariant; phase: RebirthPhaseId; incoming: boolean }) {
  const keyBackdrop = RebirthPhaseArt.keyVisualBackdropFor(phase)
  const src = keyBackdrop ?? RebirthPhaseArt.plateForPhase(phase, variant.transcendenceId)
  return (
    <div
      className={`clicker-rebirth-particles-plate clicker-rebirth-plate--${phase}${keyBackdrop ? " clicker-rebirth-particles-plate--key-visual" : ""}${incoming ? " is-incoming" : " is-outgoing"}`}
      aria-hidden
    >
      <RebirthAssetImage
        src={src}
        className="clicker-rebirth-particles-plate-img"
        placeholderClassName={`clicker-rebirth-particles-plate-placeholder clicker-rebirth-particles-plate-placeholder--${variant.motif}`}
      />
    </div>
  )
}

/** One painted plate per beat, swapped with a clean cut (the cut flash covers the change). */
function PlateStack({ variant, phase }: { variant: WorldlineMotionVariant; phase: RebirthPhaseId }) {
  return <PlateLayer key={`plate-${phase}`} variant={variant} phase={phase} incoming />
}

function StampGlyph({
  variant,
  intensity,
  reducedMotion,
}: {
  variant: WorldlineMotionVariant
  intensity: number
  reducedMotion: boolean
}) {
  const style = {
    "--stamp-primary": variant.primary,
    "--stamp-accent": variant.accent,
    "--stamp-intensity": intensity,
  } as CSSProperties

  if (reducedMotion && variant.reducedMotionStillAssetId) {
    return (
      <div className="clicker-rebirth-stamp-glyph clicker-rebirth-stamp-glyph--still" style={style} aria-hidden>
        <RebirthAssetImage
          src={variant.reducedMotionStillAssetId}
          className="clicker-rebirth-stamp-still"
          placeholderClassName="clicker-rebirth-stamp-still-placeholder"
        />
      </div>
    )
  }

  if (variant.stampAssetId) {
    return (
      <div className="clicker-rebirth-stamp-glyph clicker-rebirth-stamp-glyph--image" style={style} aria-hidden>
        <img src={variant.stampAssetId} alt="" className="clicker-rebirth-stamp-image" />
      </div>
    )
  }

  return (
    <div className="clicker-rebirth-stamp-glyph clicker-rebirth-stamp-glyph--core" style={style} aria-hidden>
      <span className="clicker-rebirth-stamp-core-orb" />
    </div>
  )
}

export function ClickerRebirthMotion({ transcendenceId, worldlineLabel, muted = false, onComplete }: Props) {
  const variant = useMemo(() => rebirthVariantFor(transcendenceId), [transcendenceId])
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  )
  const duration = reducedMotion ? REBIRTH_DURATION_REDUCED_MS : REBIRTH_DURATION_FULL_MS

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef(0)
  const startRef = useRef(0)
  const cuesFired = useRef(new Set<string>())
  const completedRef = useRef(false)
  const completeTimerRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  useLayoutEffect(() => {
    onCompleteRef.current = onComplete
  })
  // Read live so toggling mute mid-sequence doesn't restart the timeline.
  const mutedRef = useRef(muted)
  useLayoutEffect(() => {
    mutedRef.current = muted
  })

  const finishEarly = () => {
    if (completedRef.current) return
    completedRef.current = true
    cancelAnimationFrame(rafRef.current)
    if (completeTimerRef.current) {
      window.clearTimeout(completeTimerRef.current)
      completeTimerRef.current = 0
    }
    onCompleteRef.current()
  }

  const rootRef = useRef<HTMLDivElement | null>(null)
  useClickerEscape(true, finishEarly)
  useClickerDialogFocus(rootRef)

  // Low drone under the whole sequence; fades out on finish or skip.
  useEffect(() => {
    if (reducedMotion || mutedRef.current) return
    return playRebirthDrone(duration / 1000 + 0.4)
  }, [duration, reducedMotion])

  // Hold to skip (like a cutscene): a tap does nothing, ~0.7 s of holding skips. Esc / Enter skip at once.
  const [holding, setHolding] = useState(false)
  const holdTimer = useRef(0)
  const startHold = () => {
    setHolding(true)
    window.clearTimeout(holdTimer.current)
    holdTimer.current = window.setTimeout(finishEarly, HOLD_TO_SKIP_MS)
  }
  const stopHold = () => {
    setHolding(false)
    window.clearTimeout(holdTimer.current)
  }
  useEffect(() => () => window.clearTimeout(holdTimer.current), [])

  const [frame, setFrame] = useState({
    phase: "select_confirm" as RebirthPhaseId,
    phaseT: 0,
    totalT: 0,
    shake: 0,
    uiFade: 0,
    uiScale: 1,
    voidAlpha: 0,
    stampScale: 0,
    chromatic: 0,
    rebuild: 0,
  })

  useEffect(() => {
    startRef.current = performance.now()
    cuesFired.current.clear()
    completedRef.current = false
    particlesRef.current = []
    if (completeTimerRef.current) {
      window.clearTimeout(completeTimerRef.current)
      completeTimerRef.current = 0
    }

    // Paint select_confirm immediately so data-phase is visible before first RAF under load.
    const confirm = RebirthMwParams.selectConfirm(0)
    setFrame({
      phase: "select_confirm",
      phaseT: 0,
      totalT: 0,
      shake: 0,
      uiFade: confirm.uiFade,
      uiScale: confirm.uiScale,
      voidAlpha: confirm.voidAlpha,
      stampScale: confirm.stampScale,
      chromatic: 0,
      rebuild: 0,
    })

    const softMax =
      typeof window !== "undefined" && window.innerWidth < 720
        ? RebirthMwParams.PHONE_PARTICLE_SOFT_MAX
        : RebirthMwParams.DESKTOP_PARTICLE_SOFT_MAX

    const tick = (now: number) => {
      const elapsed = now - startRef.current
      const { phase, phaseT, totalT } = rebirthPhaseAt(elapsed, reducedMotion)
      const mw = RebirthMwParams.sample(phase, phaseT, reducedMotion)

      if (!cuesFired.current.has(phase) && !mutedRef.current) {
        cuesFired.current.add(phase)
        playRebirthCue(cueName(phase, variant))
      }

      setFrame({
        phase,
        phaseT,
        totalT,
        shake: mw.shakePx,
        uiFade: mw.uiFade,
        uiScale: mw.uiScale,
        voidAlpha: mw.voidAlpha,
        stampScale: mw.stampScale,
        chromatic: mw.chromatic,
        rebuild: mw.rebuild,
      })

      const canvas = canvasRef.current
      if (canvas && !reducedMotion) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          const w = canvas.width
          const h = canvas.height
          const cx = w / 2
          const cy = h / 2
          const despawnR = Math.min(w, h) * RebirthMwParams.CENTER_DESPAWN_RADIUS

          if (
            mw.allowParticleSpawn &&
            particlesRef.current.length < softMax &&
            (mw.particleBias === "suck" ||
              mw.particleBias === "rift" ||
              mw.particleBias === "lanes_burst" ||
              mw.particleBias === "outward")
          ) {
            const burst =
              mw.particleBias === "lanes_burst" && phaseT < 0.2
                ? 14
                : mw.particleBias === "suck"
                  ? 10
                  : 8
            particlesRef.current.push(
              ...spawnParticles(burst, w, h, variant.particleMode, mw.particleBias, phase).slice(0, burst),
            )
          }

          ctx.clearRect(0, 0, w, h)
          for (const p of particlesRef.current) {
            if (mw.particleBias === "suck") {
              p.vx += (cx - p.x) * 0.003
              p.vy += (cy - p.y) * 0.003
            }
            p.x += p.vx
            p.y += p.vy
            p.life += 1
            if (mw.particleBias === "suck") {
              const dx = p.x - cx
              const dy = p.y - cy
              if (dx * dx + dy * dy < despawnR * despawnR) {
                p.life = p.maxLife + 1
                continue
              }
            }
            if (p.life > p.maxLife) continue
            const a = p.alpha * (1 - p.life / p.maxLife)
            ctx.fillStyle = p.accent ? variant.accent : variant.primary
            ctx.globalAlpha = a
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.globalAlpha = 1
          particlesRef.current = particlesRef.current.filter((p) => p.life <= p.maxLife).slice(-softMax)
        }
      }

      if (elapsed >= duration) {
        if (!completedRef.current) {
          completedRef.current = true
          // Paint a final settle frame before tearing down so HUD/stamp settle is visible.
          const settle = RebirthMwParams.settle(1)
          setFrame({
            phase: "settle",
            phaseT: 1,
            totalT: 1,
            shake: 0,
            uiFade: settle.uiFade,
            uiScale: settle.uiScale,
            voidAlpha: settle.voidAlpha,
            stampScale: settle.stampScale,
            chromatic: 0,
            rebuild: 1,
          })
          completeTimerRef.current = window.setTimeout(() => {
            completeTimerRef.current = 0
            onCompleteRef.current()
          }, 180)
        }
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (completeTimerRef.current) {
        window.clearTimeout(completeTimerRef.current)
        completeTimerRef.current = 0
      }
    }
  }, [duration, reducedMotion, variant])

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [])

  const tearVisible = frame.phase === "void_tear" || frame.phase === "stamp"
  /** Prefers-reduced-motion + Wave A still → skip flashy MW plates; show still only. */
  const stillOnly = Boolean(reducedMotion && variant.reducedMotionStillAssetId)
  return (
    <div
      ref={rootRef}
      className={`clicker-rebirth-motion${frame.shake && !stillOnly ? " is-shake" : ""}${reducedMotion ? " is-reduced" : ""}${stillOnly ? " is-still-only" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${worldlineLabel} 세계선 환생`}
      data-phase={stillOnly ? "settle" : frame.phase}
      style={
        {
          "--rebirth-shake": stillOnly ? "0px" : `${frame.shake}px`,
          "--rebirth-ui-fade": stillOnly ? 1 : frame.uiFade,
          "--rebirth-ui-scale": stillOnly ? 1 : frame.uiScale,
          "--rebirth-void-alpha": stillOnly ? 0.35 : frame.voidAlpha,
          "--rebirth-stamp-scale": stillOnly ? 1 : frame.stampScale,
          "--rebirth-chromatic": stillOnly ? 0 : frame.chromatic,
          "--rebirth-rebuild": stillOnly ? 1 : frame.rebuild,
          "--stamp-primary": variant.primary,
          "--stamp-accent": variant.accent,
        } as CSSProperties
      }
    >
      <button
        type="button"
        className={`clicker-ghost clicker-rebirth-skip${holding ? " is-holding" : ""}`}
        aria-keyshortcuts="Escape"
        style={{ "--hold-ms": `${HOLD_TO_SKIP_MS}ms` } as CSSProperties}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          if (reducedMotion) finishEarly()
          else startHold()
        }}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            finishEarly()
          }
        }}
      >
        <span className="clicker-rebirth-skip-fill" aria-hidden />
        <span>{reducedMotion ? "계속 · Esc" : "길게 눌러 건너뛰기 · Esc"}</span>
      </button>
      <div className="clicker-rebirth-overlay" />
      {!stillOnly ? <PlateStack variant={variant} phase={frame.phase} /> : null}
      {!reducedMotion ? <canvas ref={canvasRef} className="clicker-rebirth-particles" aria-hidden /> : null}
      {!stillOnly && tearVisible ? <div className="clicker-rebirth-tear" aria-hidden /> : null}
      {!stillOnly ? (
        <>
          <span key={`cut-${frame.phase}`} className={`clicker-rebirth-cut is-${frame.phase}`} aria-hidden />
          <div className="clicker-rebirth-grain" aria-hidden />
          <div className="clicker-rebirth-letterbox is-top" aria-hidden />
          <div className="clicker-rebirth-letterbox is-bottom" aria-hidden />
          <ol className="clicker-rebirth-steps" aria-hidden>
            {PHASE_ORDER.map((p, i) => {
              const at = PHASE_ORDER.indexOf(frame.phase)
              return <li key={p} className={i < at ? "is-done" : i === at ? "is-on" : ""} />
            })}
          </ol>
        </>
      ) : null}
      <div className="clicker-rebirth-subtitle" key={`sub-${stillOnly ? "still" : frame.phase}`} aria-live="polite">
        <small>{stillOnly ? "WORLDLINE LOCK" : narration(frame.phase, worldlineLabel).kicker}</small>
        <strong>{stillOnly ? worldlineLabel : narration(frame.phase, worldlineLabel).line}</strong>
      </div>
      <div className="clicker-rebirth-stamp-wrap">
        {!stillOnly && frame.phase === "stamp" ? (
          <>
            <span className="clicker-rebirth-stamp-rays" aria-hidden />
            <span className="clicker-rebirth-stamp-shock" aria-hidden />
            <span className="clicker-rebirth-stamp-shock is-late" aria-hidden />
          </>
        ) : null}
        <StampGlyph variant={variant} intensity={stillOnly ? 1 : frame.stampScale} reducedMotion={reducedMotion} />
        <p className="clicker-rebirth-stamp-label">{worldlineLabel}</p>
        {stillOnly || frame.phase === "settle" ? (
          <p className="clicker-rebirth-chamber-reminder">{REBIRTH_CHAMBER_REMINDER}</p>
        ) : null}
      </div>
      {!stillOnly && frame.phase === "stamp" ? <div className="clicker-rebirth-stamp-flash" aria-hidden /> : null}
      {!stillOnly ? <div className="clicker-rebirth-chromatic" aria-hidden /> : null}
      <div className="clicker-rebirth-vignette" aria-hidden />
      <p className="clicker-rebirth-sr">{worldlineLabel} — {stillOnly ? "reduced motion still" : frame.phase.replace("_", " ")}</p>
    </div>
  )
}

export type { Props as ClickerRebirthMotionProps }
