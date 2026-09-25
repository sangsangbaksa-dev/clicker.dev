"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { CLICKER_ASSETS } from "@/data/clicker/catalog"
import { formatNumber } from "@/domain/services/clicker-format"
import { useClicker } from "@/hooks/use-clicker"
import { useClickerBgm } from "@/hooks/use-clicker-bgm"
import { ClickerComplete } from "@/components/clicker/clicker-complete"
import { ClickerEnding } from "@/components/clicker/clicker-ending"
import { ClickerMine } from "@/components/clicker/clicker-mine"
import { ClickerCinematic } from "@/components/clicker/clicker-cinematic"
import { ClickerRegionChallenge } from "@/components/clicker/clicker-region-challenge"
import { MineArt } from "@/data/clicker/mine-assets"
import { ClickerMineResult } from "@/components/clicker/clicker-mine-result"
import { ClickerOtherTab } from "@/components/clicker/clicker-other-tab"
import { ClickerRebirthMotion } from "@/components/clicker/clicker-rebirth-motion"
import { ClickerSettings } from "@/components/clicker/clicker-settings"
import { ClickerSkillTree } from "@/components/clicker/clicker-skill-tree"
import { ClickerTitle } from "@/components/clicker/clicker-title"
import { isClickerAdminAllowed } from "@/domain/services/clicker-admin-gate"
import { useClickerDialogFocus } from "@/components/clicker/clicker-a11y"
import { playLaser, playSfx, unlockSfx } from "@/components/clicker/clicker-sfx"
import { ClickerAchievementsPanel } from "@/components/clicker/panels/achievements-panel"
import { ClickerProducersPanel } from "@/components/clicker/panels/producers-panel"
import { ClickerUpgradesPanel } from "@/components/clicker/panels/upgrades-panel"
import { ClickerShopPanel } from "@/components/clicker/panels/shop-panel"
import { ClickerWorldPanel } from "@/components/clicker/panels/world-panel"
import { ClickerTranscendencePanel } from "@/components/clicker/panels/transcendence-panel"
import "./clicker.css"
import "./clicker-polish.css"

/** Next inlines NODE_ENV — production builds dead-code-eliminate admin JSX. */
const CLICKER_ADMIN_UI = process.env.NODE_ENV !== "production"

type TabId = "producers" | "upgrades" | "skills" | "shop" | "world" | "achievements" | "transcendence"

function CountUpNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  const shownRef = useRef(value)

  useEffect(() => {
    const from = shownRef.current
    const to = value
    if (!Number.isFinite(to)) return
    if (from === to) {
      shownRef.current = to
      setShown(to)
      return
    }
    const start = performance.now()
    const dur = Math.abs(to - from) > 1000 ? 280 : 160
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur)
      const eased = 1 - (1 - p) * (1 - p)
      const next = from + (to - from) * eased
      shownRef.current = next
      setShown(next)
      if (p < 1) raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [value])

  // Decorative tween — parent metrics should expose settled values via aria-label/live.
  return <span aria-hidden>{formatNumber(shown)}</span>
}

const DRAWER_FOOT_HINT: Record<TabId, string> = {
  producers: "생산자 구매",
  upgrades: "영구 강화",
  skills: "회로 해금",
  shop: "LUMA 상점",
  world: "지역 이동 · Esc",
  achievements: "업적 1개당 생산 +1%",
  transcendence: "초월 · Esc",
}

const DRAWER_STORAGE_KEY = "aurelia-clicker-drawer-h"

function drawerSnapPoints() {
  const vh = typeof window !== "undefined" ? window.innerHeight : 800
  return {
    peek: 96,
    half: Math.round(vh * 0.46),
    full: Math.round(Math.min(vh * 0.78, vh - 120)),
  }
}

function nearestDrawerSnap(height: number) {
  const snaps = drawerSnapPoints()
  const points = [snaps.peek, snaps.half, snaps.full]
  return points.reduce((best, point) => (Math.abs(point - height) < Math.abs(best - height) ? point : best), snaps.half)
}

function readDrawerHeight() {
  // Peek keeps the Core Mine gathering scene visible after ENTER MINE.
  if (typeof window === "undefined") return drawerSnapPoints().peek
  try {
    const raw = sessionStorage.getItem(DRAWER_STORAGE_KEY)
    const n = raw ? Number(raw) : NaN
    if (Number.isFinite(n) && n > 0) return nearestDrawerSnap(n)
  } catch {
    /* ignore */
  }
  return drawerSnapPoints().peek
}

/** The admin gate reads the URL once; nothing in-page changes it. */
const subscribeNever = () => () => {}

