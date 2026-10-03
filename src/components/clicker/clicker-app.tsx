"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { CLICKER_ASSETS, clickerConfig } from "@/data/clicker/catalog"
import {
  ARMORS,
  CLICKER_ADMIN_REMEMBER_KEY,
  CLICKER_PRELAUNCH,
  INSTABILITY_WARNING,
  LAIR_BOSSES,
  WEAPONS,
  drillCooldownMs,
  formatNumber,
  gearOf,
  isClickerAdminAllowed,
  isRegionUnlocked,
  monsterAlive,
  relicVaultOpen,
  shouldMountMineChamber,
  shouldShowManageScreen,
  type ClickerScreenTabId,
  shieldRemainingMs,
  activeSkillBarHint,
  activeSkillBarShortLabel,
  activeSkillBarStatusLine,
  isActiveSkillBarDisabled,
  resolveActiveSkillBarState,
} from "@/application/clicker-ui"
import { useClicker } from "@/hooks/use-clicker"
import { useClickerBgm } from "@/hooks/use-clicker-bgm"
import { clickerBgmControls, clickerBgmScene } from "@/application/clicker-audio"
import { ClickerComplete } from "@/components/clicker/clicker-complete"
import { ClickerEnding } from "@/components/clicker/clicker-ending"
import { ClickerMine, type MineFxTier } from "@/components/clicker/clicker-mine"
import { ClickerCinematic, preloadCinematic } from "@/components/clicker/clicker-cinematic"
import { ClickerRegionChallenge } from "@/components/clicker/clicker-region-challenge"
import { MineArt } from "@/data/clicker/mine-assets"
import { ClickerMineResult } from "@/components/clicker/clicker-mine-result"
import { ClickerOtherTab } from "@/components/clicker/clicker-other-tab"
import { ClickerRebirthMotion } from "@/components/clicker/clicker-rebirth-motion"
import { ClickerSettings } from "@/components/clicker/clicker-settings"
import { collectImagePaths, useDecodedSrc, useImagePreload } from "@/components/clicker/clicker-preload"
import { ClickerImageZoom } from "@/components/clicker/clicker-image-zoom"
import { ClickerPurchaseFx } from "@/components/clicker/clicker-purchase-fx"
import { ClickerSkillTree } from "@/components/clicker/clicker-skill-tree"
import { ClickerLoading } from "@/components/clicker/clicker-loading"
import { ClickerTitle } from "@/components/clicker/clicker-title"
import { ClickerLoginGate } from "@/components/clicker/clicker-login-gate"
import { ClickerBossScene } from "@/components/clicker/clicker-boss-scene"
import { ClickerForge } from "@/components/clicker/clicker-forge"
import { ClickerRelicVault } from "@/components/clicker/clicker-relic-vault"
import { ClickerBossFight } from "@/components/clicker/clicker-boss"
import { ClickerTutorial } from "@/components/clicker/clicker-tutorial"
import { ClickerHpBar } from "@/components/clicker/clicker-hpbar"
import { useClickerAccount } from "@/hooks/use-clicker-account"
import type { SfxName } from "@/lib/clicker-sfx"
import { useClickerDialogFocus } from "@/components/clicker/clicker-a11y"
import { playLaser, playSfx, unlockSfx } from "@/lib/clicker-sfx"
import { ClickerAchievementsPanel } from "@/components/clicker/panels/achievements-panel"
import { ClickerProducersPanel } from "@/components/clicker/panels/producers-panel"
import { ClickerUpgradesPanel } from "@/components/clicker/panels/upgrades-panel"
import { ClickerShopPanel } from "@/components/clicker/panels/shop-panel"
import { ClickerWorldPanel } from "@/components/clicker/panels/world-panel"
import { ClickerTranscendencePanel } from "@/components/clicker/panels/transcendence-panel"
import { CurrencyIcon } from "@/components/clicker/clicker-currency-icon"
import "./clicker.css"
import "./clicker-polish.css"

/** Next inlines NODE_ENV — production builds dead-code-eliminate admin JSX. */
const CLICKER_ADMIN_UI =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_CLICKER_ADMIN === "1" || CLICKER_PRELAUNCH

/** Nova colour each active skill paints across the mine when cast. */
/** Spark Strike unlocks lightning; before it the mine shows no bolts. */
const LIGHTNING_SKILL_ID = "storm_spark"
/** How long a finished boss fight stays on screen (death / knockout) before returning to the world still. */
const BOSS_EXIT_DELAY_MS = 2200

const SKILL_NOVA_COLOR: Record<string, string> = {
  overclock: "rgb(255 120 60 / 0.9)",
  core_pulse: "rgb(120 240 255 / 0.9)",
  stabilizer: "rgb(120 255 190 / 0.85)",
  laser_focus: "rgb(255 90 140 / 0.9)",
  time_warp: "rgb(190 140 255 / 0.9)",
  grid_boost: "rgb(255 220 110 / 0.9)",
}

/** Number keys 1–9 cast owned skills in bar order (ignored while typing). */
function ClickerSkillHotkeys({ onSlot }: { onSlot: (slot: number) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || !/^Digit[1-9]$/.test(e.code)) return
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      onSlot(Number(e.code.slice(5)) - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onSlot])
  return null
}

/** Strike spectacle by worlds opened (0–5); FEVER adds one more step. */
const FX_TIER_BY_WORLDS: MineFxTier[] = [0, 1, 2, 2, 3, 3]

type TabId = "producers" | "upgrades" | "skills" | "shop" | "forge" | "relics" | "world" | "achievements" | "transcendence"

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

