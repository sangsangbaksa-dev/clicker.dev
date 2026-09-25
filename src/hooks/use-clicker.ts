"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  clickerAdminGrant,
  clickerAdminPatch,
  clickerBuyActiveSkill,
  clickerBuyProducer,
  clickerBuyPotion,
  clickerBuySkill,
  clickerBuyUpgrade,
  clickerCanCompleteEnding,
  clickerClaimVein,
  clickerClick,
  clickerCompleteEnding,
  clickerDrillOverdrive,
  clickerDrinkPotion,
  clickerEnterMine,
  clickerMineEntryError,
  clickerMineEntryCost,
  clickerExitMine,
  clickerFinishMineSession,
  clickerGameConfig,
  clickerMineSessionStart,
  clickerOreBroken,
  clickerRebirth,
  clickerResolveCrisis,
  clickerReturnHome,
  clickerStartGaugeFever,
  clickerStartGame,
  clickerTravelRegion,
  clickerRegionActivity,
  clickerTick,
  clickerUseSkill,
  loadClickerGame,
  persistClickerGame,
} from "@/application/clicker"
import { createInitialSave } from "@/domain/services/clicker-engine"
import { clearClickerRaw } from "@/infrastructure/persistence/clicker-save"
import type { ClickerSettings, CrisisChoice, RegionIntroDef, SaveData } from "@/domain/entities/clicker"
import { productionSnapshot } from "@/domain/services/clicker-engine"
import { isClickerAdminAllowed } from "@/domain/services/clicker-admin-gate"
import { achievementProgress, autoDrillRate, baseDrillRate } from "@/domain/services/clicker-bonus"
import { formatNumber } from "@/domain/services/clicker-format"
import type { MineSessionStart, MineSessionSummary } from "@/domain/services/clicker-mine-session"
import {
  buildActiveSkillShopViews,
  buildHud,
  buildRegionViews,
  buildPotionShopViews,
  buildProducerViews,
  buildSkillNodeViews,
  buildUpgradeViews,
} from "@/domain/services/clicker-view"

export type FloatNumber = {
  id: number
  text: string
  critical: boolean
  /** Extra strike label — lightning / shockwave / echo. */
  strike?: "lightning" | "quake" | "echo"
  x: number
  y: number
}

function now() {
  return Date.now()
}

export type RegionIntro = RegionIntroDef & { regionId: string; name: string; description: string }

