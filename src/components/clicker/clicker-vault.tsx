"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import {
  VAULT_CHAIN_MAX,
  VAULT_GOOD_HALF,
  VAULT_MISS_JAM_MS,
  VAULT_PERFECT_HALF,
  VAULT_PERIOD_MS,
  vaultGrade,
  type VaultGrade,
} from "@/domain/services/clicker-region-activity"
import "./clicker-mine.css"
import "./clicker-hunt.css"

type Props = {
  /** Region backdrop. */
  bg: string
  visual?: "idle" | "fever" | "crisis"
  /** One lock attempt; returns the chain to carry forward. */
  onLock: (grade: VaultGrade, chain: number, clientX: number, clientY: number) => { chain: number }
  /** Assist-drill strikes per second — plain strikes, as in every region. */
  autoRate?: number
  onDrill?: (clientX: number, clientY: number) => void
}

const GRADE_LABEL: Record<VaultGrade, string> = { perfect: "PERFECT", good: "GOOD", miss: "JAM" }

/** SVG arc path on the dial between two positions (revolutions, 0 = top, clockwise). */
function arc(r: number, from: number, to: number): string {
  const pt = (rev: number) => {
    const a = rev * 2 * Math.PI - Math.PI / 2
    return `${100 + r * Math.cos(a)} ${100 + r * Math.sin(a)}`
  }
  const large = to - from > 0.5 ? 1 : 0
  return `M ${pt(from)} A ${r} ${r} 0 ${large} 1 ${pt(to)}`
}

/** Next zone lands 0.3–0.7 revolutions ahead of the needle. */
function nextZone(needle: number): number {
  return (needle + 0.3 + Math.random() * 0.4) % 1
}

/** Phase Vault session: tap as the needle sweeps through the lit zone to set each lock. */
export function ClickerVault({ bg, visual = "idle", onLock, autoRate = 0, onDrill }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const needleRef = useRef<SVGGElement>(null)
  const t0 = useRef(0)
  const [zone, setZone] = useState(0.5)
  const [chain, setChain] = useState(0)
  const [jammedUntil, setJammedUntil] = useState(0)
  const [flash, setFlash] = useState<{ id: number; grade: VaultGrade } | null>(null)
  const flashSeq = useRef(0)

  const needleAt = (now: number) => (((now - t0.current) % VAULT_PERIOD_MS) + VAULT_PERIOD_MS) % VAULT_PERIOD_MS / VAULT_PERIOD_MS

  // Needle turns on its own clock, straight to the DOM — no re-render per frame.
  useEffect(() => {
    t0.current = performance.now()
    let raf = 0
    const step = (t: number) => {
      needleRef.current?.setAttribute("transform", `rotate(${needleAt(t) * 360} 100 100)`)
      raf = window.requestAnimationFrame(step)
    }
    raf = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (!jammedUntil) return
    const t = window.setTimeout(() => setJammedUntil(0), Math.max(0, jammedUntil - Date.now()))
    return () => window.clearTimeout(t)
  }, [jammedUntil])

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 650)
    return () => window.clearTimeout(t)
  }, [flash])

  useEffect(() => {
    if (autoRate <= 0 || !onDrill) return
    const id = window.setInterval(() => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      onDrill(rect.left + rect.width * (0.3 + Math.random() * 0.4), rect.top + rect.height * (0.3 + Math.random() * 0.3))
    }, 1000 / autoRate)
    return () => window.clearInterval(id)
  }, [autoRate, onDrill])

  const tap = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    if (jammedUntil && Date.now() < jammedUntil) return
    const needle = needleAt(performance.now())
    const grade = vaultGrade(needle, zone)
    const next = onLock(grade, chain, e.clientX, e.clientY)
    setChain(next.chain)
    setFlash({ id: ++flashSeq.current, grade })
    if (grade === "miss") {
      setJammedUntil(Date.now() + VAULT_MISS_JAM_MS)
    } else {
      setZone(nextZone(needle))
    }
  }

  const jammed = jammedUntil > 0
  return (
    <div ref={rootRef} data-visual={visual} className={`clicker-vault${jammed ? " is-jammed" : ""}`}>
      <div className="clicker-activity-plate" style={{ backgroundImage: `url(${bg})` }} aria-hidden />
      <button
        type="button"
        className="clicker-vault-dial"
        aria-label={`위상 자물쇠 · 바늘이 빛나는 구간을 지날 때 탭 · 연속 ${chain}${jammed ? " · 걸림" : ""}`}
        onPointerDown={tap}
      >
        <svg viewBox="0 0 200 200" aria-hidden>
          <circle className="clicker-vault-ring" cx="100" cy="100" r="82" />
          <circle className="clicker-vault-ring-inner" cx="100" cy="100" r="64" />
          {Array.from({ length: 24 }, (_, i) => (
            <line
              key={i}
              className="clicker-vault-tick"
              x1="100"
              y1="12"
              x2="100"
              y2={i % 6 === 0 ? 24 : 19}
              transform={`rotate(${i * 15} 100 100)`}
            />
          ))}
          <path className="clicker-vault-zone-good" d={arc(82, zone - VAULT_GOOD_HALF, zone + VAULT_GOOD_HALF)} />
          <path
            className="clicker-vault-zone-perfect"
            d={arc(82, zone - VAULT_PERFECT_HALF, zone + VAULT_PERFECT_HALF)}
          />
          <g ref={needleRef}>
            <line className="clicker-vault-needle" x1="100" y1="100" x2="100" y2="14" />
            <circle className="clicker-vault-needle-tip" cx="100" cy="16" r="4" />
          </g>
          <circle className="clicker-vault-hub" cx="100" cy="100" r="16" />
        </svg>
        <span className="clicker-vault-chain" aria-hidden>
          {Array.from({ length: VAULT_CHAIN_MAX }, (_, i) => (
            <i key={i} className={i < chain ? "is-on" : ""} />
          ))}
        </span>
        {flash ? (
          <span key={flash.id} className={`clicker-vault-grade is-${flash.grade}`} role="status">
            {GRADE_LABEL[flash.grade]}
          </span>
        ) : null}
      </button>
      <p className="clicker-vault-hint" aria-hidden>
        바늘이 빛나는 구간을 지날 때 탭 · 연속 성공 시 보너스
      </p>
      {autoRate > 0 ? <span className="clicker-mine-drill-tag">보조 드릴 · {autoRate}/s</span> : null}
    </div>
  )
}
