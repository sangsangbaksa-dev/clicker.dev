"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  clickerAdminGrant,
  clickerAdminGrantCurrencies,
  clickerRedeemSecretCode,
  clickerAdminJumpToFinalBoss,
  clickerAdminReplayTutorial,
  clickerApplyAdminModes,
  clickerAdminPatch,
  clickerAdminUnlockRegion,
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
  clickerExitMine,
  clickerExportCode,
  clickerImportSave,
  clickerParseSaveCode,
  clickerSaveJson,
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
  clickerClaimChallenge,
  clickerRegionChallengeError,
  clickerTick,
  clickerUseSkill,
  clickerFinishTutorial,
  clickerSlayMonster,
  clickerDrill,
  clickerStartBoss,
  clickerStrikeBoss,
  clickerEnterLair,
  clickerLeaveLair,
  clickerStrikeLair,
  clickerForge,
  clickerBuyRelic,
  clickerBuyWorldTreeNode,
  allowMineStrike,
  clearClickerStoredSave,
  clickerFreshSaveJson,
  clickerPauseMine,
  clickerResumeMine,
  clickerSelectScreenTab,
  loadClickerGame,
  persistClickerGame,
  resetClickerPersistence,
  createInitialSave,
} from "@/application/clicker"
import {
  clickerCanWriteSave,
  clickerClaimLease,
  clickerCreateTabId,
  clickerIsLeaseTakenByOther,
} from "@/application/clicker-tab-session"
import {
  achievementProgress,
  autoDrillRate,
  baseDrillRate,
  buildActiveSkillShopViews,
  buildHud,
  buildPotionShopViews,
  buildProducerViews,
  buildRegionViews,
  buildSkillNodeViews,
  buildUpgradeViews,
  formatNumber,
  SECRET_CODE_AMOUNT,
  GEAR,
  gearOf,
  isClickerAdminAllowed,
  productionSnapshot,
  type ClickerSettings,
  type CrisisChoice,
  type GearSlot,
  type MineSessionStart,
  type MineSessionSummary,
  type ClickerScreenTabId,
  type ManageDrawerTabId,
  type RegionIntroDef,
  type SaveData,
  ADMIN_DEFAULT_MODES,
  nextAdminSpeed,
  type AdminModes,
} from "@/application/clicker-ui"
import { playSfx, setSfxMuted } from "@/lib/clicker-sfx"
import { clearFloats, pushFloat } from "@/lib/clicker-floats"

export type { FloatNumber } from "@/lib/clicker-floats"

function now() {
  return Date.now()
}

export type RegionIntro = RegionIntroDef & { regionId: string; name: string; description: string }