export function useClicker() {
  const [save, setSave] = useState<SaveData | null>(null)
  const [floats, setFloats] = useState<FloatNumber[]>([])
  const [savePulse, setSavePulse] = useState<"idle" | "saving" | "saved">("idle")
  const savePulseTimer = useRef<number | null>(null)

  const persistNow = useCallback((next?: SaveData) => {
    const target = next ?? saveRef.current
    if (!target) return
    setSavePulse("saving")
    persistClickerGame(target)
    if (savePulseTimer.current != null) window.clearTimeout(savePulseTimer.current)
    // Defer "saved" so the saving state can paint once.
    window.setTimeout(() => setSavePulse("saved"), 40)
    savePulseTimer.current = window.setTimeout(() => setSavePulse("idle"), 2200)
  }, [])

  useEffect(() => {
    return () => {
      if (savePulseTimer.current != null) window.clearTimeout(savePulseTimer.current)
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current)
    }
  }, [])
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)
  const saveRef = useRef<SaveData | null>(null)
  const floatId = useRef(0)
  const knownAchievements = useRef<Set<string> | null>(null)
  const mineStartRef = useRef<MineSessionStart | null>(null)
  const [mineSummary, setMineSummary] = useState<MineSessionSummary | null>(null)
  /** First-visit cinematic for the region just entered; null when none is playing. */
  const [regionIntro, setRegionIntro] = useState<RegionIntro | null>(null)

  useEffect(() => {
    const t = now()
    const loaded = loadClickerGame(t)
    const resumed = clickerTick(loaded, t)
    setSave(resumed)
    saveRef.current = resumed
    knownAchievements.current = new Set(resumed.metaState.achievementIds)
  }, [])

  useEffect(() => {
    saveRef.current = save
  }, [save])

  /** Mine → hub: record the session and raise the result card. Returns the save to commit. */
  const finishMine = useCallback((before: SaveData, after: SaveData) => {
    const t = now()
    const { save: recorded, summary } = clickerFinishMineSession(mineStartRef.current, before, after, t)
    mineStartRef.current = null
    setMineSummary(summary)
    return recorded
  }, [])

  useEffect(() => {
    let frame = 0
    let last = 0
    const loop = (ts: number) => {
      if (ts - last > 100) {
        last = ts
        const current = saveRef.current
        if (current && !current.metaState.gameCompleted) {
          const next = clickerTick(current, now())
          // Skip stale ticks if a commit landed while processTick ran.
          if (saveRef.current !== current) {
            frame = window.requestAnimationFrame(loop)
            return
          }
          // Keep the tick's settings: the mine-session timeout flips playSurface back to "hub".
          const committed =
            current.settings.playSurface === "mine" && next.settings.playSurface === "hub"
              ? finishMine(current, next)
              : next
          saveRef.current = committed
          setSave(committed)
        }
      }
      frame = window.requestAnimationFrame(loop)
    }
    frame = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(frame)
  }, [finishMine])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (saveRef.current) persistNow()
    }, 2500)
    const onHide = () => {
      if (saveRef.current) persistNow()
    }
    window.addEventListener("pagehide", onHide)
    document.addEventListener("visibilitychange", onHide)
    return () => {
      window.clearInterval(id)
      window.removeEventListener("pagehide", onHide)
      document.removeEventListener("visibilitychange", onHide)
    }
  }, [persistNow])

  const commit = useCallback((next: SaveData) => {
    saveRef.current = next
    setSave(next)
  }, [])

  const flash = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current != null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => {
      setToast(null)
      toastTimer.current = null
    }, 2200)
  }, [])

  // Toast newly unlocked achievements (ids already present at load are not announced).
  const achievementIds = save?.metaState.achievementIds
  useEffect(() => {
    if (!achievementIds || !knownAchievements.current) return
    const fresh = achievementIds.filter((id) => !knownAchievements.current!.has(id))
    if (!fresh.length) return
    for (const id of fresh) knownAchievements.current.add(id)
    const names = fresh
      .map((id) => clickerGameConfig.achievements.find((a) => a.id === id)?.name ?? id)
      .join(" · ")
    flash(`업적 달성 · ${names} (생산 +${fresh.length}%)`)
  }, [achievementIds, flash])

  const dismissToast = useCallback(() => {
    if (toastTimer.current != null) {
      window.clearTimeout(toastTimer.current)
      toastTimer.current = null
    }
    setToast(null)
  }, [])

  const clickCore = useCallback((clientX?: number, clientY?: number) => {
    const current = saveRef.current
    if (!current || current.metaState.gameCompleted) return { critical: false }
    const result = clickerClick(current, now())
    commit(result.save)
    const id = ++floatId.current
    setFloats((prev) => [
      ...prev.slice(-12),
      {
        id,
        text: `+${result.energy.toFixed(result.energy >= 100 ? 0 : 1)}`,
        critical: result.critical,
        strike: result.quake ? "quake" : result.lightning ? "lightning" : result.echo ? "echo" : undefined,
        x: clientX ?? 0,
        y: clientY ?? 0,
      },
    ])
    window.setTimeout(() => {
      setFloats((prev) => prev.filter((f) => f.id !== id))
    }, 700)
    return { critical: result.critical }
  }, [commit])

  const buyPotion = useCallback((id: string) => {
    if (!saveRef.current) return
    const result = clickerBuyPotion(saveRef.current, id)
    if (!result.ok) return flash(result.error)
    commit(result.value)
    const name = clickerGameConfig.potions.find((p) => p.id === id)?.name ?? id
    flash(`구매 · ${name}`)
  }, [commit, flash])

  const buyActiveSkill = useCallback((id: string) => {
    if (!saveRef.current) return
    const result = clickerBuyActiveSkill(saveRef.current, id)
    if (!result.ok) return flash(result.error)
    commit(result.value)
    const name = clickerGameConfig.activeSkills.find((s) => s.id === id)?.name ?? id
    flash(`구매 · ${name}`)
  }, [commit, flash])

  const buyProducer = useCallback((id: string, count: number | "MAX") => {
    if (!saveRef.current) return
    const result = clickerBuyProducer(saveRef.current, id, count)
    if (!result.ok) return flash(result.error)
    commit(result.value)
  }, [commit, flash])

  const buyUpgrade = useCallback((id: string) => {
    if (!saveRef.current) return
    const result = clickerBuyUpgrade(saveRef.current, id)
    if (!result.ok) return flash(result.error)
    commit(result.value)
    const name = clickerGameConfig.upgrades.find((u) => u.id === id)?.name ?? id
    flash(`강화 · ${name}`)
  }, [commit, flash])

  const buySkill = useCallback((id: string) => {
    if (!saveRef.current) return
    const result = clickerBuySkill(saveRef.current, id)
    if (!result.ok) return flash(result.error)
    commit(result.value)
    const name = clickerGameConfig.skillNodes.find((s) => s.id === id)?.name ?? id
    flash(`회로 해금 · ${name}`)
  }, [commit, flash])

  const drinkPotion = useCallback((id: string) => {
    if (!saveRef.current) return
    const result = clickerDrinkPotion(saveRef.current, id)
    if (!result.ok) return flash(result.error)
    commit(result.value)
    const name = clickerGameConfig.potions.find((p) => p.id === id)?.name ?? id
    flash(`${name} 사용`)
  }, [commit, flash])

  const startFever = useCallback(() => {
    if (!saveRef.current) return
    const result = clickerStartGaugeFever(saveRef.current)
    if (!result.ok) return flash(result.error)
    commit(result.value)
    flash("FEVER 시작")
  }, [commit, flash])

  const useSkill = useCallback((id: string) => {
    if (!saveRef.current) return
    const result = clickerUseSkill(saveRef.current, id, now())
    if (!result.ok) return flash(result.error)
    commit(result.value)
    const name = clickerGameConfig.activeSkills.find((s) => s.id === id)?.name ?? id
    flash(`${name} 발동`)
  }, [commit, flash])

  const resolveCrisis = useCallback((choice: CrisisChoice) => {
    if (!saveRef.current) return
    commit(clickerResolveCrisis(saveRef.current, choice, now()))
    const label =
      choice === "STABILIZE" ? "안정화" : choice === "RISK_IT" ? "위험 감수" : "비상 오버클럭"
    flash(`위기 해소 · ${label}`)
  }, [commit, flash])

  const travelRegion = useCallback((regionId: string) => {
    if (!saveRef.current) return
    const region = clickerGameConfig.regions.find((r) => r.id === regionId)
    const label = region?.name ?? regionId
    const result = clickerTravelRegion(saveRef.current, regionId)
    if (!result.ok) return flash(result.error)
    commit(result.value.save)
    persistNow(result.value.save)
    if (result.value.intro) setRegionIntro({ regionId, name: label, description: region?.description ?? "", ...result.value.intro })
    else flash(`${label}(으)로 이동`)
  }, [commit, flash, persistNow])

  const dismissRegionIntro = useCallback(() => setRegionIntro(null), [])

  const regionActivity = useCallback((regionId: string) => {
    if (!saveRef.current) return
    const region = clickerGameConfig.regions.find((r) => r.id === regionId)
    const result = clickerRegionActivity(saveRef.current, regionId, now())
    if (!result.ok) return flash(result.error)
    commit(result.value)
    flash(`${region?.activity?.name ?? "지역 활동"} 발동`)
  }, [commit, flash])

  const returnHome = useCallback(() => {
    if (!saveRef.current) return
    const result = clickerReturnHome(saveRef.current)
    if (!result.ok) return flash(result.error)
    commit(result.value)
    flash("Core Mine으로 돌아왔습니다")
  }, [commit, flash])

  const rebirth = useCallback((buffId: string) => {
    if (!saveRef.current) return
    const result = clickerRebirth(saveRef.current, buffId, now())
    if (!result.ok) return flash(result.error)
    commit(result.value)
    flash("WORLD LINE이 열렸습니다.")
  }, [commit, flash])

  const completeEnding = useCallback(() => {
    if (!saveRef.current) return false
    const result = clickerCompleteEnding(saveRef.current, now())
    if (!result.ok) {
      flash(result.error)
      return false
    }
    commit(result.value)
    persistNow(result.value)
    return true
  }, [commit, flash, persistNow])

  const adminGrant = useCallback((amount: number) => {
    if (!isClickerAdminAllowed() || !saveRef.current) return
    commit(clickerAdminGrant(saveRef.current, amount))
  }, [commit])

  const adminFillFever = useCallback(() => {
    if (!isClickerAdminAllowed() || !saveRef.current) return
    commit(
      clickerAdminPatch(saveRef.current, {
        fever: { ...saveRef.current.runState.fever, gauge: clickerGameConfig.feverGaugeMax, phase: "IDLE" },
      })
    )
  }, [commit])

  const adminCrisis = useCallback(() => {
    if (!isClickerAdminAllowed() || !saveRef.current) return
    commit(clickerAdminPatch(saveRef.current, { instability: 100, crisisActive: true }))
  }, [commit])

  const adminPotions = useCallback(() => {
    if (!isClickerAdminAllowed() || !saveRef.current) return
    const potions = Object.fromEntries(clickerGameConfig.potions.map((p) => [p.id, 5]))
    commit(clickerAdminPatch(saveRef.current, { potions }))
  }, [commit])

  const adminUnlock = useCallback(() => {
    if (!isClickerAdminAllowed() || !saveRef.current) return
    const run = saveRef.current.runState
    const solar = Math.max(run.producerLevels.solar_node ?? 0, 80)
    const producerLevels = { ...run.producerLevels, solar_node: solar }
    const totalLevels = Object.values(producerLevels).reduce((sum, n) => sum + n, 0)
    const earned = Math.floor(totalLevels / clickerGameConfig.skillPointEveryLevels)
    commit(
      clickerAdminPatch(saveRef.current, {
        lifetimeCoreEnergy: Math.max(run.lifetimeCoreEnergy, 5_000_000),
        producerLevels,
        skillPoints: Math.max(0, earned - run.skillPointsSpent),
      })
    )
  }, [commit])

  const adminReset = useCallback(() => {
    clearClickerRaw()
    const fresh = createInitialSave(now(), clickerGameConfig)
    commit(fresh)
    persistNow(fresh)
  }, [commit, persistNow])

  /** Persist a settings change right away (settings survive reloads, not just ticks). */
  const updateSettings = useCallback((patch: Partial<ClickerSettings>) => {
    if (!saveRef.current) return
    const next = { ...saveRef.current, settings: { ...saveRef.current.settings, ...patch } }
    commit(next)
    persistNow(next)
  }, [commit, persistNow])

  const toggleMute = useCallback(() => {
    const muted = !saveRef.current?.settings.muted
    updateSettings({ muted })
    flash(muted ? "효과음 끔" : "효과음 켬")
  }, [updateSettings, flash])

  const toggleMusic = useCallback(() => {
    updateSettings({ musicMuted: !saveRef.current?.settings.musicMuted })
  }, [updateSettings])

  const setMusicVolume = useCallback(
    (musicVolume: number) => updateSettings({ musicVolume: Math.min(1, Math.max(0, musicVolume)) }),
    [updateSettings],
  )

  /** Title CTA: always land on upgrades/skills hub. Mine opens only via hub CTA. */
  const startFromTitle = useCallback(() => {
    if (!saveRef.current) return
    const started = clickerStartGame(saveRef.current)
    const hubbed = {
      ...started,
      settings: { ...started.settings, playSurface: "hub" as const },
    }
    commit(hubbed)
    persistNow(hubbed)
  }, [commit, persistNow])

  const enterMine = useCallback(() => {
    if (!saveRef.current) return
    const t = now()
    const result = clickerEnterMine(saveRef.current, t)
    const next = result.save
    if (!result.error && next.settings.playSurface === "mine") {
      mineStartRef.current = clickerMineSessionStart(next, t)
      setMineSummary(null)
    }
    commit(next)
    persistNow(next)
    if (result.error) flash(result.error)
  }, [commit, persistNow, flash])

  /** Golden vein hit in the mine; returns a short label for the in-scene burst. */
  const claimVein = useCallback(
    (clientX: number, clientY: number) => {
      if (!saveRef.current) return null
      const { save: next, outcome } = clickerClaimVein(saveRef.current, now())
      commit(next)
      const label =
        outcome.kind === "surge"
          ? `과부하 · 생산 ×${outcome.multiplier} ${outcome.seconds}초`
          : outcome.kind === "laser_rush"
            ? `레이저 폭주 · 채굴 ×${outcome.multiplier} ${outcome.seconds}초`
            : `대박 · +${formatNumber(outcome.energy)} CORE`
      flash(`황금 광맥! ${label}`)
      const id = ++floatId.current
      setFloats((prev) => [...prev.slice(-12), { id, text: label, critical: true, x: clientX, y: clientY }])
      window.setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 1200)
      return label
    },
    [commit, flash],
  )

  const oreBroken = useCallback(() => {
    if (!saveRef.current) return
    commit(clickerOreBroken(saveRef.current))
  }, [commit])

  const drillOverdrive = useCallback(() => {
    if (!saveRef.current) return
    const result = clickerDrillOverdrive(saveRef.current, now())
    if (!result.ok) return flash(result.error)
    commit(result.value)
    flash("드릴 과부하 · 30초간 자동 채굴 ×3")
  }, [commit, flash])

  /** Checked before the entry cinematic so a refused entry fails fast instead of after 10s. */
  const mineEntryError = useCallback(() => {
    if (!saveRef.current) return undefined
    return clickerMineEntryError(saveRef.current, now())
  }, [])

  const exitMine = useCallback(() => {
    if (!saveRef.current) return
    const before = saveRef.current
    const exited = clickerExitMine(before, now())
    const next = before.settings.playSurface === "mine" ? finishMine(before, exited) : exited
    commit(next)
    persistNow(next)
  }, [commit, persistNow, finishMine])

  const dismissMineSummary = useCallback(() => setMineSummary(null), [])

  const forceSave = useCallback(() => {
    if (!saveRef.current) return
    persistNow()
    flash("진행 상황 저장됨")
  }, [persistNow, flash])

  const t = Date.now()
  const drill = save
    ? {
        rate: autoDrillRate(save.runState, clickerGameConfig, t),
        owned: baseDrillRate(save.runState, clickerGameConfig) > 0,
        overdriveLeftMs: Math.max(0, save.runState.drillOverdriveUntil - t),
        readyInMs: Math.max(0, save.runState.drillOverdriveReadyAt - t),
      }
    : null
  const achievements = save
    ? clickerGameConfig.achievements.map((def) => {
        const progress = achievementProgress(def.kind, save.runState, save.metaState)
        return {
          ...def,
          progress,
          ratio: Math.min(1, progress / def.target),
          unlocked: save.metaState.achievementIds.includes(def.id),
        }
      })
    : []
  const snapshot = save ? productionSnapshot(save.runState, save.metaState, clickerGameConfig, t) : null
  const hud = save ? buildHud(save.runState, save.metaState, clickerGameConfig, t, snapshot ?? undefined) : null
  const producers = save ? buildProducerViews(save.runState, save.metaState, clickerGameConfig, t) : []
  const upgrades = save ? buildUpgradeViews(save.runState, clickerGameConfig) : []
  const potionShop = save ? buildPotionShopViews(save.runState, clickerGameConfig) : []
  const activeSkillShop = save ? buildActiveSkillShopViews(save.runState, clickerGameConfig) : []
  const regions = save ? buildRegionViews(save.runState, clickerGameConfig, t) : []
  const currentRegion =
    regions.find((r) => r.isCurrent) ?? regions.find((r) => r.isHome) ?? regions[0] ?? null
  const skillNodes = save ? buildSkillNodeViews(save.runState, clickerGameConfig) : []
  /** Enter Mine button state: re-entry cooldown left and the CORE cost of the next entry. */
  const mineGate = save
    ? {
        cooldownLeftMs: Math.max(0, save.runState.mineCooldownUntil - t),
        cost: clickerMineEntryCost(save, t),
      }
    : null
  const canCompleteEnding = save ? clickerCanCompleteEnding(save) : false
  const isCompleted = Boolean(save?.metaState.gameCompleted)

  return {
    save,
    hud,
    isCompleted,
    canCompleteEnding,
    snapshot,
    producers,
    upgrades,
    potionShop,
    activeSkillShop,
    regions,
    currentRegion,
    skillNodes,
    config: clickerGameConfig,
    floats,
    toast,
    savePulse,
    forceSave,
    dismissToast,
    clickCore,
    buyPotion,
    buyActiveSkill,
    buyProducer,
    buyUpgrade,
    buySkill,
    drinkPotion,
    startFever,
    useSkill,
    resolveCrisis,
    travelRegion,
    regionActivity,
    returnHome,
    rebirth,
    completeEnding,
    adminReset,
    adminGrant,
    adminFillFever,
    adminCrisis,
    adminPotions,
    adminUnlock,
    toggleMute,
    toggleMusic,
    setMusicVolume,
    startFromTitle,
    enterMine,
    mineEntryError,
    claimVein,
    oreBroken,
    achievements,
    drill,
    drillOverdrive,
    exitMine,
    mineSummary,
    dismissMineSummary,
    regionIntro,
    dismissRegionIntro,
    mineGate,
  }
}