export function ClickerApp() {
  const game = useClicker()
  // Door-walk entry cinematic between Enter Mine and the timed session (carries its own SFX).
  const [enteringMine, setEnteringMine] = useState(false)
  /** Region whose field challenge is open (mini-game overlay), or null. */
  const [challengeRegionId, setChallengeRegionId] = useState<string | null>(null)

  // Prime Web Audio on first gesture so click/laser SFX are not stuck suspended.
  useEffect(() => {
    // Capture phase so mine ore stopPropagation() can't swallow the unlock gesture.
    window.addEventListener("pointerdown", unlockSfx, true)
    window.addEventListener("keydown", unlockSfx, true)
    return () => {
      window.removeEventListener("pointerdown", unlockSfx, true)
      window.removeEventListener("keydown", unlockSfx, true)
    }
  }, [])

  const [tab, setTab] = useState<TabId>("upgrades")
  // Hub splits into the mine entrance scene and a full-screen management screen.
  const [hubView, setHubView] = useState<"entrance" | "manage">("entrance")
  const [adminOpen, setAdminOpen] = useState(false)
  // Defense in depth: build strip + host/?admin gate (never production). Read after
  // hydration; the panel never auto-opens, so the launch button keeps the mine playable.
  const adminAllowed = useSyncExternalStore(
    subscribeNever,
    () => CLICKER_ADMIN_UI && isClickerAdminAllowed(),
    () => false,
  )
  const [pop, setPop] = useState(false)
  const [shake, setShake] = useState(false)
  const [stageEvent, setStageEvent] = useState(false)
  const [popIcons, setPopIcons] = useState<Record<string, number>>({})
  const [confirmPotion, setConfirmPotion] = useState<string | null>(null)
  const [endingOpen, setEndingOpen] = useState(false)
  const [pendingRebirth, setPendingRebirth] = useState<{ id: string; label: string } | null>(null)
  const [storyBeat, setStoryBeat] = useState<string | null>(null)
  const [adminResetArmed, setAdminResetArmed] = useState(false)
  const prevVisual = useRef<string | null>(null)
  const prevRegionId = useRef<string | null>(null)
  const [regionTransition, setRegionTransition] = useState(false)
  const drawerSnaps = useMemo(() => drawerSnapPoints(), [])
  const [drawerHeight, setDrawerHeight] = useState(readDrawerHeight)
  const [drawerDragging, setDrawerDragging] = useState(false)
  const drawerDraggingRef = useRef(false)
  const drawerDrag = useRef({ startY: 0, startH: 0, moved: false })
  const crisisRef = useRef<HTMLDivElement | null>(null)
  const storyBeatRef = useRef<HTMLDivElement | null>(null)
  const adminRef = useRef<HTMLElement | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useClickerBgm(game.hud?.coreVisual, {
    // Cinematics carry their own soundtrack.
    scene: enteringMine || game.regionIntro
      ? "silent"
      : pendingRebirth || endingOpen
        ? "chamber"
        : game.save?.settings.playSurface === "mine"
          ? "mine"
          : "hub",
    muted: game.otherTabActive || (game.save?.settings.musicMuted ?? false),
    volume: game.save?.settings.musicVolume ?? 0,
  })

  useClickerDialogFocus(crisisRef, Boolean(game.hud?.crisisActive))
  useClickerDialogFocus(storyBeatRef, Boolean(storyBeat))
  useClickerDialogFocus(adminRef, CLICKER_ADMIN_UI && adminAllowed && adminOpen)

  // One auto-dismiss for every LUMA beat. The triggers below used to own their timers,
  // but their effects re-run on every tick and the cleanup kept cancelling them.
  useEffect(() => {
    if (!storyBeat) return
    playSfx("notify")
    const timer = window.setTimeout(() => setStoryBeat(null), 5200)
    return () => window.clearTimeout(timer)
  }, [storyBeat])

  useEffect(() => {
    if (!confirmPotion) return
    const timer = window.setTimeout(() => setConfirmPotion(null), 4000)
    return () => window.clearTimeout(timer)
  }, [confirmPotion])

  useEffect(() => {
    if (!adminResetArmed) return
    const timer = window.setTimeout(() => setAdminResetArmed(false), 8000)
    return () => window.clearTimeout(timer)
  }, [adminResetArmed])

  const persistDrawerHeight = useCallback((height: number) => {
    try {
      sessionStorage.setItem(DRAWER_STORAGE_KEY, String(height))
    } catch {
      /* ignore */
    }
  }, [])

  // The settled height is remembered for the session; mid-drag heights are not.
  useEffect(() => {
    if (!drawerDragging) persistDrawerHeight(drawerHeight)
  }, [drawerDragging, drawerHeight, persistDrawerHeight])

  const setDrawerSnap = useCallback(
    (snap: "peek" | "half" | "full") => setDrawerHeight(drawerSnaps[snap]),
    [drawerSnaps],
  )

  const drawerMode =
    drawerHeight <= drawerSnaps.peek + 16 ? "peek" : drawerHeight >= drawerSnaps.full - 24 ? "full" : "half"

  const selectTab = useCallback(
    (id: TabId) => {
      playSfx(id === "transcendence" ? "transcend" : "tick")
      setTab(id)
      setHubView("manage")
      if (drawerHeight <= drawerSnaps.peek + 16) {
        setDrawerHeight(drawerSnaps.half)
      } else if (id === "skills" && drawerHeight < drawerSnaps.half + 40) {
        setDrawerHeight(drawerSnaps.half)
      }
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`.clicker-tabs button[data-active="true"]`)
          ?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" })
      })
    },
    [drawerHeight, drawerSnaps],
  )

  const playSurface = game.save?.settings.playSurface ?? "hub"
  // Entering the mine tucks the drawer away; leaving it returns to the hub entrance.
  const [prevSurface, setPrevSurface] = useState(playSurface)
  if (game.save?.settings.gameStarted && prevSurface !== playSurface) {
    setPrevSurface(playSurface)
    if (playSurface === "mine") {
      setDrawerSnap("peek")
    } else {
      setHubView("entrance")
      setDrawerSnap("half")
    }
  }

  const onDrawerHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drawerDrag.current = { startY: e.clientY, startH: drawerHeight, moved: false }
    drawerDraggingRef.current = true
    setDrawerDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onDrawerHandlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawerDraggingRef.current) return
    const delta = drawerDrag.current.startY - e.clientY
    if (Math.abs(delta) > 4) drawerDrag.current.moved = true
    const next = Math.min(drawerSnaps.full, Math.max(drawerSnaps.peek, drawerDrag.current.startH + delta))
    setDrawerHeight(next)
  }

  const finishDrawerDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawerDraggingRef.current) return
    drawerDraggingRef.current = false
    setDrawerDragging(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDrawerHeight(nearestDrawerSnap(drawerHeight))
  }

  const onDrawerHandleClick = () => {
    if (drawerDrag.current.moved) return
    if (drawerMode === "peek") setDrawerSnap("half")
    else if (drawerMode === "half") setDrawerSnap("full")
    else setDrawerSnap("peek")
  }

  useEffect(() => {
    const onResize = () => {
      const snaps = drawerSnapPoints()
      setDrawerHeight((height) => Math.min(Math.max(height, snaps.peek), snaps.full))
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])


  // Esc / back: layered dismiss for overlays + drawer/tab chrome (no focus trap).
  const { toast: gameToast, dismissToast } = game
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      // Rebirth and settings own Esc themselves.
      if (pendingRebirth || settingsOpen) return

      if (endingOpen) {
        // Ending owns Esc (confirm cancel vs close) via ClickerEnding.
        return
      }
      if (CLICKER_ADMIN_UI && adminOpen) {
        e.preventDefault()
        setAdminResetArmed(false)
        setAdminOpen(false)
        return
      }
      if (confirmPotion) {
        e.preventDefault()
        setConfirmPotion(null)
        return
      }
      if (storyBeat) {
        e.preventDefault()
        setStoryBeat(null)
        return
      }
      if (gameToast) {
        e.preventDefault()
        dismissToast()
        return
      }
      if (hubView === "manage" && playSurface !== "mine") {
        e.preventDefault()
        setHubView("entrance")
        return
      }
      if (drawerMode === "full") {
        e.preventDefault()
        setDrawerSnap("half")
        return
      }
      if (tab === "transcendence" || tab === "world") {
        e.preventDefault()
        selectTab("producers")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    pendingRebirth,
    settingsOpen,
    endingOpen,
    adminOpen,
    gameToast,
    dismissToast,
    confirmPotion,
    storyBeat,
    drawerMode,
    setDrawerSnap,
    tab,
    selectTab,
    hubView,
    playSurface,
  ])

  const flashStage = () => {
    setStageEvent(true)
    window.setTimeout(() => setStageEvent(false), 300)
  }

  const bumpIcon = (id: string) => {
    setPopIcons((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  }

  const triggerShake = () => {
    setShake(true)
    window.setTimeout(() => setShake(false), 200)
  }

  const coreVisual = game.hud?.coreVisual ?? "idle"
  const mineVisual = coreVisual === "fever" || coreVisual === "crisis" ? coreVisual : "idle"

  useEffect(() => {
    const next = game.hud?.coreVisual
    if (!next) return
    const prev = prevVisual.current
    if (prev && prev !== next && (next === "fever" || next === "crisis" || prev === "fever" || prev === "crisis")) {
      flashStage()
    }
    if (next === "crisis" && prev !== "crisis") triggerShake()
    prevVisual.current = next
  }, [game.hud?.coreVisual])

  useEffect(() => {
    if (!game.hud?.canRebirth && tab === "transcendence") {
      // Keep locked approach panel open; only eject when tab is unavailable.
      const ratio = game.save
        ? game.save.runState.lifetimeCoreEnergy / (game.hud?.rebirthRequirement ?? game.config.rebirthEnergy)
        : 0
      if (ratio < 0.25) setTab("producers")
    }
  }, [game.hud?.canRebirth, game.hud?.rebirthRequirement, game.save, game.config.rebirthEnergy, tab])

  // LUMA beats for progress moments, checked during render in this order so a later beat
  // wins when several land together. Tracking starts once the save has loaded, so a
  // returning player isn't re-told about progress they already had.
  const canRebirthNow = game.hud ? Boolean(game.hud.canRebirth) : null
  const [seenCanRebirth, setSeenCanRebirth] = useState<boolean | null>(null)
  if (canRebirthNow !== null && seenCanRebirth !== canRebirthNow) {
    setSeenCanRebirth(canRebirthNow)
    if (seenCanRebirth === false && canRebirthNow) {
      setStoryBeat("누적 CORE가 임계에 닿았습니다. TRANSCENDENCE에서 세계선을 접을 수 있습니다.")
    }
  }

  useEffect(() => {
    if (game.hud?.coreVisual !== "crisis") return
    const id = window.setInterval(() => triggerShake(), 2800)
    return () => window.clearInterval(id)
  }, [game.hud?.coreVisual])

  useEffect(() => {
    const regionId = game.currentRegion?.id
    if (!regionId) return
    if (prevRegionId.current && prevRegionId.current !== regionId) {
      setRegionTransition(true)
      const timer = window.setTimeout(() => setRegionTransition(false), 280)
      prevRegionId.current = regionId
      return () => window.clearTimeout(timer)
    }
    prevRegionId.current = regionId
  }, [game.currentRegion?.id])

  // A region unlocked since the last render.
  const unlockedRegionKey = game.regions
    .filter((r) => r.unlocked)
    .map((r) => r.id)
    .join("|")
  const [seenUnlockedRegionKey, setSeenUnlockedRegionKey] = useState<string | null>(null)
  if (game.regions.length > 0 && seenUnlockedRegionKey !== unlockedRegionKey) {
    setSeenUnlockedRegionKey(unlockedRegionKey)
    if (seenUnlockedRegionKey !== null) {
      const seen = new Set(seenUnlockedRegionKey.split("|"))
      const fresh = game.regions.find((r) => r.unlocked && !r.isHome && !seen.has(r.id))
      if (fresh) setStoryBeat(`새 지역 해금 · ${fresh.name}. WORLD에서 이동할 수 있습니다.`)
    }
  }

  // Keyed on the objective id only: depending on the whole save re-fired the beat every tick,
  // so a dismissed line popped straight back up.
  const objectiveId = game.save?.runState.currentObjectiveId
  const [seenObjectiveId, setSeenObjectiveId] = useState<string | null>(null)
  if (objectiveId && seenObjectiveId !== objectiveId) {
    setSeenObjectiveId(objectiveId)
    const line = seenObjectiveId ? game.config.objectives.find((o) => o.id === objectiveId)?.lumaLine : null
    if (line) setStoryBeat(line)
  }

  // Event cues that can start without a click (gauge auto-FEVER, crisis roll).
  const feverActive = Boolean(game.hud?.fever.active)
  const prevFeverActive = useRef(feverActive)
  useEffect(() => {
    if (feverActive && !prevFeverActive.current) playSfx("fever")
    prevFeverActive.current = feverActive
  }, [feverActive])

  const crisisActive = Boolean(game.hud?.crisisActive)
  const prevCrisisActive = useRef(crisisActive)
  useEffect(() => {
    if (crisisActive && !prevCrisisActive.current) playSfx("crisis")
    prevCrisisActive.current = crisisActive
  }, [crisisActive])

  // Mine session: countdown ticks for the last 3 seconds, then the end cue.
  const inMineSurface = game.save?.settings.playSurface === "mine"
  const mineEndsAt = game.save?.runState.mineSessionEndsAt ?? 0
  useEffect(() => {
    if (!inMineSurface || !mineEndsAt) return
    const timers = [3, 2, 1]
      .map((sec) => mineEndsAt - sec * 1000 - Date.now())
      .filter((ms) => ms > 0)
      .map((ms) => window.setTimeout(() => playSfx("timerWarn"), ms))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [inMineSurface, mineEndsAt])

  const prevInMine = useRef(inMineSurface)
  useEffect(() => {
    if (prevInMine.current && !inMineSurface) playSfx("sessionEnd")
    prevInMine.current = inMineSurface
  }, [inMineSurface])

  if (game.otherTabActive) {
    return (
      <ClickerOtherTab
        onResume={() => {
          setEnteringMine(false)
          game.resumeHere()
        }}
      />
    )
  }

  if (!game.save || !game.hud) {
    return (
      <div data-clicker className="clicker-shell clicker-loading" role="status" aria-busy="true" aria-live="polite">
        <div
          className="clicker-loading-bg"
          style={{ backgroundImage: `url(${CLICKER_ASSETS.bgLoading})` }}
          aria-hidden
        />
        <p className="clicker-loading-text">CORE를 깨우는 중…</p>
        <p className="clicker-loading-sub">세이브 불러오는 중</p>
        <p className="clicker-loading-hint">자동 저장 키는 그대로 유지됩니다</p>
      </div>
    )
  }

  if (game.isCompleted) {
    return (
      <ClickerComplete
        meta={game.save.metaState}
        worldlineTotal={game.config.transcendence.length}
        onReset={game.adminReset}
      />
    )
  }

  if (!game.save.settings.gameStarted) {
    return (
      <div data-clicker className="clicker-shell clicker-shell-title">
        <ClickerTitle
          muted={game.save.settings.muted}
          onToggleMute={game.toggleMute}
          onStart={() => {
            setTab("upgrades")
            setHubView("entrance")
            setDrawerSnap("half")
            game.startFromTitle()
          }}
        />
        {game.toast ? (
          <button
            type="button"
            className="clicker-toast"
            role="status"
            aria-keyshortcuts="Escape"
            aria-live="polite"
            aria-label={`${game.toast} — 탭 또는 Esc로 닫기`}
            onClick={game.dismissToast}
          >
            <span className="clicker-toast-msg">{game.toast}</span>
            <span className="clicker-toast-dismiss" aria-hidden>
              탭 · Esc
            </span>
          </button>
        ) : null}
      </div>
    )
  }

  const hud = game.hud
  const run = game.save.runState
  const inMine = game.save.settings.playSurface === "mine"
  // Last tick time (~100ms fresh) keeps render pure instead of reading Date.now().
  const tickNow = run.lastTickAt
  const mineRemainMs = Math.max(0, run.mineSessionEndsAt - tickNow)
  const mineRemainSec = mineRemainMs / 1000
  const mineDurationMs = Math.max(1, run.mineSessionDurationMs || 10_000)
  const mineHaul = Math.max(0, run.coreEnergy - (run.mineSessionCoreAtEnter || 0))
  const mineCooldownSec = Math.ceil((game.mineGate?.cooldownLeftMs ?? 0) / 1000)
  const mineEntryCost = game.mineGate?.cost ?? 0
  const stageBg = inMine
    ? CLICKER_ASSETS.bgMine
    : game.currentRegion?.isHome
      ? CLICKER_ASSETS.bgMineEntrance
      : (game.currentRegion?.bgAssetId ?? CLICKER_ASSETS.bgChamber)
  const transcendenceUnlocked = hud.canRebirth
  const rebirthRatio = Math.min(1, run.lifetimeCoreEnergy / hud.rebirthRequirement)
  const showTranscendenceTab = transcendenceUnlocked || rebirthRatio >= 0.25
  const transcendenceOwned = new Set(game.save.metaState.transcendenceIds).size
  const transcendenceTotal = game.config.transcendence.length
  const visibleSkillNodes = game.skillNodes.filter(
    (node) => transcendenceUnlocked || node.branch !== "TRANSCENDENCE",
  )
  const drawerTabs = (
    [
      ["producers", "PRODUCERS", "생산자"],
      ["upgrades", "UPGRADES", "업그레이드"],
      ["skills", "SKILLS", "스킬 회로"],
      ["shop", "SHOP", "상점"],
      ["world", "WORLD", "지역"],
      ["achievements", "RECORDS", "업적"],
      ...(showTranscendenceTab ? ([["transcendence", "TRANSCENDENCE", "초월"]] as const) : []),
    ] as const
  )
  const instClass =
    hud.instability.level === "CRISIS"
      ? "is-crisis"
      : hud.instability.level === "HIGH"
        ? "is-high"
        : hud.instability.level === "MID"
          ? "is-warn"
          : ""
  const automationBuff =
    run.ownedSkillNodeIds.some((id) => id.startsWith("auto_")) ||
    game.save.metaState.transcendenceIds.includes("auto_line") ||
    run.activeBuffs.some((buff) => buff.id === "overclock" && buff.expiresAt > tickNow)

  const panelProps = { game, run, popIcons, bumpIcon }

  const atHomeHub = !inMine && Boolean(game.currentRegion?.isHome)
  const regionIntroPlaying = Boolean(game.regionIntro)
  const managing = !inMine && hubView === "manage"

  const beginEnterMine = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    // Refused entries (cooldown / cost) skip the cinematic; enterMine shows the reason.
    if (reduced || game.mineEntryError()) {
      setDrawerSnap("peek")
      game.enterMine()
      return
    }
    // Mining stays blocked and the timer unstarted until the cinematic ends.
    setEnteringMine(true)
  }
  const drawerClassMode = managing ? "full" : drawerMode

  return (
    <div
      data-clicker
      data-visual={hud.coreVisual}
      className={`clicker-shell${pendingRebirth ? " is-rebirth-active" : ""}${inMine ? " is-mine-surface" : ""}${atHomeHub ? " is-entrance-hub" : ""}${!inMine && !atHomeHub ? " is-region-hub" : ""}${inMine ? "" : ` is-view-${hubView}`}`}
    >
      <header className="clicker-top">
        {!inMine ? (
          <div className="clicker-metric" aria-label={`CORE 에너지 ${formatNumber(run.coreEnergy)} · 초당 ${formatNumber(game.snapshot?.perSecond ?? 0)}`}>
            <span>CORE 에너지</span>
            <strong>
              <CountUpNumber value={run.coreEnergy} />
            </strong>
            <em>
              +<CountUpNumber value={game.snapshot?.perSecond ?? 0} />/s
            </em>
          </div>
        ) : (
          <div
            className="clicker-metric clicker-metric-mine-timer"
            aria-label={`광산 남은 시간 ${mineRemainSec.toFixed(1)}초`}
            role="timer"
          >
            <span>MINE TIMER</span>
            <strong>{mineRemainSec.toFixed(1)}s</strong>
            <em>자동 퇴장</em>
          </div>
        )}
        {hud.fever.ready && !hud.fever.active && !hud.crisisActive ? (
          <button
            type="button"
            className="clicker-metric clicker-metric-action is-fever-ready"
            aria-label="게이지 FEVER 준비됨 — 탭하여 시작"
            title="게이지 FEVER · 탭하여 시작"
            onClick={() => {
              flashStage()
              game.startFever()
            }}
          >
            <span>{hud.fever.phaseLabel}</span>
            <div className={`clicker-bar is-fever`}>
              <i style={{ width: "100%" }} />
            </div>
            <em>준비 · 탭</em>
          </button>
        ) : (
          <div
            className="clicker-metric"
            aria-label={
              hud.fever.active
                ? `${hud.fever.phaseLabel} · 남음 ${hud.fever.remainingSeconds.toFixed(1)}초`
                : run.fever.phase === "COOL_DOWN"
                  ? `쿨다운 · 남음 ${hud.fever.remainingSeconds.toFixed(1)}초`
                  : `${hud.fever.phaseLabel} · 게이지 ${Math.round(run.fever.gauge)}퍼센트`
            }
          >
            <span>{hud.fever.phaseLabel}</span>
            <div
              className={`clicker-bar ${hud.fever.active ? "is-fever" : ""}${run.fever.phase === "COOL_DOWN" ? " is-cooldown" : ""}`}
              aria-hidden
            >
              <i style={{ width: `${Math.round(hud.fever.progress * 100)}%` }} />
            </div>
            <em>
              {hud.fever.active
                ? hud.fever.finisherReady
                  ? `피니셔 · ${hud.fever.remainingSeconds.toFixed(1)}초`
                  : `${hud.fever.remainingSeconds.toFixed(1)}초`
                : run.fever.phase === "COOL_DOWN"
                  ? `${hud.fever.remainingSeconds.toFixed(1)}초`
                  : `${Math.round(run.fever.gauge)}%`}
            </em>
          </div>
        )}
        <div
          className="clicker-metric"
          aria-label={`불안정 ${Math.round(hud.instability.value)}퍼센트 · ${hud.instability.label}${hud.crisisActive ? " · 위기 선택 필요" : ""}`}
        >
          <span>불안정</span>
          <div className={`clicker-bar ${instClass}`} aria-hidden>
            <i style={{ width: `${Math.round(hud.instability.value)}%` }} />
          </div>
          <em>
            {Math.round(hud.instability.value)}% · {hud.instability.label}
          </em>
        </div>
        {transcendenceUnlocked || game.save.metaState.rebirthCount > 0 ? (
          showTranscendenceTab ? (
            <button
              type="button"
              className={`clicker-metric clicker-metric-action${tab === "transcendence" ? " is-active" : ""}`}
              aria-label="TRANSCENDENCE 열기"
              onClick={() => selectTab("transcendence")}
            >
              <span>WORLD LINE</span>
              <strong>#{String(run.currentWorldLine).padStart(3, "0")}</strong>
              <em>
                {transcendenceUnlocked ? "초월 가능 · 열기" : `환생 ${game.save.metaState.rebirthCount}`}
              </em>
            </button>
          ) : (
            <div className="clicker-metric">
              <span>WORLD LINE</span>
              <strong>#{String(run.currentWorldLine).padStart(3, "0")}</strong>
              <em>환생 {game.save.metaState.rebirthCount}</em>
            </div>
          )
        ) : showTranscendenceTab ? (
          <button
            type="button"
            className={`clicker-metric clicker-metric-action${tab === "transcendence" ? " is-active" : ""}`}
            aria-label={`초월 진행 ${Math.round(rebirthRatio * 100)}퍼센트 — TRANSCENDENCE 열기`}
            onClick={() => selectTab("transcendence")}
          >
            <span>TRANSCENDENCE</span>
            <div className="clicker-bar">
              <i style={{ width: `${Math.round(rebirthRatio * 100)}%` }} />
            </div>
            <em>{Math.round(rebirthRatio * 100)}% · 열기</em>
          </button>
        ) : null}
        <button
          type="button"
          className={`clicker-save-pulse is-${game.savePulse}`}
          aria-live="polite"
          aria-label={
            game.savePulse === "saving"
              ? "진행 상황 저장 중"
              : game.savePulse === "saved"
                ? "진행 상황 저장됨 — 탭하여 다시 저장"
                : "자동 저장 대기 — 탭하여 지금 저장"
          }
          title="탭하여 지금 저장"
          onClick={() => {
            if (game.savePulse === "saving") return
            game.forceSave()
          }}
          disabled={game.savePulse === "saving"}
        >
          {game.savePulse === "saving" ? "저장 중…" : game.savePulse === "saved" ? "저장됨" : "자동 저장"}
        </button>
        <button
          type="button"
          className="clicker-settings-launch"
          aria-label="설정 열기 — 효과음·배경음악"
          aria-haspopup="dialog"
          onClick={() => setSettingsOpen(true)}
        >
          설정
        </button>
      </header>

      <div className="clicker-stage">
        <div
          className={`clicker-stage-bg ${stageEvent ? "is-event" : ""}${regionTransition ? " is-region-transition" : ""}${inMine && hud.fever.active ? " is-fever" : ""}`}
          style={{ backgroundImage: `url(${stageBg})` }}
          aria-hidden
        />
        <div className="clicker-vignette" />
        <nav className="clicker-stage-region" aria-label="현재 지역">
          {game.currentRegion ? (
            <span className="clicker-stage-region-slot">
              <button
                type="button"
                className="clicker-stage-region-name is-here"
                aria-current="location"
                aria-label={`${game.currentRegion.name} · 현재 위치 — WORLD에서 전체 보기`}
                onClick={() => selectTab("world")}
              >
                <span className="clicker-stage-region-here-mark" aria-hidden>
                  ●
                </span>
                {game.currentRegion.name}
              </button>
              <span className="clicker-stage-region-tip" role="tooltip">
                <strong>{game.currentRegion.name} · 현재</strong>
                {game.currentRegion.description}
                {game.currentRegion.bonusText ? (
                  <em className="clicker-stage-region-tip-meta">{game.currentRegion.bonusText}</em>
                ) : null}
              </span>
            </span>
          ) : null}
          {game.regions
            .filter((region) => region.unlocked && !region.isCurrent && !region.isHome)
            .map((region) => (
              <span key={region.id} className="clicker-stage-region-slot">
                <button
                  type="button"
                  className="clicker-stage-region-jump"
                  aria-label={`${region.name}(으)로 이동 — ${region.bonusText}`}
                  onClick={() => game.travelRegion(region.id)}
                >
                  → {region.name}
                </button>
                <span className="clicker-stage-region-tip" role="tooltip">
                  <strong>{region.name}</strong>
                  {region.description}
                  <em className="clicker-stage-region-tip-meta">
                    {region.bonusText}
                    {region.unlockRequirement ? ` · ${region.unlockRequirement}` : ""}
                  </em>
                </span>
              </span>
            ))}
          {game.currentRegion?.isHome &&
          !game.regions.some((region) => region.unlocked && !region.isHome) ? (
            <span className="clicker-stage-region-slot">
              <button
                type="button"
                className="clicker-stage-region-explore"
                aria-label="WORLD에서 지역 해금 조건 보기"
                title="WORLD · 해금 조건"
                onClick={() => selectTab("world")}
              >
                WORLD · 해금 보기
              </button>
              <span className="clicker-stage-region-tip" role="tooltip">
                <strong>아직 열린 목적지 없음</strong>
                누적 CORE로 지역을 해금하면 여기서 바로 이동할 수 있습니다.
              </span>
            </span>
          ) : null}
          {!game.currentRegion?.isHome ? (
            <span className="clicker-stage-region-slot">
              <button
                type="button"
                className="clicker-stage-region-home"
                aria-label="Core Mine으로 돌아가기"
                onClick={() => game.returnHome()}
              >
                ← Core Mine
              </button>
              <span className="clicker-stage-region-tip" role="tooltip">
                <strong>Core Mine · 홈</strong>
                {game.regions.find((r) => r.isHome)?.description ?? ""}
              </span>
            </span>
          ) : null}
        </nav>
        <div className="clicker-core-wrap">
          {inMine ? (
            <div className="clicker-mine-dig">
              <div className="clicker-mine-hud" role="status" aria-live="polite">
                <div className="clicker-mine-hud-stat" aria-label={`채굴량 ${formatNumber(mineHaul)}`}>
                  <span>채굴량</span>
                  <strong>{formatNumber(mineHaul)}</strong>
                </div>
                <div
                  className="clicker-mine-hud-stat"
                  role="timer"
                  aria-label={`남은 시간 ${mineRemainSec.toFixed(1)}초`}
                >
                  <span>남은 시간</span>
                  <strong>{mineRemainSec.toFixed(1)}s</strong>
                </div>
                {game.drill?.owned ? (
                  <button
                    type="button"
                    className={`clicker-mine-overdrive${game.drill.overdriveLeftMs > 0 ? " is-active" : ""}`}
                    disabled={game.drill.overdriveLeftMs <= 0 && game.drill.readyInMs > 0}
                    aria-label={
                      game.drill.overdriveLeftMs > 0
                        ? `드릴 과부하 중 · ${Math.ceil(game.drill.overdriveLeftMs / 1000)}초`
                        : game.drill.readyInMs > 0
                          ? `드릴 과부하 재충전 ${Math.ceil(game.drill.readyInMs / 1000)}초`
                          : "드릴 과부하 — 30초간 자동 채굴 ×3"
                    }
                    onClick={game.drillOverdrive}
                  >
                    <span>드릴 과부하</span>
                    <strong>
                      {game.drill.overdriveLeftMs > 0
                        ? `${Math.ceil(game.drill.overdriveLeftMs / 1000)}s`
                        : game.drill.readyInMs > 0
                          ? `${Math.ceil(game.drill.readyInMs / 60_000)}분`
                          : "READY"}
                    </strong>
                  </button>
                ) : null}
                <div className="clicker-bar clicker-mine-hud-bar" aria-hidden>
                  <i
                    style={{
                      width: `${Math.max(0, Math.min(100, (mineRemainMs / mineDurationMs) * 100))}%`,
                    }}
                  />
                </div>
              </div>
              {game.config.potions.some((p) => (run.potions[p.id] ?? 0) > 0) ? (
                <div className="clicker-mine-potions" role="toolbar" aria-label="보유 포션">
                  {game.config.potions
                    .filter((potion) => (run.potions[potion.id] ?? 0) > 0)
                    .map((potion) => {
                      const count = run.potions[potion.id] ?? 0
                      const feverBusy = hud.fever.active || run.fever.phase === "COOL_DOWN"
                      const isActivePotion = hud.fever.active && run.fever.potionId === potion.id
                      const needsConfirm = potion.id === "overdrive" && confirmPotion === potion.id
                      let state: "ready" | "active" | "busy" | "crisis" | "confirm" = "ready"
                      let statusLabel = "준비"
                      if (hud.crisisActive) {
                        state = "crisis"
                        statusLabel = "위기"
                      } else if (isActivePotion) {
                        state = "active"
                        statusLabel = `${hud.fever.remainingSeconds.toFixed(0)}초`
                      } else if (feverBusy) {
                        state = "busy"
                        statusLabel = run.fever.phase === "COOL_DOWN" ? "쿨다운" : "FEVER"
                      } else if (needsConfirm) {
                        state = "confirm"
                        statusLabel = "확인"
                      }
                      const disabled = hud.crisisActive || feverBusy
                      return (
                        <button
                          key={potion.id}
                          type="button"
                          className={`clicker-mine-potion is-${state}${(popIcons[potion.id] ?? 0) > 0 ? " is-pop-icon" : ""}`}
                          disabled={disabled}
                          aria-label={`${potion.name} · ${statusLabel} · 보유 ${count}`}
                          title={`${potion.name} · ${potion.description}`}
                          onClick={() => {
                            if (potion.id === "overdrive" && confirmPotion !== potion.id) {
                              setConfirmPotion(potion.id)
                              return
                            }
                            setConfirmPotion(null)
                            bumpIcon(potion.id)
                            flashStage()
                            game.drinkPotion(potion.id)
                          }}
                        >
                          <img key={`${potion.id}-${popIcons[potion.id] ?? 0}`} src={potion.assetId} alt="" />
                          <span className="clicker-mine-potion-count">{count}</span>
                        </button>
                      )
                    })}
                </div>
              ) : null}
              <ClickerMine
                visual={mineVisual}
                muted={game.save.settings.muted}
                pop={pop}
                shake={shake}
                onMine={(clientX, clientY) => game.clickCore(clientX, clientY)}
                onPop={() => {
                  setPop(true)
                  window.setTimeout(() => setPop(false), 100)
                }}
                playLaser={playLaser}
                autoRate={game.drill?.rate ?? 0}
                onVein={game.claimVein}
                onOreBroken={game.oreBroken}
              />
            </div>
          ) : atHomeHub ? (
            <button
              type="button"
              className={`clicker-hub-enter-only${mineCooldownSec > 0 ? " is-cooling" : ""}`}
              aria-label={
                mineCooldownSec > 0
                  ? `Enter Mine · 재입장 대기 ${mineCooldownSec}초`
                  : mineEntryCost > 0
                    ? `Enter Mine · 입장료 CORE ${mineEntryCost}`
                    : "Enter Mine"
              }
              disabled={enteringMine}
              onClick={beginEnterMine}
            >
              Enter Mine
              {mineCooldownSec > 0 ? (
                <span className="clicker-hub-enter-sub">재입장 {mineCooldownSec}초</span>
              ) : mineEntryCost > 0 ? (
                <span className="clicker-hub-enter-sub">입장료 {formatNumber(mineEntryCost)} CORE</span>
              ) : null}
            </button>
          ) : game.currentRegion?.activity || game.currentRegion?.challenge ? (() => {
            // Away from home there is no mine: the region's own activity and challenge take the stage.
            const region = game.currentRegion
            const act = region.activity
            const challenge = region.challenge
            const busy = (act?.activeMs ?? 0) > 0
            const cooling = (act?.readyInMs ?? 0) > 0
            return (
              <div className="clicker-region-station" aria-label={`${region.name} · 지역 활동`}>
                <p className="clicker-region-station-kicker">{region.name} · 지역 활동</p>
                {challenge ? (
                  <button
                    type="button"
                    className="clicker-region-activity is-challenge"
                    disabled={challenge.readyInMs > 0 || regionIntroPlaying}
                    title={challenge.description}
                    aria-label={`${challenge.name} · ${challenge.description}`}
                    onClick={() => {
                      if (game.canStartChallenge(region.id)) setChallengeRegionId(region.id)
                    }}
                  >
                    <strong>▶ {challenge.name}</strong>
                    <span>
                      {challenge.readyInMs > 0
                        ? `재도전 ${Math.ceil(challenge.readyInMs / 1000)}초`
                        : challenge.description}
                    </span>
                  </button>
                ) : null}
                {act ? (
                  <button
                    type="button"
                    className={`clicker-region-activity${busy ? " is-active" : ""}`}
                    disabled={cooling || regionIntroPlaying}
                    title={act.description}
                    aria-label={`${act.name} · ${act.description}`}
                    onClick={() => game.regionActivity(region.id)}
                  >
                    <strong>{act.name}</strong>
                    <span>
                      {busy
                        ? `진행 중 ${Math.ceil(act.activeMs / 1000)}초${act.deposit > 0 ? ` · 예치 ${formatNumber(act.deposit)}` : ""}`
                        : cooling
                          ? `재사용 ${Math.ceil(act.readyInMs / 1000)}초`
                          : act.description}
                    </span>
                  </button>
                ) : null}
                <p className="clicker-region-station-note">광산은 Core Mine에서만 열립니다.</p>
              </div>
            )
          })() : null}
          {hud.comboText ? (
            <div
              className="clicker-combo"
              role="status"
              aria-live="polite"
              aria-label={`${hud.comboText}${hud.comboRemainText ? ` · ${hud.comboRemainText}` : ""}`}
            >
              <strong className="clicker-combo-main">{hud.comboText}</strong>
              {hud.comboRemainText ? <span className="clicker-combo-remain">{hud.comboRemainText}</span> : null}
            </div>
          ) : null}
          {hud.crisisActive ? (
            <div
              ref={crisisRef}
              className="clicker-crisis"
              role="alertdialog"
              aria-labelledby="clicker-crisis-title"
              aria-describedby="clicker-crisis-body"
            >
              <p className="clicker-crisis-kicker">불안정 · 위기</p>
              <h2 id="clicker-crisis-title">CORE CRISIS · 위기</h2>
              <p id="clicker-crisis-body">구조가 불안정합니다. 하나를 고르면 위기가 해소됩니다.</p>
              <div className="clicker-crisis-actions">
                <button
                  className="clicker-primary"
                  type="button"
                  aria-label="안정화 — 안전 · 보유 CORE 일부 손실"
                  onClick={() => game.resolveCrisis("STABILIZE")}
                >
                  <strong>안정화</strong>
                  <span>안전 · 보유 CORE 일부 손실</span>
                </button>
                <button
                  className="clicker-danger"
                  type="button"
                  aria-label="위험 감수 — 보상 가능 · 결과 불확실"
                  onClick={() => game.resolveCrisis("RISK_IT")}
                >
                  <strong>위험 감수</strong>
                  <span>보상 가능 · 결과 불확실</span>
                </button>
                <button
                  className="clicker-danger"
                  type="button"
                  aria-label="비상 오버클럭 — 즉시 생산 분출 · 변동 큼"
                  onClick={() => game.resolveCrisis("EMERGENCY_OVERCLOCK")}
                >
                  <strong>비상 오버클럭</strong>
                  <span>즉시 생산 분출 · 변동 큼</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
        {!inMine ? (
          <aside
            className="clicker-goal"
            aria-label={`현재 목표 · ${hud.currentGoal.title} · ${hud.currentGoal.progressText}`}
          >
            <p className="clicker-goal-kicker">현재 목표</p>
            <h2 className="clicker-goal-title">{hud.currentGoal.title}</h2>
            <p className="clicker-goal-progress">{hud.currentGoal.progressText}</p>
            <div className="clicker-bar clicker-goal-bar" aria-hidden>
              <i style={{ width: `${Math.round(hud.currentGoal.ratio * 100)}%` }} />
            </div>
            {hud.currentGoal.lumaLine ? <p className="clicker-goal-line">{hud.currentGoal.lumaLine}</p> : null}
          </aside>
        ) : null}
        {!inMine ? (
        <div
          className="clicker-goal-compact"
          role="status"
          aria-label={`현재 목표 · ${hud.currentGoal.title} · ${hud.currentGoal.progressText}`}
        >
          <span className="clicker-goal-compact-kicker">목표</span>
          <strong className="clicker-goal-compact-title">{hud.currentGoal.title}</strong>
          <span className="clicker-goal-compact-progress">{hud.currentGoal.progressText}</span>
          <div className="clicker-bar clicker-goal-compact-bar" aria-hidden>
            <i style={{ width: `${Math.round(hud.currentGoal.ratio * 100)}%` }} />
          </div>
        </div>
        ) : null}
        {!inMine ? (
          <nav className="clicker-hub-dock" aria-label="관리 화면으로 이동">
            {drawerTabs.map(([id, label, ko]) => (
              <button
                key={id}
                type="button"
                className="clicker-hub-dock-btn"
                aria-label={`${ko} 화면 열기`}
                onClick={() => selectTab(id)}
              >
                <strong>{ko}</strong>
                <span>{label}</span>
              </button>
            ))}
          </nav>
        ) : null}
      </div>

      <div className="clicker-actions">
        {game.config.activeSkills
          .filter((skill) => (run.skillItems[skill.id] ?? 0) > 0)
          .map((skill) => {
          const cd = run.skillCooldowns[skill.id] ?? 0
          const charges = run.skillItems[skill.id] ?? 0
          const skillTip = `${skill.name} — ${skill.description}`
          const skillState = hud.crisisActive ? "crisis" : cd > 0 ? "cooldown" : "ready"
          const skillStatus =
            skillState === "cooldown"
              ? `${charges} · 쿨다운`
              : skillState === "crisis"
                ? `${charges} · 위기`
                : `${charges} · 준비`
          return (
            <span key={skill.id} className="clicker-action-slot">
              <button
                className={`clicker-item clicker-skill-item is-${skillState}${(popIcons[skill.id] ?? 0) > 0 ? " is-pop-icon" : ""}`}
                type="button"
                disabled={cd > 0 || hud.crisisActive}
                aria-label={`${skillTip} · ${skillStatus}`}
                title={skillTip}
                onClick={() => {
                  bumpIcon(skill.id)
                  flashStage()
                  game.useSkill(skill.id)
                }}
              >
                <img key={`${skill.id}-${popIcons[skill.id] ?? 0}`} src={skill.assetId} alt="" />
                <span>
                  {skill.name}
                  <br />
                  <small>
                    {charges} · {skillState === "ready" ? "준비" : skillState === "cooldown" ? "쿨다운" : "위기"}
                  </small>
                </span>
              </button>
              <span className="clicker-action-tip" role="tooltip">
                <strong>{skill.name}</strong>
                {skill.description}
                <em className="clicker-action-tip-state">
                  {skillState === "ready"
                    ? "준비됨 · 탭하여 사용"
                    : skillState === "cooldown"
                      ? "쿨다운이 끝나면 다시 사용"
                      : "위기 중 사용 불가"}
                </em>
              </span>
            </span>
          )
        })}
      </div>

      <aside
        className={`clicker-drawer is-${drawerClassMode}${drawerDragging ? " is-dragging" : ""}`}
        style={managing ? undefined : { height: drawerHeight }}
      >
        {managing ? (
          <div className="clicker-manage-head">
            <button
              type="button"
              className="clicker-manage-back"
              aria-label={`${atHomeHub ? "광산 입구" : (game.currentRegion?.name ?? "지역")}(으)로 돌아가기 · Esc`}
              onClick={() => setHubView("entrance")}
            >
              ◀ {atHomeHub ? "광산 입구" : (game.currentRegion?.name ?? "지역")}
            </button>
            <span className="clicker-manage-title">
              {drawerTabs.find(([id]) => id === tab)?.[2] ?? ""}
            </span>
            <span className="clicker-manage-esc" aria-hidden>
              Esc
            </span>
          </div>
        ) : null}
        <div
          hidden={managing}
          className="clicker-drawer-handle"
          role="separator"
          aria-orientation="horizontal"
          aria-label="하단 패널 높이 조절"
          onPointerDown={onDrawerHandlePointerDown}
          onPointerMove={onDrawerHandlePointerMove}
          onPointerUp={finishDrawerDrag}
          onPointerCancel={finishDrawerDrag}
          onClick={onDrawerHandleClick}
        >
          <span className="clicker-drawer-grab" aria-hidden />
          <div className="clicker-drawer-handle-row">
            <span className="clicker-drawer-hint">
              {drawerMode === "peek"
                ? "위로 당겨 패널 열기"
                : drawerMode === "full"
                  ? "아래로 내려 광산 보기 · Esc"
                  : "드래그로 높이 조절"}
            </span>
            <button
              type="button"
              className="clicker-drawer-toggle"
              aria-expanded={drawerMode !== "peek"}
              aria-label={
                drawerMode === "full"
                  ? "하단 패널 접기 · Esc로도 가능"
                  : drawerMode === "peek"
                    ? "하단 패널 펼치기"
                    : "하단 패널 높이 전환"
              }
              onClick={(e) => {
                e.stopPropagation()
                if (drawerMode === "full") setDrawerSnap("peek")
                else setDrawerSnap("full")
              }}
            >
              {drawerMode === "full" ? "접기" : "펼치기"}
            </button>
          </div>
        </div>

        <nav className="clicker-tabs" aria-label="하단 패널 탭">
          {drawerTabs.map(([id, label, ko]) => (
            <button
              key={id}
              type="button"
              data-active={tab === id}
              aria-label={ko}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => selectTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <section className="clicker-panel">
        {tab === "achievements" ? <ClickerAchievementsPanel game={game} meta={game.save.metaState} /> : null}
        {tab === "producers" ? (
          <ClickerProducersPanel {...panelProps} automationBuff={automationBuff} />
        ) : null}

        {tab === "upgrades" ? <ClickerUpgradesPanel game={game} run={run} /> : null}

        {tab === "shop" ? <ClickerShopPanel {...panelProps} /> : null}

        {tab === "skills" ? (
          <ClickerSkillTree nodes={visibleSkillNodes} coreEnergy={run.coreEnergy} onBuy={game.buySkill} />
        ) : null}

        {tab === "world" ? <ClickerWorldPanel game={game} run={run} onBack={() => selectTab("producers")} /> : null}

        {tab === "transcendence" && showTranscendenceTab ? (
          <ClickerTranscendencePanel
            {...panelProps}
            meta={game.save.metaState}
            onSelectTab={selectTab}
            onOpenEnding={() => setEndingOpen(true)}
            onChoose={(buff) => setPendingRebirth({ id: buff.id, label: buff.name })}
          />
        ) : null}
        </section>

        <footer className="clicker-drawer-foot">
          <span>
            CORE <strong>{formatNumber(run.coreEnergy)}</strong>
            {game.snapshot ? ` · +${formatNumber(game.snapshot.perSecond)}/s` : ""}
            {tab === "skills"
              ? ` · 회로 ${visibleSkillNodes.filter((n) => n.status === "OWNED").length}/${visibleSkillNodes.length}`
              : tab === "world"
                ? ` · 해금 ${game.regions.filter((r) => r.unlocked).length}/${game.regions.length}`
                : tab === "transcendence"
                  ? ` · 세계선 ${transcendenceOwned}/${transcendenceTotal}`
                  : ""}
          </span>
          <span className="clicker-drawer-foot-hint">{DRAWER_FOOT_HINT[tab]}</span>
        </footer>
      </aside>

      {settingsOpen ? (
        <ClickerSettings
          muted={game.save.settings.muted}
          musicMuted={game.save.settings.musicMuted}
          musicVolume={game.save.settings.musicVolume}
          onToggleMute={game.toggleMute}
          onToggleMusic={game.toggleMusic}
          onMusicVolume={game.setMusicVolume}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {game.mineSummary && !inMine && !enteringMine ? (
        <ClickerMineResult
          summary={game.mineSummary}
          cooldownSec={mineCooldownSec}
          onClose={game.dismissMineSummary}
        />
      ) : null}

      {enteringMine ? (
        <ClickerCinematic
          src={MineArt.enterCinematic}
          poster={MineArt.entranceGate}
          label="광산 입장 중"
          muted={game.save.settings.muted}
          onDone={() => {
            setEnteringMine(false)
            setDrawerSnap("peek")
            game.enterMine()
          }}
        />
      ) : null}

      {(() => {
        const region = challengeRegionId ? game.regions.find((r) => r.id === challengeRegionId) : null
        if (!region?.challenge) return null
        return (
          <ClickerRegionChallenge
            key={region.id}
            kind={region.challenge.kind}
            name={region.challenge.name}
            description={region.challenge.description}
            durationSec={region.challenge.durationSec}
            muted={game.save.settings.muted}
            onFinish={(score) => {
              setChallengeRegionId(null)
              game.claimChallenge(region.id, score)
            }}
            onCancel={() => setChallengeRegionId(null)}
          />
        )
      })()}

      {game.regionIntro ? (
        <ClickerCinematic
          key={game.regionIntro.regionId}
          src={game.regionIntro.video}
          poster={game.regionIntro.poster}
          label={`${game.regionIntro.name} 첫 진입`}
          caption={{
            kicker: "NEW REGION · 첫 진입",
            title: game.regionIntro.name,
            body: game.regionIntro.description,
          }}
          muted={game.save.settings.musicMuted}
          onDone={game.dismissRegionIntro}
        />
      ) : null}

      {game.floats.map((f) => (
        <div
          key={f.id}
          className={`clicker-float ${f.critical ? "is-crit" : ""}${f.strike ? ` is-${f.strike}` : ""}`}
          style={{ left: f.x || "50%", top: f.y || "45%" }}
          aria-hidden
        >
          {f.strike === "quake" ? "지진파 " : f.strike === "lightning" ? "번개 " : f.strike === "echo" ? "잔향 " : ""}
          {f.critical ? "치명타 " : ""}
          {f.text}
        </div>
      ))}

      {storyBeat ? (
        <div
          ref={storyBeatRef}
          className="clicker-story-beat"
          role="dialog"
          aria-modal="false"
          aria-label="LUMA 알림"
          aria-describedby="clicker-story-beat-body"
          tabIndex={0}
          onClick={() => setStoryBeat(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              setStoryBeat(null)
            }
          }}
        >
          <img src={CLICKER_ASSETS.luma} alt="" width={40} height={40} />
          <div>
            <strong>LUMA</strong>
            <p id="clicker-story-beat-body">{storyBeat}</p>
            <span className="clicker-story-beat-hint">탭 또는 Esc로 닫기</span>
          </div>
        </div>
      ) : null}

      {game.toast ? (
        <button
          type="button"
          className="clicker-toast"
          role="status"
          aria-keyshortcuts="Escape"
          aria-live="polite"
          aria-label={`${game.toast} — 탭 또는 Esc로 닫기`}
          onClick={game.dismissToast}
        >
          <span className="clicker-toast-msg">{game.toast}</span>
          <span className="clicker-toast-dismiss" aria-hidden>
            탭 · Esc
          </span>
        </button>
      ) : null}
      {CLICKER_ADMIN_UI && adminAllowed && !adminOpen ? (
        <button
          type="button"
          className="clicker-admin-launch"
          aria-label="임시 관리자 패널 열기"
          title="개발 전용 · Esc로 닫기"
          onClick={() => setAdminOpen(true)}
        >
          관리자
        </button>
      ) : null}

      {pendingRebirth ? (
        <ClickerRebirthMotion
          key={pendingRebirth.id}
          transcendenceId={pendingRebirth.id}
          worldlineLabel={pendingRebirth.label}
          muted={game.save.settings.muted}
          onComplete={() => {
            const chosen = pendingRebirth
            game.rebirth(chosen.id)
            setPendingRebirth((cur) => (cur?.id === chosen.id ? null : cur))
            setTab("producers")
          }}
        />
      ) : null}

      {endingOpen ? (
        <ClickerEnding
          summary={{
            worldlinesOwned: transcendenceOwned,
            worldlinesTotal: transcendenceTotal,
            rebirthCount: game.save.metaState.rebirthCount,
            lifetimeCoreText: formatNumber(game.save.metaState.totalCoreEnergy),
          }}
          onCancel={() => setEndingOpen(false)}
          onComplete={() => {
            if (game.completeEnding()) setEndingOpen(false)
          }}
        />
      ) : null}

      {CLICKER_ADMIN_UI && adminAllowed && adminOpen ? (
        <aside
          ref={adminRef}
          className="clicker-admin"
          role="dialog"
          aria-modal="true"
          aria-label="임시 관리자"
        >
          <h2>임시 관리자 · 플레이테스트</h2>
          <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--text-2)" }}>
            개발 전용 · loopback 또는 ?admin=1 · production 빌드에서 UI·치트 모두 차단 · Esc로 닫기
          </p>
          <div className="clicker-admin-grid">
            <button type="button" className="clicker-primary" aria-label="치트 · CORE 1천 지급" onClick={() => game.adminGrant(1_000)}>
              +1K CORE
            </button>
            <button type="button" className="clicker-primary" onClick={() => game.adminGrant(100_000)}>
              +100K CORE
            </button>
            <button type="button" className="clicker-primary" onClick={() => game.adminGrant(10_000_000)}>
              +10M CORE
            </button>
            <button type="button" className="clicker-primary" aria-label="치트 · FEVER 게이지 충전" onClick={game.adminFillFever}>
              FEVER 충전
            </button>
            <button type="button" className="clicker-primary" onClick={game.adminPotions}>
              물약 +5
            </button>
            <button type="button" className="clicker-primary" onClick={game.adminUnlock}>
              해금/CORE
            </button>
            <button type="button" className="clicker-danger" aria-label="치트 · CORE CRISIS 발동" onClick={game.adminCrisis}>
              CRISIS
            </button>
            {!adminResetArmed ? (
              <button type="button" className="clicker-danger" onClick={() => setAdminResetArmed(true)}>
                세이브 초기화…
              </button>
            ) : (
              <button
                type="button"
                className="clicker-danger"
                onClick={() => {
                  setAdminResetArmed(false)
                  game.adminReset()
                }}
              >
                확인 · 전부 삭제 (8초)
              </button>
            )}
          </div>
          {adminResetArmed ? (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "color-mix(in srgb, #9ec4d0 75%, white)" }}>
              플레이테스트 전용 · 로컬 세이브가 즉시 삭제됩니다. Esc/패널 닫기 또는 8초 후 취소.
            </p>
          ) : null}
          <button
            type="button"
            className="clicker-ghost"
            style={{ marginTop: 8, width: "100%" }}
            aria-keyshortcuts="Escape"
            onClick={() => {
              setAdminResetArmed(false)
              setAdminOpen(false)
            }}
          >
            패널 닫기 · Esc
          </button>
        </aside>
      ) : null}
    </div>
  )
}