/** Button kind → click cue, so different kinds of buttons sound different. */
function buttonCue(el: Element): SfxName {
  if (el.closest(".clicker-tabs, .clicker-hub-dock, .clicker-stage-region")) return "nav"
  if (el.matches(".clicker-manage-back, .clicker-skillmap-close, .clicker-ghost")) return "back"
  if (el.matches(".clicker-settings-launch, .clicker-drawer-toggle, .clicker-hub-enter-only")) return "open"
  if (el.closest(".clicker-skillmap-node, .clicker-producer-card")) return "select"
  if (el.matches(".clicker-danger")) return "danger"
  if (el.matches(".clicker-settings-toggle")) return "toggle"
  if (el.matches(".clicker-primary")) return "confirm"
  return "tap"
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

/** Stage backdrop that keeps the previous image until the next is decoded (no blank/stale flash). */
function StageBg({ src, className }: { src: string; className: string }) {
  const shown = useDecodedSrc(src)
  return <div className={className} style={{ backgroundImage: `url(${shown})` }} aria-hidden />
}

const PRELOAD_IMAGES = collectImagePaths(CLICKER_ASSETS, MineArt, clickerConfig)

const GATE_KEY = "aurelia-clicker-login-gate"

/** Guest choice lasts for this tab only, so every new visit starts at the login screen. */
function readGatePassed(): boolean {
  try {
    return typeof window !== "undefined" && window.sessionStorage.getItem(GATE_KEY) === "1"
  } catch {
    return false
  }
}

function rememberGatePassed() {
  try {
    window.sessionStorage.setItem(GATE_KEY, "1")
  } catch {
    /* private mode: the gate simply shows again next load */
  }
}

export function ClickerApp() {
  const game = useClicker()
  const account = useClickerAccount({
    getSaveJson: game.exportSaveJson,
    applySaveJson: (json) => game.importSaveJson(json, "클라우드 진행을 불러왔습니다"),
  })
  /** The login gate was passed in this tab (logged in, or chose to play as a guest). */
  const [gatePassed, setGatePassed] = useState(readGatePassed)
  useImagePreload(PRELOAD_IMAGES)
  // Door-walk entry cinematic between Enter Mine and the timed session (carries its own SFX).
  const [enteringMine, setEnteringMine] = useState(false)
  /** Region whose field challenge is open (mini-game overlay), or null. */
  const [challengeRegionId, setChallengeRegionId] = useState<string | null>(null)
  const [drillHits, setDrillHits] = useState(0)

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

  // Every button press clicks. Mining targets have their own laser / vein sounds.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target.closest("button") : null
      if (!el || el.disabled || !el.closest("[data-clicker]")) return
      if (el.closest(".clicker-mine-crystal, .clicker-mine-vein-gold, [data-sfx='off']")) return
      playSfx(buttonCue(el))
    }
    window.addEventListener("click", onClick, true)
    return () => window.removeEventListener("click", onClick, true)
  }, [])

  const [tab, setTab] = useState<TabId>("upgrades")
  const [screenTab, setScreenTab] = useState<ClickerScreenTabId>("mine")
  // Hub splits into the mine entrance scene and a full-screen management screen.
  const [hubView, setHubView] = useState<"entrance" | "manage">("entrance")
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminAllowed, setAdminAllowed] = useState(false)
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
  const prevObjectiveId = useRef<string | null>(null)
  const prevRegionId = useRef<string | null>(null)
  const prevUnlockedRegionIds = useRef<Set<string> | null>(null)
  const [regionTransition, setRegionTransition] = useState(false)
  const drawerSnaps = useMemo(() => drawerSnapPoints(), [])
  const [drawerHeight, setDrawerHeight] = useState(readDrawerHeight)
  const [drawerDragging, setDrawerDragging] = useState(false)
  const drawerDraggingRef = useRef(false)
  const drawerDrag = useRef({ startY: 0, startH: 0, moved: false })
  const storyBeatRef = useRef<HTMLDivElement | null>(null)
  const adminRef = useRef<HTMLElement | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [skillMapOpen, setSkillMapOpen] = useState(false)
  /** Ending sequence after the guardian falls: two videos, then the story cards. */
  const [endingPhase, setEndingPhase] = useState<"fall" | "awaken" | null>(null)

  const bgm = clickerBgmControls(game.save?.settings, game.otherTabActive, game.hud?.coreVisual)
  useClickerBgm(bgm.visual, {
    scene: clickerBgmScene({
      bootLoading: !game.save,
      enteringMine,
      regionIntro: game.regionIntro,
      endingPhase,
      pendingRebirth: Boolean(pendingRebirth),
      endingOpen,
      playSurface: game.save?.settings.playSurface ?? "hub",
      currentRegionId: game.save?.runState.currentRegionId,
      bossFight: Boolean(game.save?.runState.boss),
    }),
    muted: bgm.muted,
    volume: bgm.volume,
  })


  useClickerDialogFocus(storyBeatRef, Boolean(storyBeat))
  useClickerDialogFocus(adminRef, CLICKER_ADMIN_UI && adminAllowed && adminOpen)

  // One auto-dismiss for every story beat. The triggers below used to own their timers,
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

  const setDrawerSnap = useCallback(
    (snap: "peek" | "half" | "full") => {
      const height = drawerSnaps[snap]
      setDrawerHeight(height)
      persistDrawerHeight(height)
    },
    [drawerSnaps, persistDrawerHeight],
  )

  const drawerMode =
    drawerHeight <= drawerSnaps.peek + 16 ? "peek" : drawerHeight >= drawerSnaps.full - 24 ? "full" : "half"

  /** The forge opens with the third world (Phase Vault), where the first boss lairs are. */
  const forgeUnlocked = Boolean(game.regions[2]?.unlocked)
  const selectTab = useCallback(
    (id: TabId) => {
      if (id === "forge" && !forgeUnlocked) {
        game.refuse("아직 해금되지 않았습니다!")
        return
      }
      if (id === "skills") {
        setSkillMapOpen(true)
        return
      }
      if (id === "transcendence") playSfx("transcend")
      setTab(id)
      setHubView("manage")
      if (drawerHeight <= drawerSnaps.peek + 16) {
        setDrawerHeight(drawerSnaps.half)
        persistDrawerHeight(drawerSnaps.half)
      }
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`.clicker-tabs button[data-active="true"]`)
          ?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" })
      })
    },
    [drawerHeight, drawerSnaps, persistDrawerHeight, forgeUnlocked, game],
  )

  const playSurface = game.save?.settings.playSurface ?? "hub"
  const relicsOpen = game.save ? relicVaultOpen(game.save.metaState) : false
  const prevSurface = useRef(playSurface)
  useEffect(() => {
    if (!game.save?.settings.gameStarted) return
    if (prevSurface.current === playSurface) return
    prevSurface.current = playSurface
    if (playSurface === "mine") {
      setDrawerSnap("peek")
    } else {
      setHubView("entrance")
      setDrawerSnap("half")
    }
  }, [playSurface, game.save?.settings.gameStarted, setDrawerSnap])

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
    const snapped = nearestDrawerSnap(drawerHeight)
    setDrawerHeight(snapped)
    persistDrawerHeight(snapped)
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

  useEffect(() => {
    // Defense in depth: build strip + host/?admin gate (never production).
    // Do not auto-open the panel — launch button keeps the mine playable.
    if (!CLICKER_ADMIN_UI) {
      setAdminAllowed(false)
      setAdminOpen(false)
      return
    }
    // `?admin=1` remembered for pre-launch builds (or set NEXT_PUBLIC_CLICKER_ADMIN=1 for playtest builds).
    try {
      if (new URLSearchParams(window.location.search).get("admin") === "1" && (CLICKER_PRELAUNCH || process.env.NEXT_PUBLIC_CLICKER_ADMIN === "1")) {
        window.localStorage.setItem(CLICKER_ADMIN_REMEMBER_KEY, "1")
      }
    } catch {
      /* storage blocked — the query still works for this visit */
    }
    setAdminAllowed(isClickerAdminAllowed())
  }, [])

  // Esc / back: layered dismiss for overlays + drawer/tab chrome (no focus trap).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      // Rebirth, settings and the skill map own Esc themselves.
      if (pendingRebirth || settingsOpen || skillMapOpen || endingPhase) return

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
      if (game.toast) {
        e.preventDefault()
        game.dismissToast()
        return
      }
      if (hubView === "manage" && game.save?.settings.playSurface !== "mine") {
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
    skillMapOpen,
    endingPhase,
    endingOpen,
    adminOpen,
    game.toast,
    game.dismissToast,
    confirmPotion,
    storyBeat,
    drawerMode,
    setDrawerSnap,
    tab,
    selectTab,
    hubView,
    game.save?.settings.playSurface,
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
  const [skillNova, setSkillNova] = useState<{ key: number; color: string } | null>(null)
  /** Away from home a world opens on its intro still; picking its action reveals the live scene. */
  const [engagedRegion, setEngagedRegion] = useState<string | null>(null)
  const [arrivedRegion, setArrivedRegion] = useState<string | null>(null)
  /** Cast a skill with its full-screen nova (button or number-key hotkey). */
  const castSkill = (id: string) => {
    bumpIcon(id)
    flashStage()
    game.useSkill(id)
    setSkillNova((prev) => ({ key: (prev?.key ?? 0) + 1, color: SKILL_NOVA_COLOR[id] ?? "rgb(150 230 255 / 0.85)" }))
  }

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

  const prevCanRebirth = useRef<boolean | null>(null)
  useEffect(() => {
    const unlocked = Boolean(game.hud?.canRebirth)
    if (prevCanRebirth.current === null) {
      prevCanRebirth.current = unlocked
      return
    }
    if (unlocked && !prevCanRebirth.current) {
      setStoryBeat("환생할 수 있습니다. 상단 WORLD LINE을 누르세요.")
    }
    prevCanRebirth.current = unlocked
  }, [game.hud?.canRebirth])

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
      // Arriving somewhere drops you straight onto the main screen.
      setHubView("entrance")
      const timer = window.setTimeout(() => setRegionTransition(false), 280)
      prevRegionId.current = regionId
      return () => window.clearTimeout(timer)
    }
    prevRegionId.current = regionId
  }, [game.currentRegion?.id])

  useEffect(() => {
    const unlockedIds = new Set(game.regions.filter((r) => r.unlocked).map((r) => r.id))
    if (prevUnlockedRegionIds.current === null) {
      prevUnlockedRegionIds.current = unlockedIds
      return
    }
    const fresh = game.regions.find(
      (r) => r.unlocked && !r.isHome && !prevUnlockedRegionIds.current!.has(r.id),
    )
    prevUnlockedRegionIds.current = unlockedIds
    if (!fresh) return
    setStoryBeat(`새 지역 해금 · ${fresh.name}`)
  }, [game.regions])

  // Keyed on the objective id only: depending on the whole save re-fired the beat every tick,
  // so a dismissed line popped straight back up.
  const objectiveId = game.save?.runState.currentObjectiveId
  useEffect(() => {
    if (!objectiveId) return
    const prev = prevObjectiveId.current
    prevObjectiveId.current = objectiveId
    if (!prev || prev === objectiveId) return
    const obj = game.config.objectives.find((o) => o.id === objectiveId)
    if (obj?.line) setStoryBeat(obj.line)
  }, [objectiveId, game.config.objectives])

  // Event cues that can start without a click (gauge auto-FEVER, crisis roll).
  const feverActive = Boolean(game.hud?.fever.active)
  const prevFeverActive = useRef(feverActive)
  useEffect(() => {
    if (feverActive && !prevFeverActive.current) playSfx("fever")
    prevFeverActive.current = feverActive
  }, [feverActive])

  // Instability: one warning on the way up past 70%, then at 100% the core collapses on its own.
  const instabilityValue = game.hud?.instability.value ?? 0
  const prevInstability = useRef(instabilityValue)
  useEffect(() => {
    if (instabilityValue >= INSTABILITY_WARNING && prevInstability.current < INSTABILITY_WARNING) {
      playSfx("timerWarn")
      game.notify(`경고 · 불안정 ${Math.round(instabilityValue)}% — 100%가 되면 CORE의 절반을 잃습니다`)
    }
    prevInstability.current = instabilityValue
  }, [instabilityValue, game])
  const collapseAt = game.save?.runState.lastCollapse?.at ?? 0
  const prevCollapseAt = useRef(collapseAt)
  useEffect(() => {
    if (collapseAt && collapseAt !== prevCollapseAt.current) {
      playSfx("crisis")
      game.notify(`코어 붕괴 · CORE ${formatNumber(game.save?.runState.lastCollapse?.loss ?? 0)} 손실 (50%)`)
    }
    prevCollapseAt.current = collapseAt
  }, [collapseAt, game])

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

  // Warm the videos the player is about to see: mine entry at home, intros of unlocked unvisited regions.
  const atHomeNow = Boolean(game.currentRegion?.isHome)
  const visited = game.save?.metaState.visitedRegionIds
  const unlockedKey = game.regions.filter((r) => r.unlocked).map((r) => r.id).join(",")
  useEffect(() => {
    const idle = window.setTimeout(() => {
      if (atHomeNow) preloadCinematic(MineArt.enterCinematic)
      for (const id of unlockedKey.split(",")) {
        const intro = game.config.regions.find((r) => r.id === id)?.intro
        if (intro && !visited?.includes(id)) preloadCinematic(intro.video)
      }
    }, 1500)
    return () => window.clearTimeout(idle)
  }, [atHomeNow, unlockedKey, visited, game.config.regions])

  const bossDefeated = Boolean(game.save?.metaState.bossDefeated)
  const prevBossDefeated = useRef<boolean | null>(null)
  const bossFighting = Boolean(game.save?.runState.boss)
  useEffect(() => {
    if (bossDefeated || bossFighting) {
      preloadCinematic("/clicker/ending/ending_guardian_fall.mp4")
      preloadCinematic("/clicker/ending/ending_core_awaken.mp4")
    }
    if (prevBossDefeated.current === false && bossDefeated) {
      playSfx("bossDown")
      setEndingPhase("fall")
    }
    prevBossDefeated.current = bossDefeated
  }, [bossDefeated, bossFighting])

  // Lair battle feedback: every boss hit flashes the screen red; being knocked out
  // makes the boss roar in triumph and raise its shield.
  const lairPlayerHp = game.save?.runState.lair?.playerHp
  const lairRegion = game.save?.runState.currentRegionId ?? ""
  const shieldUntil = game.save?.runState.monsterShieldUntil?.[lairRegion] ?? 0
  const prevLairHp = useRef<number | undefined>(undefined)
  const prevShield = useRef(shieldUntil)
  const [hurtKey, setHurtKey] = useState(0)
  const [tauntKey, setTauntKey] = useState(0)
  useEffect(() => {
    if (lairPlayerHp !== undefined && prevLairHp.current !== undefined && lairPlayerHp < prevLairHp.current) {
      setHurtKey((k) => k + 1)
      playSfx("playerHurt")
    }
    prevLairHp.current = lairPlayerHp
  }, [lairPlayerHp])
  const prevShieldRegion = useRef(lairRegion)
  useEffect(() => {
    const sameRegion = prevShieldRegion.current === lairRegion
    prevShieldRegion.current = lairRegion
    if (sameRegion && shieldUntil > prevShield.current) {
      setHurtKey((k) => k + 1)
      setTauntKey((k) => k + 1)
      playSfx("playerHurt")
    }
    prevShield.current = shieldUntil
  }, [shieldUntil, lairRegion])

  // When a boss fight ends (knocked out or boss slain), let the finish play, then step back
  // out to the world's still screen.
  const fightOn = Boolean(game.save?.runState.lair || game.save?.runState.boss)
  const prevFightOn = useRef(fightOn)
  useEffect(() => {
    const ended = prevFightOn.current && !fightOn
    prevFightOn.current = fightOn
    if (!ended) return
    const t = window.setTimeout(() => setEngagedRegion(null), BOSS_EXIT_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [fightOn])

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
    return <ClickerLoading bgSrc={CLICKER_ASSETS.bgLoading} />
  }

  // Login comes first; the account check is quick, so hold the boot screen until it answers.
  if (!account.checked) return <ClickerLoading bgSrc={CLICKER_ASSETS.bgLoading} />
  // Already logged in when the page loaded: no gate. A login made on the gate closes it through
  // onDone, so the gate can still ask which run to keep.
  if (account.available && !gatePassed && !(account.signedInAtBoot && account.account)) {
    return (
      <div data-clicker className="clicker-shell clicker-shell-title">
        <ClickerLoginGate
          state={account}
          localTotal={game.save.metaState.totalCoreEnergy}
          onDone={() => {
            rememberGatePassed()
            setGatePassed(true)
          }}
        />
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
  const mountMineChamber = shouldMountMineChamber(screenTab, game.save, tickNow)
  const mineRemainMs = Math.max(0, run.mineSessionEndsAt - tickNow)
  const mineRemainSec = mineRemainMs / 1000
  const mineDurationMs = Math.max(1, run.mineSessionDurationMs || 10_000)
  const mineHaul = Math.max(0, run.coreEnergy - (run.mineSessionCoreAtEnter || 0))
  const mineCooldownSec = Math.ceil((game.mineGate?.cooldownLeftMs ?? 0) / 1000)
  // Every arrival (travel or return) starts on the world's still again.
  if (arrivedRegion !== run.currentRegionId) {
    setArrivedRegion(run.currentRegionId)
    setEngagedRegion(null)
  }
  const hereDef = game.config.regions.find((r) => r.id === run.currentRegionId)
  const worldStill = !inMine && !hereDef?.isHome ? hereDef?.intro?.still : undefined
  // A fight already under way (lair or guardian) always shows the live scene.
  const worldEngaged =
    !worldStill ||
    engagedRegion === run.currentRegionId ||
    Boolean(run.lair && run.lair.regionId === run.currentRegionId) ||
    Boolean(hereDef?.boss && run.boss)
  const stageBg = inMine
    ? CLICKER_ASSETS.bgMine
    : game.currentRegion?.isHome
      ? CLICKER_ASSETS.bgMineEntrance
      : worldStill && !worldEngaged
        ? worldStill
        : (game.currentRegion?.bgAssetId ?? CLICKER_ASSETS.bgChamber)
  const transcendenceUnlocked = hud.canRebirth
  const rebirthRatio = Math.min(1, run.lifetimeCoreEnergy / hud.rebirthRequirement)
  const showTranscendenceTab = transcendenceUnlocked || rebirthRatio >= 0.25
  const transcendenceOwned = new Set(game.save.metaState.transcendenceIds).size
  const transcendenceTotal = game.config.transcendence.length
  // Every circuit (all 100, transcendence branch included) stays on the board.
  const visibleSkillNodes = game.skillNodes
  const regionDef = game.config.regions.find((r) => r.id === run.currentRegionId)
  const monsterDef = regionDef?.monster
  const worldsOpen = game.config.regions.filter((r) => !r.isHome && isRegionUnlocked(run, game.config, r.id)).length
  const fxTier = Math.min(4, FX_TIER_BY_WORLDS[Math.min(worldsOpen, 5)] + (coreVisual === "fever" ? 1 : 0)) as MineFxTier
  const skillStorm = inMine && run.activeBuffs.some((b) => b.expiresAt > tickNow)
  const ownedSkills = game.config.activeSkills.filter(
    (skill) =>
      (run.skillItems[skill.id] ?? 0) > 0 ||
      (run.skillCooldowns[skill.id] ?? 0) > 0 ||
      run.activeBuffs.some((b) => b.id === skill.id && b.expiresAt > tickNow),
  )
  const monsterIsAlive = monsterDef ? monsterAlive(run, run.currentRegionId, tickNow) : false
  const lair = run.lair && run.lair.regionId === run.currentRegionId ? run.lair : null
  const shieldMs = shieldRemainingMs(run, run.currentRegionId, tickNow)
  const gear = gearOf(run)
  const drillCoolSec = Math.max(0, Math.ceil((run.drillCooldownUntil - tickNow) / 1000))
  const drillCoolTotalSec = drillCooldownMs(run, game.config) / 1000
  const drawerTabs = (
    [
      ["producers", "PRODUCERS", "생산자"],
      ["upgrades", "UPGRADES", "업그레이드"],
      ["skills", "SKILLS", "스킬"],
      ["shop", "SHOP", "상점"],
      ["forge", "FORGE", "대장간"],
      ...(relicsOpen ? ([["relics", "RELICS", "유물"]] as const) : []),
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
    (inMine && run.activeBuffs.some((buff) => buff.id === "overclock" && buff.expiresAt > tickNow))

  const panelProps = { game, run, popIcons, bumpIcon }

  const atHomeHub = !inMine && Boolean(game.currentRegion?.isHome)
  const regionIntroPlaying = Boolean(game.regionIntro)
  const managing = shouldShowManageScreen(screenTab) || (!mountMineChamber && hubView === "manage")

  const beginEnterMine = () => {
    setScreenTab("mine")
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
  const heldCurrencies = game.config.regions
    .filter((r) => r.currency && ((run.regionCurrency?.[r.id] ?? 0) > 0 || r.id === regionDef?.id || isRegionUnlocked(run, game.config, r.id)))
    .sort((x, y) => Number(y.id === regionDef?.id) - Number(x.id === regionDef?.id))

  return (
    <div
      data-clicker
      data-visual={hud.coreVisual}
      className={`clicker-shell${pendingRebirth ? " is-rebirth-active" : ""}${inMine ? " is-mine-surface" : ""}${atHomeHub ? " is-entrance-hub" : ""}${!inMine && !atHomeHub ? " is-region-hub" : ""}${inMine ? "" : ` is-view-${hubView}`}`}
    >
      <header className="clicker-top">
        {!inMine ? (
          <div className="clicker-metric" aria-label={`코어 광석 ${formatNumber(run.coreEnergy)} · 초당 ${formatNumber(game.snapshot?.perSecond ?? 0)}`}>
            <span>코어 광석</span>
            <strong>
              <CountUpNumber value={run.coreEnergy} />
            </strong>
            <em>
              +<CountUpNumber value={game.snapshot?.perSecond ?? 0} />/s
            </em>
            {heldCurrencies.length ? (
              // Every world currency the player has opened so far, the current world's first.
              <span className="clicker-metric-coins">
                {heldCurrencies.map((r) => (
                  <span
                    key={r.id}
                    className={`clicker-metric-coin${r.id === regionDef?.id ? " is-here" : ""}`}
                    title={`${r.name}에서 CORE를 벌 때마다 함께 쌓이는 월드 화폐`}
                  >
                    <CurrencyIcon regionId={r.id} /> <CountUpNumber value={run.regionCurrency?.[r.id] ?? 0} />
                    <small>{r.currency!.name}</small>
                  </span>
                ))}
              </span>
            ) : null}
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
                  : hud.fever.locked
                    ? "FEVER 잠김 · 스킬 「Fever Core」에서 해금"
                    : `${hud.fever.phaseLabel} · 게이지 ${Math.round(hud.fever.progress * 100)}퍼센트`
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
                  : hud.fever.locked
                    ? "스킬에서 해금"
                    : `${Math.round(hud.fever.progress * 100)}%`}
            </em>
          </div>
        )}
        <div
          className="clicker-metric"
          aria-label={`불안정 ${Math.round(hud.instability.value)}퍼센트 · ${hud.instability.label}`}
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
        <StageBg
          className={`clicker-stage-bg ${stageEvent ? "is-event" : ""}${regionTransition ? " is-region-transition" : ""}${inMine && hud.fever.active ? " is-fever" : ""}`}
          src={stageBg}
        />
        <div className="clicker-vignette" />
        {worldStill && !worldEngaged ? (
          <img
            key={run.currentRegionId}
            className="clicker-world-particles"
            src={`/clicker/region/${run.currentRegionId}_particles.webp`}
            alt=""
            aria-hidden
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
        ) : null}
        {!inMine && worldEngaged && monsterDef && !regionDef?.boss && LAIR_BOSSES[monsterDef.kind] ? (
          <ClickerBossScene
            key={run.currentRegionId}
            kind={monsterDef.kind}
            name={monsterDef.name}
            alive={monsterIsAlive}
            battle={lair}
            shieldMs={shieldMs}
            tauntKey={tauntKey}
            onEnter={game.enterLair}
            onStrike={(x, y) => {
              playLaser(game.save!.settings.muted, false)
              return game.strikeLair(x, y)
            }}
          />
        ) : null}
        {hurtKey ? <div key={hurtKey} className="clicker-boss-hurt" aria-hidden /> : null}
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
          {mountMineChamber ? (
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
                <button
                  type="button"
                  className={`clicker-mine-hud-stat clicker-mine-fever${hud.fever.active ? " is-active" : ""}${hud.fever.ready && !hud.fever.active ? " is-ready" : ""}`}
                  disabled={!hud.fever.ready || hud.fever.active || hud.crisisActive}
                  aria-label={
                    hud.fever.active
                      ? `FEVER · ${hud.fever.remainingSeconds.toFixed(1)}초`
                      : hud.fever.ready
                        ? "FEVER 준비됨 — 탭하여 시작"
                        : hud.fever.locked
                          ? "FEVER 잠김 · 스킬에서 해금"
                          : `FEVER 게이지 ${Math.round(hud.fever.progress * 100)}%`
                  }
                  onClick={() => {
                    flashStage()
                    game.startFever()
                  }}
                >
                  <span>FEVER</span>
                  <strong>
                    {hud.fever.active
                      ? `${hud.fever.remainingSeconds.toFixed(1)}s`
                      : run.fever.phase === "COOL_DOWN"
                        ? "쿨다운"
                        : hud.fever.ready
                          ? "READY"
                          : hud.fever.locked
                            ? "잠김"
                            : `${Math.round(hud.fever.progress * 100)}%`}
                  </strong>
                  <i style={{ width: `${Math.round(hud.fever.progress * 100)}%` }} aria-hidden />
                </button>
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
              {game.config.potions.length ? (
                <div className="clicker-mine-potions" role="toolbar" aria-label="보유 포션">
                  {game.config.potions
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
                      const disabled = count <= 0 || hud.crisisActive || feverBusy
                      return (
                        <button
                          key={potion.id}
                          type="button"
                          className={`clicker-mine-potion is-${state}${count <= 0 ? " is-empty" : ""}${(popIcons[potion.id] ?? 0) > 0 ? " is-pop-icon" : ""}`}
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
              {ownedSkills.length ? (
                <div className="clicker-mine-skills" role="toolbar" aria-label="보유 스킬">
                  {ownedSkills.map((skill, slot) => {
                    const cd = run.skillCooldowns[skill.id] ?? 0
                    const charges = run.skillItems[skill.id] ?? 0
                    const buff = run.activeBuffs.find((b) => b.id === skill.id && b.expiresAt > tickNow)
                    const buffLeft = buff ? Math.ceil((buff.expiresAt - tickNow) / 1000) : 0
                    const state = hud.crisisActive ? "crisis" : buff ? "active" : cd > 0 ? "cooldown" : "ready"
                    const status =
                      state === "active" ? `${buffLeft}초 지속` : state === "cooldown" ? `쿨다운 ${Math.ceil(cd)}초` : state === "crisis" ? "위기" : "준비"
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        className={`clicker-mine-skill is-${state}${(popIcons[skill.id] ?? 0) > 0 ? " is-pop-icon" : ""}`}
                        disabled={cd > 0 || charges <= 0 || hud.crisisActive}
                        aria-label={`${skill.name} · ${status} · 보유 ${charges}`}
                        title={`${skill.name} · ${skill.description}`}
                        style={cd > 0 ? ({ "--cd": `${Math.min(100, (cd / skill.cooldown) * 100)}%` } as React.CSSProperties) : undefined}
                        onClick={() => castSkill(skill.id)}
                      >
                        <img key={`${skill.id}-${popIcons[skill.id] ?? 0}`} src={skill.assetId} alt="" />
                        {slot < 9 ? <kbd className="clicker-mine-skill-key">{slot + 1}</kbd> : null}
                        {state === "active" || state === "cooldown" ? (
                          <b className="clicker-mine-skill-time">{state === "active" ? buffLeft : Math.ceil(cd)}</b>
                        ) : null}
                        <span className="clicker-mine-potion-count">{charges}</span>
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
                onOreBroken={game.oreBroken}
                fxTier={fxTier}
                storm={skillStorm}
                lightning={run.ownedSkillNodeIds.includes(LIGHTNING_SKILL_ID)}
                nova={skillNova}
              />
            </div>
          ) : atHomeHub ? (
            <button
              type="button"
              className={`clicker-hub-enter-only${mineCooldownSec > 0 ? " is-cooling" : ""}`}
              aria-label={
                mineCooldownSec > 0
                  ? `Enter Mine · 재입장 대기 ${mineCooldownSec}초`
                  : "Enter Mine"
              }
              disabled={enteringMine}
              onClick={beginEnterMine}
            >
              Enter Mine
              {mineCooldownSec > 0 ? (
                <span className="clicker-hub-enter-sub">재입장 {mineCooldownSec}초</span>
              ) : null}
            </button>
          ) : worldStill && !worldEngaged && regionDef ? (
            <div className="clicker-region-station clicker-world-gate">
              <p className="clicker-region-station-kicker">{regionDef.name}</p>
              <p className="clicker-world-gate-desc">{regionDef.description}</p>
              <button
                type="button"
                className="clicker-primary clicker-world-gate-go"
                disabled={regionIntroPlaying}
                onClick={() => setEngagedRegion(run.currentRegionId)}
              >
                {regionDef.boss
                  ? `${regionDef.boss.name}에게 맞서기`
                  : regionDef.huntMode && monsterDef
                    ? `${monsterDef.name} 사냥하기`
                    : "코어 에너지 시추하기"}
              </button>
            </div>
          ) : regionDef?.boss ? (
            <ClickerBossFight
              def={regionDef.boss}
              fight={run.boss}
              now={tickNow}
              defeated={bossDefeated}
              onStart={game.startBoss}
              onStrike={(x, y) => {
                playLaser(game.save!.settings.muted, false)
                game.strikeBoss(x, y)
              }}
            />
          ) : regionDef?.huntMode && monsterDef ? (
            <div className={`clicker-region-station clicker-hunt-station${lair ? " is-battle" : ""}`} aria-live="polite">
              <p className="clicker-region-station-kicker">{game.currentRegion?.name} · {lair ? "토벌 중" : "보스의 둥지"}</p>
              {lair ? (
                <>
                  <div className="clicker-lair-player">
                    <ClickerHpBar
                      tone="player"
                      value={lair.playerHp}
                      max={lair.playerMaxHp}
                      label="내 체력"
                      valueText={`${Math.max(0, lair.playerHp)} / ${lair.playerMaxHp}`}
                      ariaLabel={`내 체력 ${lair.playerHp}/${lair.playerMaxHp}`}
                    />
                  </div>
                  <p className="clicker-drill-hint">
                    {WEAPONS[gear.weapon].name} (피해 {WEAPONS[gear.weapon].damage}) · {ARMORS[gear.armor].name}
                  </p>
                  <button type="button" className="clicker-ghost clicker-lair-leave" onClick={game.leaveLair}>
                    후퇴하기
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="clicker-primary clicker-lair-enter"
                    disabled={!monsterIsAlive || shieldMs > 0}
                    onClick={game.enterLair}
                  >
                    {shieldMs > 0
                      ? `보호막 · ${Math.floor(Math.ceil(shieldMs / 1000) / 60)}:${String(Math.ceil(shieldMs / 1000) % 60).padStart(2, "0")}`
                      : monsterIsAlive
                        ? `${monsterDef.name} 토벌하러 들어가기`
                        : "보스가 돌아오는 중…"}
                  </button>
                </>
              )}
            </div>
          ) : game.currentRegion && !game.currentRegion.isHome && !regionDef?.boss ? (
            // Away from home there is no mine: drill the region's core vein for CORE instead.
            <div className="clicker-region-station clicker-drill-station" aria-label={`${game.currentRegion.name} · 코어 에너지 시추`}>
              <p className="clicker-region-station-kicker">{game.currentRegion.name} · 코어 에너지 시추</p>
              <button
                type="button"
                data-sfx="off"
                key={drillHits}
                className={`clicker-drill${drillHits ? " is-hit" : ""}${drillCoolSec > 0 ? " is-cooling" : ""}`}
                disabled={regionIntroPlaying || drillCoolSec > 0}
                aria-label={drillCoolSec > 0 ? `시추 장비 냉각 중 ${drillCoolSec}초` : `코어 에너지 시추 · 게이지 ${Math.round(run.drillGauge * 100)}%`}
                onPointerDown={(e) => {
                  if (e.button !== 0) return
                  e.preventDefault()
                  const paid = game.drillVein(e.clientX, e.clientY)
                  if (paid === null) return
                  playLaser(game.save?.settings.muted ?? false, paid > 0)
                  if (paid > 0) flashStage()
                  setDrillHits((n) => n + 1)
                }}
              >
                {/* The rig stands on a rock bed; each tap plunges it in and kicks up debris. */}
                <span className="clicker-drill-ground" aria-hidden />
                <img src="/clicker/drill/scifi_drill.webp" alt="" draggable={false} />
                <span className="clicker-drill-glow" aria-hidden />
                <span className="clicker-drill-ground is-front" aria-hidden />
                {drillHits ? (
                  <>
                  <span className="clicker-drill-gush" aria-hidden />
                  <span className="clicker-drill-debris" aria-hidden>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <i key={i} style={{ ["--i" as string]: i }} />
                    ))}
                  </span>
                  </>
                ) : null}
              </button>
              <div className={`clicker-drill-gauge${drillCoolSec > 0 ? " is-cooling" : ""}`} aria-hidden>
                <i style={{ width: `${drillCoolSec > 0 ? (drillCoolSec / drillCoolTotalSec) * 100 : run.drillGauge * 100}%` }} />
              </div>
              <p className="clicker-drill-hint">
                {drillCoolSec > 0 ? `냉각 중 · ${drillCoolSec}초 후 다시 시추` : `연속으로 탭해 게이지를 채우면 시추 · ${Math.round(run.drillGauge * 100)}%`}
              </p>
            </div>
          ) : null}
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
        </div>
        {!inMine ? (
          <nav className="clicker-hub-dock" aria-label="관리 화면으로 이동">
            {drawerTabs.map(([id, label, ko]) => (
              <button
                key={id}
                type="button"
                className={`clicker-hub-dock-btn${id === "forge" && !forgeUnlocked ? " is-locked" : ""}`}
                aria-label={id === "forge" && !forgeUnlocked ? `${ko} · 잠김` : `${ko} 화면 열기`}
                onClick={() => selectTab(id)}
              >
                <strong>{ko}</strong>
                <span>{label}</span>
              </button>
            ))}
          </nav>
        ) : null}
      </div>

      <ClickerSkillHotkeys
        onSlot={(n) => {
          const skill = ownedSkills[n]
          if (!inMine || !skill || (run.skillItems[skill.id] ?? 0) <= 0 || (run.skillCooldowns[skill.id] ?? 0) > 0 || game.hud?.crisisActive) return
          castSkill(skill.id)
        }}
      />
      <div className="clicker-actions">
        {ownedSkills.map((skill, slot) => {
          const cd = run.skillCooldowns[skill.id] ?? 0
          const charges = run.skillItems[skill.id] ?? 0
          const skillTip = `${skill.name} — ${skill.description}`
          const skillState = resolveActiveSkillBarState({
            crisisActive: hud.crisisActive,
            cooldownMs: cd,
            charges,
          })
          const skillStatus = activeSkillBarStatusLine(skillState, charges)
          return (
            <span key={skill.id} className="clicker-action-slot">
              <button
                className={`clicker-item clicker-skill-item is-${skillState}${(popIcons[skill.id] ?? 0) > 0 ? " is-pop-icon" : ""}`}
                type="button"
                disabled={isActiveSkillBarDisabled(skillState)}
                aria-label={`${skillTip} · ${skillStatus}`}
                title={skillTip}
                onClick={() => castSkill(skill.id)}
              >
                <img key={`${skill.id}-${popIcons[skill.id] ?? 0}`} src={skill.assetId} alt="" />
                {slot < 9 ? <kbd className="clicker-skill-key">{slot + 1}</kbd> : null}
                <span>
                  {skill.name}
                  <br />
                  <small>
                    {charges} · {activeSkillBarShortLabel(skillState)}
                  </small>
                </span>
              </button>
              <span className="clicker-action-tip" role="tooltip">
                <strong>{skill.name}</strong>
                {skill.description}
                <em className="clicker-action-tip-state">{activeSkillBarHint(skillState)}</em>
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
        {managing || (inMine && drawerMode !== "peek") ? (
        <>
        {tab === "achievements" ? <ClickerAchievementsPanel game={game} meta={game.save.metaState} /> : null}
        {tab === "producers" ? (
          <ClickerProducersPanel {...panelProps} automationBuff={automationBuff} />
        ) : null}

        {tab === "upgrades" ? <ClickerUpgradesPanel game={game} run={run} /> : null}

        {tab === "shop" ? <ClickerShopPanel {...panelProps} /> : null}
        {tab === "forge" && forgeUnlocked ? <ClickerForge game={game} run={run} /> : null}
        {tab === "relics" && relicsOpen ? <ClickerRelicVault game={game} run={run} meta={game.save.metaState} /> : null}


        {tab === "world" ? <ClickerWorldPanel game={game} run={run} onBack={() => selectTab("producers")} /> : null}

        {tab === "transcendence" && showTranscendenceTab ? (
          <ClickerTranscendencePanel
            {...panelProps}
            meta={game.save.metaState}
            onSelectTab={selectTab}
            onChoose={(buff) => {
              setPendingRebirth({ id: buff.id, label: buff.name })
            }}
          />
        ) : null}
        </>
        ) : null}
        </section>

        <footer className="clicker-drawer-foot">
          <span>
            CORE <strong>{formatNumber(run.coreEnergy)}</strong>
            {game.snapshot ? ` · +${formatNumber(game.snapshot.perSecond)}/s` : ""}
            {tab === "skills"
              ? ` · 회로 ${visibleSkillNodes.filter((n) => n.status === "OWNED").length}/${visibleSkillNodes.length}`
              : tab === "world"
                ? ` · 개방 ${game.regions.filter((r) => r.unlocked).length}곳`
                : tab === "transcendence"
                  ? ` · 세계선 ${transcendenceOwned}/${transcendenceTotal}`
                  : ""}
          </span>
        </footer>
      </aside>

      <ClickerImageZoom />
      <ClickerPurchaseFx fx={game.purchaseFx} />
      {settingsOpen ? (
        <ClickerSettings
          muted={game.save.settings.muted}
          musicMuted={game.save.settings.musicMuted}
          musicVolume={game.save.settings.musicVolume}
          onToggleMute={game.toggleMute}
          onToggleMusic={game.toggleMusic}
          onMusicVolume={game.setMusicVolume}
          onReset={() => {
            setSettingsOpen(false)
            game.adminReset()
          }}
          onExportCode={game.exportSaveCode}
          onParseCode={game.parseSaveCode}
          onImportJson={game.importSaveJson}
          account={account}
          onSecretAdmin={() => {
            try {
              window.localStorage.setItem(CLICKER_ADMIN_REMEMBER_KEY, "1")
            } catch {
              /* storage blocked — admin stays on for this visit only */
            }
            setAdminAllowed(true)
            game.notify("관리자 모드 켜짐")
          }}
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
          muted={game.save.settings.musicMuted}
          volume={game.save.settings.musicVolume}
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
          label={`${game.regionIntro.name} 입장`}
          caption={{
            title: game.regionIntro.name,
            body: game.regionIntro.description,
          }}
          muted={game.save.settings.musicMuted}
          volume={game.save.settings.musicVolume}
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
          aria-label="알림"
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
          <div>
            <p id="clicker-story-beat-body">{storyBeat}</p>
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

      {skillMapOpen ? (
        <ClickerSkillTree
          nodes={visibleSkillNodes}
          coreEnergy={run.coreEnergy}
          onBuy={game.buySkill}
          onClose={() => setSkillMapOpen(false)}
        />
      ) : null}

      {game.save.settings.gameStarted && !game.save.settings.tutorialSeen ? (
        <ClickerTutorial onDone={game.finishTutorial} admin={CLICKER_ADMIN_UI && adminAllowed} hidden={inMine} />
      ) : null}

      {endingPhase ? (
        <ClickerCinematic
          key={endingPhase}
          src={endingPhase === "fall" ? "/clicker/ending/ending_guardian_fall.mp4" : "/clicker/ending/ending_core_awaken.mp4"}
          poster={endingPhase === "fall" ? "/clicker/bg/region_core_heart.jpg" : "/clicker/bg/loading_core_awakening.webp"}
          label="엔딩"
          muted={game.save.settings.musicMuted}
          volume={game.save.settings.musicVolume}
          onDone={() => {
            if (endingPhase === "fall") setEndingPhase("awaken")
            else {
              setEndingPhase(null)
              setEndingOpen(true)
            }
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
            플레이테스트 · ?admin=1 또는 설정 제목 7번 탭(이 브라우저에 기억) · 운영 빌드는 NEXT_PUBLIC_CLICKER_ADMIN=1 없으면 숨김 · Esc로 닫기
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
            <button type="button" className="clicker-primary" onClick={() => game.adminGrant(Math.max(1e12, (game.save?.runState.coreEnergy ?? 0) * 100))}>
              CORE ×100
            </button>
            <button type="button" className="clicker-primary" aria-label="치트 · 코어 하트 해금" onClick={() => game.adminUnlockRegion("core_heart")}>
              코어 하트 해금
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
            <button type="button" className="clicker-primary" onClick={() => game.adminGrantAllCurrencies(1_000_000)}>
              지역 재화 +1M
            </button>
            <button type="button" className="clicker-primary" onClick={game.adminSkipTutorial}>
              튜토리얼 건너뛰기
            </button>
            <button
              type="button"
              className="clicker-primary"
              onClick={() => {
                game.adminReplayTutorial()
                setAdminOpen(false)
              }}
            >
              튜토리얼 다시 보기
            </button>
            <button
              type="button"
              className="clicker-primary"
              aria-label="치트 · 최종 보스로 이동"
              onClick={() => {
                game.adminJumpFinalBoss()
                setAdminOpen(false)
              }}
            >
              최종 보스로 점프
            </button>
            <button
              type="button"
              className={`clicker-primary${game.adminModes.god ? " is-on" : ""}`}
              aria-pressed={game.adminModes.god}
              onClick={game.adminToggleGod}
            >
              갓 모드 {game.adminModes.god ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              className={`clicker-primary${game.adminModes.speed > 1 ? " is-on" : ""}`}
              onClick={game.adminCycleSpeed}
            >
              속도 ×{game.adminModes.speed}
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
