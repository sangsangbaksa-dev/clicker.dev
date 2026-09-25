"use client"

import { REBIRTH_AUDIO_CUES } from "@/data/clicker/rebirth-motion"

/** Synthesized SFX (Web Audio) — one shared context, unlocked on the first gesture. */

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null
  ctx ??= new AudioContext()
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

/** Call from a capture-phase gesture listener so later SFX aren't stuck suspended. Also warms the cue cache. */
export function unlockSfx() {
  const c = audio()
  if (!c) return
  for (const name of EVENT_SFX) loadSfx(c, name)
  for (const name of REBIRTH_SFX) loadSfx(c, name)
}

function tone(
  c: AudioContext,
  type: OscillatorType,
  from: number,
  to: number,
  gain: number,
  start: number,
  dur: number,
) {
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, start)
  osc.frequency.exponentialRampToValueAtTime(to, start + dur)
  g.gain.setValueAtTime(gain, start)
  g.gain.exponentialRampToValueAtTime(0.001, start + dur)
  osc.connect(g)
  g.connect(c.destination)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

function noise(c: AudioContext, freq: number, q: number, gain: number, start: number, dur: number) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  const src = c.createBufferSource()
  const filter = c.createBiquadFilter()
  const g = c.createGain()
  src.buffer = buf
  filter.type = "bandpass"
  filter.frequency.value = freq
  filter.Q.value = q
  g.gain.setValueAtTime(gain, start)
  g.gain.exponentialRampToValueAtTime(0.001, start + dur)
  src.connect(filter)
  filter.connect(g)
  g.connect(c.destination)
  src.start(start)
  src.stop(start + dur + 0.02)
}

/** Recorded SFX (media/audio pack → public/clicker/audio/*.mp3), keyed by pack filename. */
const EVENT_SFX = [
  "sfx_ui_purchase",
  "sfx_ui_deny",
  "sfx_producer_buy",
  "sfx_upgrade_level",
  "sfx_skill_unlock",
  "sfx_skill_activate",
  "sfx_potion_fever",
  "sfx_yield_big",
  "sfx_exit_mine",
  "sfx_session_timer_warn",
  "sfx_transcend_open",
  "sfx_achievement",
  "sfx_crisis_alert",
  "sfx_crisis_resolve",
  "sfx_region_travel",
  "sfx_monster_kill",
  "sfx_vault_lock",
] as const
export type SfxName = (typeof EVENT_SFX)[number]

const REBIRTH_SFX = [
  REBIRTH_AUDIO_CUES.confirm,
  REBIRTH_AUDIO_CUES.collapse,
  REBIRTH_AUDIO_CUES.voidTear,
  REBIRTH_AUDIO_CUES.rebuild,
  REBIRTH_AUDIO_CUES.settle,
  ...["directive_pulse", "aurelia_grid", "resonance_protocol", "volatile_core", "adaptive_architect"].map(
    REBIRTH_AUDIO_CUES.stamp,
  ),
]

const SFX_GAIN = 0.7
/** Same cue retriggered faster than this is dropped, so bulk buys don't stack. */
const RETRIGGER_MS = 60

const buffers = new Map<string, AudioBuffer | null>()
const lastPlayed = new Map<string, number>()

function loadSfx(c: AudioContext, name: string): AudioBuffer | undefined {
  const cached = buffers.get(name)
  if (cached !== undefined) return cached ?? undefined
  buffers.set(name, null)
  void fetch(`/clicker/audio/${name}.mp3`)
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(res.statusText))))
    .then((data) => c.decodeAudioData(data))
    .then((buf) => buffers.set(name, buf))
    .catch(() => {
      /* missing/undecodable — callers fall back to the synth voice */
    })
  return undefined
}

/** Plays a recorded cue; returns false when it isn't decoded yet (caller may synth instead). */
function playSample(c: AudioContext, name: string, gain = SFX_GAIN): boolean {
  const buf = loadSfx(c, name)
  if (!buf) return false
  const src = c.createBufferSource()
  const g = c.createGain()
  src.buffer = buf
  g.gain.value = gain
  src.connect(g)
  g.connect(c.destination)
  src.start()
  return true
}

/** Synth stand-ins used until the recorded cue has decoded. */
function synthFallback(c: AudioContext, name: SfxName) {
  const t = c.currentTime
  if (name === "sfx_ui_deny") {
    tone(c, "square", 220, 150, 0.03, t, 0.12)
  } else if (name === "sfx_crisis_alert") {
    tone(c, "sawtooth", 180, 110, 0.05, t, 0.3)
  } else if (name === "sfx_achievement") {
    tone(c, "sine", 784, 784, 0.04, t, 0.4)
    tone(c, "sine", 1318, 1318, 0.035, t + 0.09, 0.45)
  } else {
    tone(c, "triangle", 660, 990, 0.035, t, 0.12)
  }
}

/** Event SFX for hub/shop/mine actions. */
export function playSfx(name: SfxName, muted: boolean) {
  if (muted) return
  const c = audio()
  if (!c) return
  const now = performance.now()
  if (now - (lastPlayed.get(name) ?? -Infinity) < RETRIGGER_MS) return
  lastPlayed.set(name, now)
  if (!playSample(c, name)) synthFallback(c, name)
}

/** Sci-fi laser drill zap for mine strikes. */
export function playLaser(muted: boolean, critical: boolean) {
  if (muted) return
  const c = audio()
  if (!c) return
  const t0 = c.currentTime
  const dur = critical ? 0.14 : 0.09
  tone(c, "sawtooth", critical ? 1480 : 980, critical ? 220 : 160, critical ? 0.055 : 0.035, t0, dur)
  noise(c, critical ? 2400 : 1800, 0.8, critical ? 0.04 : 0.025, t0, dur)
}

/** Stamp pitch per worldline so each rebirth lands with its own color. */
const STAMP_ROOT: Record<string, number> = {
  directive_pulse: 440,
  aurelia_grid: 392,
  resonance_protocol: 523,
  volatile_core: 311,
  adaptive_architect: 466,
}

/** Rebirth beat cues, keyed by the pack filenames in `REBIRTH_AUDIO_CUES`; synth when not decoded. */
export function playRebirthCue(name: string) {
  const c = audio()
  if (!c) return
  if (playSample(c, name, 0.85)) return
  const t = c.currentTime
  if (name === "sfx_rebirth_confirm_click") {
    tone(c, "square", 1200, 900, 0.04, t, 0.06)
  } else if (name === "sfx_rebirth_collapse_whoosh") {
    tone(c, "sine", 520, 70, 0.07, t, 0.5)
    noise(c, 700, 0.6, 0.05, t, 0.5)
  } else if (name === "sfx_rebirth_void_tear") {
    noise(c, 3200, 2, 0.06, t, 0.35)
    tone(c, "sawtooth", 90, 45, 0.05, t, 0.55)
  } else if (name.startsWith("sfx_rebirth_stamp_")) {
    const root = STAMP_ROOT[name.slice("sfx_rebirth_stamp_".length)] ?? 440
    tone(c, "triangle", root, root, 0.08, t, 0.6)
    tone(c, "sine", root * 1.5, root * 1.5, 0.05, t + 0.04, 0.5)
    noise(c, 180, 1, 0.08, t, 0.18)
  } else if (name === "sfx_rebirth_rebuild_rise") {
    tone(c, "sine", 220, 880, 0.05, t, 0.7)
  } else if (name === "sfx_rebirth_settle_chime") {
    tone(c, "sine", 1046, 1046, 0.04, t, 0.8)
    tone(c, "sine", 1318, 1318, 0.03, t + 0.08, 0.7)
  }
}