export function useClicker() {
  const [save, setSave] = useState<SaveData | null>(null)
  const [savePulse, setSavePulse] = useState<"idle" | "saving" | "saved">("idle")
  const savePulseTimer = useRef<number | null>(null)
  // Only one tab may write the shared save; the others freeze until the player resumes there.
  const tabIdRef = useRef("")
  const blockedRef = useRef(false)
  const [otherTabActive, setOtherTabActive] = useState(false)

  const markBlocked = useCallback(() => {
    blockedRef.current = true
    setOtherTabActive(true)
  }, [])
  const [toast, setToast] = useState<string | null>(null)
  /** Last purchase, drawn as a style-per-kind burst (skill branch or upgrade category). */
  const [purchaseFx, setPurchaseFx] = useState<{ key: number; kind: string; assetId?: string } | null>(null)
  const fxKey = useRef(0)
  const toastTimer = useRef<number | null>(null)
  const saveRef = useRef<SaveData | null>(null)
  const [adminModes, setAdminModes] = useState<AdminModes>(ADMIN_DEFAULT_MODES)
  const adminModesRef = useRef<AdminModes>(ADMIN_DEFAULT_MODES)
  const knownAchievements = useRef<Set<string> | null>(null)
  const mineStartRef = useRef<MineSessionStart | null>(null)
  const [mineSummary, setMineSummary] = useState<MineSessionSummary | null>(null)

  const persistNow = useCallback((next?: SaveData, silent = false) => {
    const target = next ?? saveRef.current
    if (!target || blockedRef.current) return
    if (!clickerCanWriteSave(tabIdRef.current, now())) {
      markBlocked()
      return
    }
    persistClickerGame(target)
    // Background autosaves skip the save pulse: three extra full repaints every 2.5s caused hitches.
    if (silent) return
    setSavePulse("saving")
    if (savePulseTimer.current != null) window.clearTimeout(savePulseTimer.current)
    // Defer "saved" so the saving state can paint once.
    window.setTimeout(() => setSavePulse("saved"), 40)
    savePulseTimer.current = window.setTimeout(() => setSavePulse("idle"), 2200)
  }, [markBlocked])

  useEffect(() => {
    return () => {
      if (savePulseTimer.current != null) window.clearTimeout(savePulseTimer.current)
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current)
      clearFloats()
    }
  }, [])
  /** First-visit cinematic for the region just entered; null when none is playing. */
  const [regionIntro, setRegionIntro] = useState<RegionIntro | null>(null)

  /** Claim the save for this tab, then load whatever the last writer stored. */
  const loadAsOwner = useCallback(() => {
    const t = now()
    if (!tabIdRef.current) tabIdRef.current = clickerCreateTabId()
    clickerClaimLease(tabIdRef.current, t)
    blockedRef.current = false
    setOtherTabActive(false)
    const loaded = loadClickerGame(t)
    const resumed = clickerTick(loaded, t)
    setSave(resumed)
    saveRef.current = resumed
    knownAchievements.current = new Set(resumed.metaState.achievementIds)
    mineStartRef.current = null
  }, [])

  useEffect(() => {
    loadAsOwner()
  }, [loadAsOwner])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (clickerIsLeaseTakenByOther(event.key, event.newValue, tabIdRef.current)) markBlocked()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [markBlocked])

  /** Continue in this tab: take the save back and reload the other tab's progress. */
  const resumeHere = useCallback(() => {
    loadAsOwner()
    setMineSummary(null)
  }, [loadAsOwner])

  useEffect(() => {
    saveRef.current = save
  }, [save])

  const sfxMuted = save?.settings.muted ?? false
  useEffect(() => {
    setSfxMuted(sfxMuted)
  }, [sfxMuted])

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
    let lastRender = 0
    const loop = (ts: number) => {
      if (ts - last > 100) {
        last = ts
        const current = saveRef.current
        if (current && !current.metaState.gameCompleted && !blockedRef.current) {
          const ticked = clickerTick(current, now())
          const modes = adminModesRef.current
          const next = modes.god || modes.speed > 1 ? clickerApplyAdminModes(current, ticked, modes) : ticked
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
          // Engine ticks every 100ms; React only repaints every 250ms (or at once when the surface flips).
          if (committed !== next || ts - lastRender >= 250 || committed.runState.boss !== current.runState.boss) {
            lastRender = ts
            setSave(committed)
          }
        }
      }
      frame = window.requestAnimationFrame(loop)
    }
    frame = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(frame)
  }, [finishMine])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (saveRef.current) persistNow(undefined, true)
    }, 2500)
    const onHide = () => {
      if (saveRef.current) persistNow(undefined, true)
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
    if (blockedRef.current) return
    saveRef.current = next
    setSave(next)
  }, [])

  /** Commit and write through at once (travel, settings, milestones). */
  const commitAndSave = useCallback((next: SaveData) => {
    commit(next)
    persistNow(next)
  }, [commit, persistNow])

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
    playSfx("achievement")
    flash(`업적 달성 · ${names} (생산 +${fresh.length}%)`)
  }, [achievementIds, flash])

  /** Refused action: toast the reason with the deny buzz. */
  const refuse = useCallback(
    (message: string) => {
      playSfx("deny")
      flash(message)
    },
    [flash],
  )

  const dismissToast = useCallback(() => {
    if (toastTimer.current != null) {
      window.clearTimeout(toastTimer.current)
      toastTimer.current = null
    }
    setToast(null)
  }, [])

  const mineStrikes = useRef<number[]>([])
  const clickCore = useCallback((clientX?: number, clientY?: number, auto = false) => {
    const current = saveRef.current
    if (!current || current.metaState.gameCompleted) return null
    // Taps (mine and region drilling) share the strikes-per-second cap. The assist drill has its own
    // fixed rate and stays out of it: it used to eat the budget, so taps on phones (where the last
    // touch keeps the drill aimed at the ore) failed on and off.
    if (!auto && !allowMineStrike(mineStrikes.current, performance.now())) return null
    const result = clickerClick(current, now())
    commit(result.save)
    if (result.quake) playSfx("quake")
    else if (result.lightning) playSfx("lightning")
    else if (result.echo) playSfx("echoStrike")
    pushFloat(
      {
        text: `+${formatNumber(result.energy)}`,
        critical: result.critical,
        strike: result.quake ? "quake" : result.lightning ? "lightning" : result.echo ? "echo" : undefined,
        x: clientX ?? 0,
        y: clientY ?? 0,
      },
      700,
    )
    return { critical: result.critical, lightning: result.lightning, quake: result.quake, echo: result.echo }
  }, [commit])

  const buyPotion = useCallback((id: string) => {
    if (!saveRef.current) return
    const result = clickerBuyPotion(saveRef.current, id)
    if (!result.ok) return refuse(result.error)
    commit(result.value)
    playSfx("purchase")
    const name = clickerGameConfig.potions.find((p) => p.id === id)?.name ?? id
    flash(`구매 · ${name}`)
  }, [commit, flash, refuse])

  const buyActiveSkill = useCallback((id: string) => {
    if (!saveRef.current) return
    const result = clickerBuyActiveSkill(saveRef.current, id)
    if (!result.ok) return refuse(result.error)
    commit(result.value)
    playSfx("purchase")
    const name = clickerGameConfig.activeSkills.find((s) => s.id === id)?.name ?? id
    flash(`구매 · ${name}`)
  }, [commit, flash, refuse])

  const buyProducer = useCallback((id: string, count: number | "MAX") => {
    if (!saveRef.current) return
    const result = clickerBuyProducer(saveRef.current, id, count)
    if (!result.ok) return refuse(result.error)
    commit(result.value)
    playSfx("purchase")
  }, [commit, refuse])

  const buyUpgrade = useCallback((id: string) => {
    if (!saveRef.current) return
    const result = clickerBuyUpgrade(saveRef.current, id)
    if (!result.ok) return refuse(result.error)
    commit(result.value)
    playSfx("upgrade")
    const def = clickerGameConfig.upgrades.find((u) => u.id === id)
    setPurchaseFx({ key: ++fxKey.current, kind: def?.category ?? "UTILITY", assetId: def?.assetId })
    const name = def?.name ?? id
    flash(`강화 · ${name}`)
  }, [commit, flash, refuse])

  const buySkill = useCallback((id: string) => {
    if (!saveRef.current) return
    const result = clickerBuySkill(saveRef.current, id)
    if (!result.ok) return refuse(result.error)
    commit(result.value)
    playSfx("skillUnlock")
    const def = clickerGameConfig.skillNodes.find((s) => s.id === id)
    setPurchaseFx({ key: ++fxKey.current, kind: def?.branch ?? "FOCUS", assetId: def?.assetId })
    const name = def?.name ?? id
    flash(`회로 해금 · ${name}`)
  }, [commit, flash, refuse])

  const drinkPotion = useCallback((id: string) => {
    if (!saveRef.current) return
    const result = clickerDrinkPotion(saveRef.current, id)
    if (!result.ok) return refuse(result.error)
    commit(result.value)
    playSfx("potion")
    const name = clickerGameConfig.potions.find((p) => p.id === id)?.name ?? id
    flash(`${name} 사용`)
  }, [commit, flash, refuse])

  const startFever = useCallback(() => {
    if (!saveRef.current) return
    const result = clickerStartGaugeFever(saveRef.current)
    if (!result.ok) return refuse(result.error)
    commit(result.value)
    flash("FEVER 시작")
  }, [commit, flash, refuse])

  const useSkill = useCallback((id: string) => {
    if (!saveRef.current) return
    const result = clickerUseSkill(saveRef.current, id, now())
    if (!result.ok) return refuse(result.error)
    commit(result.value)
    const skill = clickerGameConfig.activeSkills.find((s) => s.id === id)
    // Each kind of skill has its own cast: instant energy, mining laser, or a production surge.
    playSfx(
      skill?.lightningStorm
        ? "lightning"
        : skill?.feverIgnite
          ? "fever"
          : skill?.cooldownReset
            ? "crisisResolve"
            : skill?.energyBurstSeconds
              ? "skillBurst"
              : (skill?.clickMultiplier || skill?.criticalChanceAdd) && !skill.productionMultiplier
                ? "skillLaser"
                : "skillPower",
    )
    flash(`${skill?.name ?? id} 발동`)
  }, [commit, flash, refuse])

  const resolveCrisis = useCallback((choice: CrisisChoice) => {
    if (!saveRef.current) return
    commit(clickerResolveCrisis(saveRef.current, choice, now()))
    const label =
      choice === "STABILIZE" ? "안정화" : choice === "RISK_IT" ? "위험 감수" : "비상 오버클럭"
    playSfx("crisisResolve")
    flash(`위기 해소 · ${label}`)
  }, [commit, flash])

  const travelRegion = useCallback((regionId: string) => {
    if (!saveRef.current) return
    const region = clickerGameConfig.regions.find((r) => r.id === regionId)
    const label = region?.name ?? regionId
    const result = clickerTravelRegion(saveRef.current, regionId)
    if (!result.ok) return refuse(result.error)
    commitAndSave(result.value.save)
    playSfx("travel")
    // Every arrival plays the region's cinematic, not just the first.
    if (result.value.intro) setRegionIntro({ regionId, name: label, description: region?.description ?? "", ...result.value.intro })
    else flash(`${label}(으)로 이동`)
  }, [flash, refuse, commitAndSave])

  const dismissRegionIntro = useCallback(() => setRegionIntro(null), [])

  /** Checked before the mini-game opens so a refused start fails fast. Returns true when it may start. */
  const canStartChallenge = useCallback((regionId: string) => {
    if (!saveRef.current) return false
    const error = clickerRegionChallengeError(saveRef.current, regionId, now())
    if (error) refuse(error)
    return !error
  }, [refuse])

  const claimChallenge = useCallback((regionId: string, score: number) => {
    if (!saveRef.current) return
    const result = clickerClaimChallenge(saveRef.current, regionId, score, now())
    if (!result.ok) return refuse(result.error)
    commitAndSave(result.value.save)
    playSfx("achievement")
    flash(`도전 완료 · 성공률 ${Math.round(score * 100)}% · +${formatNumber(result.value.reward)} CORE`)
  }, [flash, refuse, commitAndSave])

  const regionActivity = useCallback((regionId: string) => {
    if (!saveRef.current) return
    const region = clickerGameConfig.regions.find((r) => r.id === regionId)
    const result = clickerRegionActivity(saveRef.current, regionId, now())
    if (!result.ok) return refuse(result.error)
    commit(result.value)
    playSfx("skillUse")
    flash(`${region?.activity?.name ?? "지역 활동"} 발동`)
  }, [commit, flash, refuse])

  const returnHome = useCallback(() => {
    if (!saveRef.current) return
    const result = clickerReturnHome(saveRef.current)
    if (!result.ok) return refuse(result.error)
    commit(result.value)
    playSfx("travel")
    const home = clickerGameConfig.regions.find((r) => r.isHome)
    if (home?.intro) setRegionIntro({ regionId: home.id, name: home.name, description: home.description ?? "", ...home.intro })
    else flash("Core Mine으로 돌아왔습니다")
  }, [commit, flash, refuse])

  const rebirth = useCallback((buffId: string) => {
    if (!saveRef.current) return
    const result = clickerRebirth(saveRef.current, buffId, now())
    if (!result.ok) return refuse(result.error)
    commit(result.value)
    flash("WORLD LINE이 열렸습니다.")
  }, [commit, flash, refuse])

  const completeEnding = useCallback(() => {
    if (!saveRef.current) return false
    const result = clickerCompleteEnding(saveRef.current, now())
    if (!result.ok) {
      refuse(result.error)
      return false
    }
    commitAndSave(result.value)
    return true
  }, [refuse, commitAndSave])

  const adminGrant = useCallback((amount: number) => {
    if (!isClickerAdminAllowed() || !saveRef.current) return
    commit(clickerAdminGrant(saveRef.current, amount))
  }, [commit])

  const adminGrantAllCurrencies = useCallback(
    (amount: number) => {
      if (!isClickerAdminAllowed() || !saveRef.current) return
      commit(clickerAdminGrantCurrencies(saveRef.current, amount))
      flash(`관리자 · 모든 지역 재화 +${formatNumber(amount)}`)
    },
    [commit, flash],
  )

  /** The secret code typed anywhere: 100T CORE and of every world currency. */
  const redeemSecretCode = useCallback(() => {
    if (!saveRef.current) return
    const next = clickerRedeemSecretCode(saveRef.current)
    commitAndSave(next)
    playSfx("achievement")
    flash(`비밀 코드 · CORE와 모든 지역 재화 +${formatNumber(SECRET_CODE_AMOUNT)}`)
  }, [flash, commitAndSave])

  const adminJumpFinalBoss = useCallback(() => {
    if (!isClickerAdminAllowed() || !saveRef.current) return
    const next = clickerAdminJumpToFinalBoss(saveRef.current, now())
    commitAndSave(next)
    flash("관리자 · 최종 보스 전투 시작")
  }, [flash, commitAndSave])

  const adminSkipTutorial = useCallback(() => {
    if (!isClickerAdminAllowed() || !saveRef.current) return
    const next = clickerFinishTutorial(saveRef.current)
    commitAndSave(next)
  }, [commitAndSave])

  const adminReplayTutorial = useCallback(() => {
    if (!isClickerAdminAllowed() || !saveRef.current) return
    const next = clickerAdminReplayTutorial(saveRef.current)
    commitAndSave(next)
  }, [commitAndSave])

  const adminToggleGod = useCallback(() => {
    if (!isClickerAdminAllowed()) return
    const next = { ...adminModesRef.current, god: !adminModesRef.current.god }
    adminModesRef.current = next
    setAdminModes(next)
  }, [])

  const adminCycleSpeed = useCallback(() => {
    if (!isClickerAdminAllowed()) return
    const next = { ...adminModesRef.current, speed: nextAdminSpeed(adminModesRef.current.speed) }
    adminModesRef.current = next
    setAdminModes(next)
  }, [])

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

  const adminUnlockRegion = useCallback((regionId: string) => {
    if (!isClickerAdminAllowed() || !saveRef.current) return
    const next = clickerAdminUnlockRegion(saveRef.current, regionId)
    commitAndSave(next)
    const name = clickerGameConfig.regions.find((r) => r.id === regionId)?.name ?? regionId
    flash(`관리자 · ${name} 해금`)
  }, [flash, commitAndSave])

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
    if (blockedRef.current) return
    clearClickerStoredSave()
    resetClickerPersistence()
    const fresh = createInitialSave(now(), clickerGameConfig)
    commitAndSave(fresh)
  }, [commitAndSave])

  /** Persist a settings change right away (settings survive reloads, not just ticks). */
  const updateSettings = useCallback((patch: Partial<ClickerSettings>) => {
    if (!saveRef.current) return
    const next = { ...saveRef.current, settings: { ...saveRef.current.settings, ...patch } }
    commitAndSave(next)
  }, [commitAndSave])

  const toggleMute = useCallback(() => {
    const muted = !saveRef.current?.settings.muted
    updateSettings({ muted })
    setSfxMuted(muted)
    playSfx("toggle")
    flash(muted ? "효과음 끔" : "효과음 켬")
  }, [updateSettings, flash])

  const toggleMusic = useCallback(() => {
    updateSettings({ musicMuted: !saveRef.current?.settings.musicMuted })
    playSfx("toggle")
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
    commitAndSave(hubbed)
    // Ask the browser not to evict the save under storage pressure (a gesture helps it say yes).
    void navigator.storage?.persist?.().catch(() => {})
  }, [commitAndSave])

  const enterMine = useCallback(() => {
    if (!saveRef.current) return
    const t = now()
    const result = clickerEnterMine(saveRef.current, t)
    const next = result.save
    if (!result.error && next.settings.playSurface === "mine") {
      if (!mineStartRef.current) mineStartRef.current = clickerMineSessionStart(next, t)
      setMineSummary(null)
    }
    commitAndSave(next)
    if (result.error) refuse(result.error)
  }, [refuse, commitAndSave])

  const pauseMine = useCallback(() => {
    if (!saveRef.current) return
    const next = clickerPauseMine(saveRef.current, now())
    if (next === saveRef.current) return
    commitAndSave(next)
  }, [commitAndSave])

  const resumeMine = useCallback(() => {
    if (!saveRef.current) return
    const t = now()
    const next = clickerResumeMine(saveRef.current, t)
    if (next === saveRef.current) return
    if (next.settings.playSurface === "mine" && !mineStartRef.current) {
      mineStartRef.current = clickerMineSessionStart(next, t)
    }
    commitAndSave(next)
  }, [commitAndSave])

  const selectScreen = useCallback(
    (from: ClickerScreenTabId, to: ClickerScreenTabId): { openSkillTree: boolean; manageTab: ManageDrawerTabId | null } => {
      if (!saveRef.current) return { openSkillTree: false, manageTab: null }
      const t = now()
      const result = clickerSelectScreenTab(saveRef.current, from, to, t)
      const next = result.save
      if (to === "mine" && next.settings.playSurface === "mine" && !mineStartRef.current) {
        mineStartRef.current = clickerMineSessionStart(next, t)
      }
      commitAndSave(next)
      return { openSkillTree: result.openSkillTree, manageTab: result.manageTab }
    },
    [commitAndSave],
  )

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
      playSfx("vein")
      flash(`황금 광맥! ${label}`)
      pushFloat({ text: label, critical: true, x: clientX, y: clientY }, 1200)
      return label
    },
    [commit, flash],
  )

  const oreBroken = useCallback(() => {
    if (!saveRef.current) return
    commit(clickerOreBroken(saveRef.current))
    playSfx("oreBreak")
  }, [commit])

  const drillOverdrive = useCallback(() => {
    if (!saveRef.current) return
    const result = clickerDrillOverdrive(saveRef.current, now())
    if (!result.ok) return refuse(result.error)
    commit(result.value)
    playSfx("drill")
    flash("드릴 과부하 · 30초간 자동 채굴 ×3")
  }, [commit, flash, refuse])

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
    commitAndSave(next)
  }, [finishMine, commitAndSave])

  const dismissMineSummary = useCallback(() => setMineSummary(null), [])

  const finishTutorial = useCallback(() => {
    if (!saveRef.current) return
    const next = clickerFinishTutorial(saveRef.current)
    commitAndSave(next)
  }, [commitAndSave])

  /** Background monster tapped. Returns the CORE it dropped (0 when refused). */
  const slayMonster = useCallback(
    (regionId: string, clientX: number, clientY: number) => {
      if (!saveRef.current) return 0
      const result = clickerSlayMonster(saveRef.current, regionId, now())
      if (!result.ok) return 0
      commit(result.value.save)
      playSfx("monsterDie")
      pushFloat({ text: `+${formatNumber(result.value.reward)}`, critical: true, x: clientX, y: clientY }, 1000)
      return result.value.reward
    },
    [commit],
  )

  /** Walk into the current region boss's lair. */
  const enterLair = useCallback(() => {
    if (!saveRef.current) return
    const result = clickerEnterLair(saveRef.current, now())
    if (!result.ok) return refuse(result.error)
    commit(result.value)
    playSfx("bossRoar")
  }, [commit, refuse])

  const leaveLair = useCallback(() => {
    if (!saveRef.current) return
    commit(clickerLeaveLair(saveRef.current))
    playSfx("back")
  }, [commit])

  /** Strike in the lair. Returns the CORE dropped on the killing blow, or null when the boss still stands. */
  const strikeLair = useCallback(
    (clientX: number, clientY: number): number | null => {
      if (!saveRef.current) return null
      const result = clickerStrikeLair(saveRef.current, now())
      if (result.damage <= 0) return null
      commit(result.save)
      const text = result.defeated ? `+${formatNumber(result.reward)}` : `-${result.damage}`
      pushFloat({ text, critical: result.defeated, x: clientX, y: clientY }, result.defeated ? 1100 : 600)
      if (result.defeated) {
        playSfx("monsterDie")
        persistNow(result.save)
      }
      return result.defeated ? result.reward : null
    },
    [commit, persistNow],
  )

  const forge = useCallback(
    (slot: GearSlot) => {
      if (!saveRef.current) return
      const result = clickerForge(saveRef.current, slot)
      if (!result.ok) return refuse(result.error)
      commitAndSave(result.value)
      playSfx("upgrade")
      const tier = GEAR[slot][gearOf(result.value.runState)[slot]]
      flash(`제작 완료 · ${tier.name}`)
    },
    [refuse, flash, commitAndSave],
  )

  const buyRelic = useCallback(
    (relicId: string) => {
      if (!saveRef.current) return
      const result = clickerBuyRelic(saveRef.current, relicId)
      if (!result.ok) return refuse(result.error)
      commitAndSave(result.value)
      playSfx("upgrade")
      const relic = clickerGameConfig.relics.find((r) => r.id === relicId)
      flash(`유물 강화 · ${relic?.name ?? relicId} Lv.${result.value.metaState.relicLevels[relicId] ?? 0}`)
    },
    [refuse, flash, commitAndSave],
  )

  const buyWorldTreeNode = useCallback(
    (nodeId: string) => {
      if (!saveRef.current) return
      const result = clickerBuyWorldTreeNode(saveRef.current, nodeId)
      if (!result.ok) return refuse(result.error)
      commitAndSave(result.value)
      playSfx("worldSkill")
      const node = (clickerGameConfig.worldTrees ?? []).find((n) => n.id === nodeId)
      flash(`월드 스킬 습득 · ${node?.name ?? nodeId}`)
    },
    [refuse, flash, commitAndSave],
  )

  /** One tap on the region drill rig. Returns the payout when this tap bored the vein, else 0 (null when refused). */
  const drillVein = useCallback(
    (clientX: number, clientY: number) => {
      const current = saveRef.current
      if (!current) return null
      if (!allowMineStrike(mineStrikes.current, performance.now())) return null
      const result = clickerDrill(current, now())
      if (!result.ok) return null
      commit(result.value.save)
      if (result.value.reward > 0) {
        playSfx("vein")
        pushFloat({ text: `+${formatNumber(result.value.reward)}`, critical: true, x: clientX, y: clientY }, 1200)
      }
      return result.value.reward
    },
    [commit],
  )

  const startBoss = useCallback(() => {
    if (!saveRef.current) return
    const result = clickerStartBoss(saveRef.current, now())
    if (!result.ok) return refuse(result.error)
    commit(result.value)
    playSfx("bossRoar")
  }, [commit, refuse])

  /** Strike the guardian. Returns true on the killing blow. */
  const strikeBoss = useCallback(
    (clientX: number, clientY: number) => {
      if (!saveRef.current) return false
      const result = clickerStrikeBoss(saveRef.current, now())
      if (result.damage <= 0) return false
      playSfx("bossHit")
      commit(result.save)
      pushFloat({ text: `-${formatNumber(result.damage)}`, critical: result.critical, x: clientX, y: clientY }, 700)
      if (result.defeated) persistNow(result.save)
      return result.defeated
    },
    [commit, persistNow],
  )

  const forceSave = useCallback(() => {
    if (!saveRef.current) return
    persistNow()
    playSfx("save")
    flash("진행 상황 저장됨")
  }, [persistNow, flash])

  /** Current save as a copy-pasteable code (settings → 저장 데이터). */
  const exportSaveCode = useCallback((): string | null => {
    const current = saveRef.current
    if (!current) return null
    persistNow()
    return clickerExportCode(current)
  }, [persistNow])

  /** Current save as stored JSON (for the cloud save). */
  const exportSaveJson = useCallback((): string | null => {
    const current = saveRef.current
    if (!current) return null
    persistNow()
    return clickerSaveJson(current)
  }, [persistNow])

  const parseSaveCode = useCallback((code: string) => clickerParseSaveCode(code, now()), [])

  /** Replace this device's save with an imported one (the old save is backed up first). */
  const importSaveJson = useCallback(
    (json: string, message = "저장 코드를 불러왔습니다"): boolean => {
      if (!clickerImportSave(json, now())) return false
      loadAsOwner()
      setMineSummary(null)
      setRegionIntro(null)
      playSfx("save")
      flash(message)
      return true
    },
    [loadAsOwner, flash],
  )

  /** A different account logged in on this device: back up the old run and begin a new one. */
  const startFreshRun = useCallback(() => {
    importSaveJson(clickerFreshSaveJson(now()), "새 진행으로 시작합니다")
  }, [importSaveJson])

  // Render from the last tick's clock (updated every ~100ms) so render stays pure.
  const t = save?.runState.lastTickAt ?? 0
  const drill = save
    ? {
        rate: autoDrillRate(save.runState, clickerGameConfig, t),
        owned: baseDrillRate(save.runState, clickerGameConfig) > 0,
        overdriveLeftMs: Math.max(0, save.runState.drillOverdriveUntil - t),
        readyInMs: Math.max(0, save.runState.drillOverdriveReadyAt - t),
      }
    : null
  const achievements = useMemo(
    () =>
      save
        ? clickerGameConfig.achievements.map((def) => {
            const progress = achievementProgress(def.kind, save.runState, save.metaState)
            return {
              ...def,
              progress,
              ratio: Math.min(1, progress / def.target),
              unlocked: save.metaState.achievementIds.includes(def.id),
            }
          })
        : [],
    [save],
  )
  const views = useMemo(() => {
    if (!save) return null
    const snapshot = productionSnapshot(save.runState, save.metaState, clickerGameConfig, t)
    const regions = buildRegionViews(save.runState, clickerGameConfig, t)
    return {
      snapshot,
      hud: buildHud(save.runState, save.metaState, clickerGameConfig, t, snapshot),
      producers: buildProducerViews(save.runState, save.metaState, clickerGameConfig, t),
      upgrades: buildUpgradeViews(save.runState, clickerGameConfig),
      potionShop: buildPotionShopViews(save.runState, clickerGameConfig),
      activeSkillShop: buildActiveSkillShopViews(save.runState, clickerGameConfig),
      regions,
      currentRegion: regions.find((r) => r.isCurrent) ?? regions.find((r) => r.isHome) ?? regions[0] ?? null,
      skillNodes: buildSkillNodeViews(save.runState, clickerGameConfig),
    }
  }, [save, t])
  const snapshot = views?.snapshot ?? null
  const hud = views?.hud ?? null
  const producers = views?.producers ?? []
  const upgrades = views?.upgrades ?? []
  const potionShop = views?.potionShop ?? []
  const activeSkillShop = views?.activeSkillShop ?? []
  const regions = views?.regions ?? []
  const currentRegion = views?.currentRegion ?? null
  const skillNodes = views?.skillNodes ?? []
  /** Enter Mine button state: re-entry cooldown left. */
  const mineGate = save
    ? {
        cooldownLeftMs: Math.max(0, save.runState.mineCooldownUntil - t),
        cost: 0,
      }
    : null
  const canCompleteEnding = save ? clickerCanCompleteEnding(save) : false
  const isCompleted = Boolean(save?.metaState.gameCompleted)

  return {
    save,
    refuse,
    adminUnlockRegion,
    notify: flash,
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
    toast,
    savePulse,
    otherTabActive,
    resumeHere,
    forceSave,
    exportSaveCode,
    exportSaveJson,
    parseSaveCode,
    importSaveJson,
    startFreshRun,
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
    adminGrantAllCurrencies,
    adminJumpFinalBoss,
    adminSkipTutorial,
    adminReplayTutorial,
    adminToggleGod,
    adminCycleSpeed,
    adminModes,
    adminFillFever,
    adminCrisis,
    adminPotions,
    adminUnlock,
    toggleMute,
    toggleMusic,
    setMusicVolume,
    startFromTitle,
    enterMine,
    pauseMine,
    resumeMine,
    selectScreen,
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
    canStartChallenge,
    claimChallenge,
    mineGate,
    finishTutorial,
    slayMonster,
    enterLair,
    leaveLair,
    strikeLair,
    forge,
    buyRelic,
    buyWorldTreeNode,
    redeemSecretCode,
    drillVein,
    purchaseFx,
    startBoss,
    strikeBoss,
  }
}
