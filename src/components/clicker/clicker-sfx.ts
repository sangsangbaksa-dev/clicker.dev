"use client"

/**
 * Synthesized SFX (Web Audio) — one shared context, unlocked on the first gesture.
 * Everything routes through a master bus (gain → compressor) so click spam and
 * stacked cues don't clip on phone speakers. Nothing here loads a file.
 */

let ctx: AudioContext | null = null
let bus: GainNode | null = null
let muted = false
let noiseBuf: AudioBuffer | null = null

const MASTER_GAIN = 0.9
/** Rapid-fire guard per cue so a held key or MAX-buy doesn't machine-gun. */
const MIN_GAP_MS: Partial<Record<SfxName, number>> = {
  tap: 45,
  purchase: 60,
  deny: 140,
  tick: 90,
  achievement: 400,
  save: 400,
  lightning: 220,
  quake: 380,
  echoStrike: 120,
}
const lastPlayed = new Map<string, number>()

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.knee.value = 10
    comp.ratio.value = 6
    comp.attack.value = 0.003
    comp.release.value = 0.18
    bus = ctx.createGain()
    bus.gain.value = MASTER_GAIN
    bus.connect(comp)
    comp.connect(ctx.destination)
  }
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

/** Call from a capture-phase gesture listener so later SFX aren't stuck suspended. */
export function unlockSfx() {
  audio()
}

/** Global SFX mute (settings). Callers no longer need to thread `muted` through. */
export function setSfxMuted(value: boolean) {
  muted = value
}

function out(c: AudioContext): AudioNode {
  return bus ?? c.destination
}

function envGain(c: AudioContext, peak: number, start: number, attack: number, dur: number) {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  return g
}

function tone(
  c: AudioContext,
  type: OscillatorType,
  from: number,
  to: number,
  gain: number,
  start: number,
  dur: number,
  { attack = 0.004, detune = 0, dest }: { attack?: number; detune?: number; dest?: AudioNode } = {},
) {
  const osc = c.createOscillator()
  osc.type = type
  osc.detune.value = detune
  osc.frequency.setValueAtTime(from, start)
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + dur)
  const g = envGain(c, gain, start, attack, dur)
  osc.connect(g)
  g.connect(dest ?? out(c))
  osc.start(start)
  osc.stop(start + dur + 0.03)
}

function whiteNoise(c: AudioContext) {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf
  noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return noiseBuf
}

function noise(
  c: AudioContext,
  type: BiquadFilterType,
  freq: number,
  q: number,
  gain: number,
  start: number,
  dur: number,
  { sweepTo, attack = 0.003 }: { sweepTo?: number; attack?: number } = {},
) {
  const src = c.createBufferSource()
  src.buffer = whiteNoise(c)
  src.loop = true
  const filter = c.createBiquadFilter()
  filter.type = type
  filter.frequency.setValueAtTime(freq, start)
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, start + dur)
  filter.Q.value = q
  const g = envGain(c, gain, start, attack, dur)
  src.connect(filter)
  filter.connect(g)
  g.connect(out(c))
  src.start(start, Math.random() * 0.5)
  src.stop(start + dur + 0.03)
}

/** Short feedback echo — gives chimes a sense of the cavern without a convolver. */
function echo(c: AudioContext, delay = 0.12, feedback = 0.32, wet = 0.35) {
  const input = c.createGain()
  const d = c.createDelay(1)
  const fb = c.createGain()
  const w = c.createGain()
  const lp = c.createBiquadFilter()
  d.delayTime.value = delay
  fb.gain.value = feedback
  w.gain.value = wet
  lp.type = "lowpass"
  lp.frequency.value = 3200
  input.connect(out(c))
  input.connect(d)
  d.connect(lp)
  lp.connect(fb)
  fb.connect(d)
  lp.connect(w)
  w.connect(out(c))
  // Let the tail ring out, then drop the loop so nodes can be collected.
  window.setTimeout(() => {
    fb.gain.value = 0
    input.disconnect()
  }, 2500)
  return input
}

/** Pentatonic-ish step so repeated purchases climb a little instead of droning. */
let purchaseStep = 0
const PURCHASE_STEPS = [0, 2, 4, 7, 9, 12]
const semis = (base: number, n: number) => base * 2 ** (n / 12)

const CUES = {
  /** Generic UI press — tabs, dock, drawer. */
  tap(c: AudioContext, t: number) {
    // Crisp mechanical click with a short pitched body.
    tone(c, "square", 1400, 900, 0.035, t, 0.04, { attack: 0.001 })
    tone(c, "triangle", 880, 700, 0.06, t, 0.08, { attack: 0.002 })
    noise(c, "highpass", 4500, 0.7, 0.03, t, 0.03)
  },
  /** Soft tick — tab / panel switch. */
  tick(c: AudioContext, t: number) {
    tone(c, "sine", 2400, 2200, 0.025, t, 0.03, { attack: 0.001 })
  },
  /** Buy OK: bright coin blip that climbs on streaks. */
  purchase(c: AudioContext, t: number) {
    const step = PURCHASE_STEPS[purchaseStep % PURCHASE_STEPS.length]
    purchaseStep += 1
    const root = semis(880, step)
    tone(c, "square", root, root, 0.03, t, 0.07, { attack: 0.002 })
    tone(c, "triangle", root * 1.5, root * 1.5, 0.045, t + 0.045, 0.16)
    noise(c, "bandpass", 6000, 2, 0.015, t, 0.05)
  },
  /** Permanent upgrade: two-note rise with a sparkle tail. */
  upgrade(c: AudioContext, t: number) {
    const e = echo(c, 0.09, 0.25, 0.25)
    tone(c, "triangle", 659, 659, 0.05, t, 0.12, { dest: e })
    tone(c, "triangle", 988, 988, 0.055, t + 0.07, 0.22, { dest: e })
    tone(c, "sine", 1976, 1976, 0.018, t + 0.1, 0.3, { dest: e })
  },
  /** Can't afford / refused: low double buzz. */
  deny(c: AudioContext, t: number) {
    tone(c, "sawtooth", 180, 150, 0.04, t, 0.08)
    tone(c, "sawtooth", 160, 130, 0.04, t + 0.1, 0.1)
    noise(c, "lowpass", 600, 0.7, 0.02, t, 0.16)
  },
  /** Skill circuit unlocked: electric arc + ascending arpeggio. */
  skillUnlock(c: AudioContext, t: number) {
    const e = echo(c, 0.11, 0.3, 0.3)
    noise(c, "bandpass", 2400, 3, 0.03, t, 0.18, { sweepTo: 7000 })
    ;[523, 659, 784, 1046].forEach((f, i) => tone(c, "triangle", f, f, 0.045, t + i * 0.055, 0.2, { dest: e }))
  },
  /** FEVER on (gauge or potion): whoosh riser into a power chord. */
  fever(c: AudioContext, t: number) {
    noise(c, "bandpass", 400, 1.2, 0.05, t, 0.45, { sweepTo: 5000, attack: 0.2 })
    tone(c, "sawtooth", 110, 220, 0.03, t, 0.45, { attack: 0.25 })
    const hit = t + 0.42
    ;[220, 330, 440].forEach((f) => tone(c, "sawtooth", f, f, 0.03, hit, 0.5, { detune: 7 }))
    tone(c, "sine", 880, 880, 0.03, hit, 0.6)
  },
  /** Potion gulp: bubbly pitch blips before the fever riser. */
  potion(c: AudioContext, t: number) {
    for (let i = 0; i < 4; i++) {
      const f = 300 + Math.random() * 260
      tone(c, "sine", f, f * 1.8, 0.04, t + i * 0.05, 0.05)
    }
  },
  /** Active skill fired. */
  skillUse(c: AudioContext, t: number) {
    // Charge-up riser into a wide power chord and a sub hit.
    const e = echo(c, 0.14, 0.35, 0.4)
    noise(c, "bandpass", 500, 1.2, 0.07, t, 0.3, { sweepTo: 7000, attack: 0.18 })
    tone(c, "sawtooth", 200, 900, 0.05, t, 0.3, { attack: 0.2 })
    const hit = t + 0.28
    ;[293.7, 440, 587.3, 880].forEach((f, i) =>
      tone(c, "sawtooth", f, f, 0.045, hit, 0.9, { detune: i % 2 ? 8 : -8, dest: e }),
    )
    tone(c, "sine", 90, 38, 0.2, hit, 0.6)
    noise(c, "lowpass", 300, 1, 0.1, hit, 0.35)
  },
  /** Chain lightning strike: crackling arcs, a bright snap and rolling thunder. */
  lightning(c: AudioContext, t: number) {
    const e = echo(c, 0.09, 0.3, 0.35)
    for (let i = 0; i < 6; i++) {
      const at = t + i * 0.028 + Math.random() * 0.015
      noise(c, "highpass", 3500 + Math.random() * 3000, 0.7, 0.16, at, 0.05)
    }
    tone(c, "sawtooth", 2400, 90, 0.08, t, 0.22, { attack: 0.001, dest: e })
    tone(c, "square", 1600, 70, 0.04, t + 0.01, 0.25, { attack: 0.001 })
    // Thunder: long lowpassed rumble with a sub thump.
    noise(c, "lowpass", 900, 0.8, 0.22, t + 0.08, 1.4, { sweepTo: 120, attack: 0.03 })
    tone(c, "sine", 70, 32, 0.22, t + 0.06, 0.9)
  },
  /** Shockwave (quake): ground boom, cracking rock and a slow rumble. */
  quake(c: AudioContext, t: number) {
    tone(c, "sine", 62, 22, 0.34, t, 1.3, { attack: 0.004 })
    tone(c, "triangle", 110, 40, 0.14, t, 0.7)
    noise(c, "lowpass", 260, 1.4, 0.3, t, 1.6, { sweepTo: 60, attack: 0.01 })
    noise(c, "bandpass", 1200, 1, 0.12, t, 0.18)
    for (let i = 0; i < 8; i++) {
      const at = t + 0.1 + Math.random() * 0.6
      noise(c, "bandpass", 1800 + Math.random() * 2500, 3, 0.05, at, 0.05)
    }
  },
  /** Resonance echo: the strike rings back a beat later. */
  echoStrike(c: AudioContext, t: number) {
    const e = echo(c, 0.11, 0.45, 0.5)
    tone(c, "triangle", 1318, 1318, 0.06, t, 0.25, { dest: e })
    tone(c, "sine", 659, 659, 0.05, t, 0.4, { dest: e })
  },
  /** CORE CRISIS: two-tone siren. */
  crisis(c: AudioContext, t: number) {
    for (let i = 0; i < 3; i++) {
      tone(c, "square", 620, 620, 0.028, t + i * 0.3, 0.14)
      tone(c, "square", 470, 470, 0.028, t + i * 0.3 + 0.15, 0.14)
    }
    noise(c, "lowpass", 180, 1, 0.05, t, 0.9)
  },
  /** Crisis resolved: settle down-sweep and a calm major third. */
  crisisResolve(c: AudioContext, t: number) {
    const e = echo(c)
    tone(c, "sine", 900, 440, 0.04, t, 0.25, { dest: e })
    tone(c, "triangle", 440, 440, 0.04, t + 0.2, 0.45, { dest: e })
    tone(c, "triangle", 554, 554, 0.035, t + 0.24, 0.45, { dest: e })
  },
  /** Achievement: sparkly bell arpeggio. */
  achievement(c: AudioContext, t: number) {
    const e = echo(c, 0.13, 0.35, 0.35)
    ;[784, 988, 1175, 1568].forEach((f, i) => {
      tone(c, "sine", f, f, 0.05, t + i * 0.07, 0.5, { dest: e })
      tone(c, "sine", f * 2.01, f * 2.01, 0.012, t + i * 0.07, 0.3, { dest: e })
    })
  },
  /** Region travel: warp sweep. */
  travel(c: AudioContext, t: number) {
    tone(c, "sine", 200, 1400, 0.04, t, 0.35, { attack: 0.08 })
    noise(c, "bandpass", 800, 2, 0.04, t, 0.4, { sweepTo: 4000, attack: 0.1 })
  },
  /** Region unlocked / story beat. */
  notify(c: AudioContext, t: number) {
    const e = echo(c)
    tone(c, "triangle", 1046, 1046, 0.035, t, 0.18, { dest: e })
    tone(c, "triangle", 1568, 1568, 0.03, t + 0.09, 0.3, { dest: e })
  },
  /** Manual save confirmation. */
  save(c: AudioContext, t: number) {
    tone(c, "sine", 1318, 1318, 0.025, t, 0.08)
    tone(c, "sine", 1760, 1760, 0.022, t + 0.06, 0.14)
  },
  /** Center ore shattered. */
  oreBreak(c: AudioContext, t: number) {
    noise(c, "highpass", 2500, 0.8, 0.07, t, 0.35)
    noise(c, "lowpass", 400, 1, 0.08, t, 0.3)
    for (let i = 0; i < 6; i++) {
      const f = 2200 + Math.random() * 2600
      tone(c, "sine", f, f * 0.9, 0.02, t + 0.02 + i * 0.03, 0.12)
    }
    tone(c, "sine", 90, 45, 0.08, t, 0.3)
  },
  /** Golden vein claimed: jackpot chime. */
  vein(c: AudioContext, t: number) {
    const e = echo(c, 0.1, 0.35, 0.35)
    ;[1046, 1318, 1568, 2093, 2637].forEach((f, i) => tone(c, "triangle", f, f, 0.045, t + i * 0.045, 0.35, { dest: e }))
    noise(c, "highpass", 7000, 0.7, 0.025, t, 0.4)
  },
  /** Golden vein appeared. */
  veinSpawn(c: AudioContext, t: number) {
    tone(c, "sine", 2093, 2093, 0.03, t, 0.15)
    tone(c, "sine", 2637, 2637, 0.025, t + 0.08, 0.25)
  },
  /** Mine session: last seconds tick. */
  timerWarn(c: AudioContext, t: number) {
    tone(c, "square", 1320, 1320, 0.028, t, 0.06, { attack: 0.001 })
    tone(c, "sine", 660, 660, 0.03, t, 0.1)
  },
  /** Mine session over. */
  sessionEnd(c: AudioContext, t: number) {
    const e = echo(c, 0.15, 0.3, 0.3)
    tone(c, "triangle", 784, 784, 0.045, t, 0.18, { dest: e })
    tone(c, "triangle", 587, 587, 0.045, t + 0.14, 0.18, { dest: e })
    tone(c, "triangle", 392, 392, 0.05, t + 0.28, 0.5, { dest: e })
    noise(c, "lowpass", 300, 1, 0.04, t + 0.28, 0.4)
  },
  /** Drill overdrive engaged. */
  drill(c: AudioContext, t: number) {
    tone(c, "sawtooth", 80, 240, 0.04, t, 0.5, { attack: 0.05 })
    tone(c, "square", 120, 360, 0.02, t, 0.5, { attack: 0.05 })
    noise(c, "bandpass", 900, 2, 0.04, t, 0.5, { sweepTo: 2600 })
  },
  /** Settings toggle / on-off. */
  toggle(c: AudioContext, t: number) {
    tone(c, "triangle", 1200, 1600, 0.03, t, 0.06)
  },
  /** Welcome-back reward claimed. */
  reward(c: AudioContext, t: number) {
    const e = echo(c)
    ;[523, 659, 784].forEach((f) => tone(c, "triangle", f, f, 0.035, t, 0.5, { dest: e }))
    tone(c, "sine", 1046, 1046, 0.03, t + 0.12, 0.5, { dest: e })
  },
  /** Transcendence panel / worldline row open. */
  transcend(c: AudioContext, t: number) {
    const e = echo(c, 0.18, 0.4, 0.4)
    tone(c, "sine", 220, 220, 0.05, t, 0.9, { attack: 0.2, dest: e })
    tone(c, "sine", 330, 330, 0.035, t + 0.1, 0.8, { attack: 0.2, dest: e })
    tone(c, "sine", 495, 495, 0.02, t + 0.2, 0.7, { attack: 0.2, dest: e })
  },
} satisfies Record<string, (c: AudioContext, t: number) => void>

export type SfxName = keyof typeof CUES

/** Play a named UI/game cue. Respects the global mute and per-cue rate limits. */
export function playSfx(name: SfxName) {
  if (muted) return
  const now = typeof performance !== "undefined" ? performance.now() : Date.now()
  const gap = MIN_GAP_MS[name] ?? 30
  if (now - (lastPlayed.get(name) ?? -Infinity) < gap) return
  lastPlayed.set(name, now)
  const c = audio()
  if (!c) return
  try {
    CUES[name](c, c.currentTime + 0.005)
  } catch {
    /* audio graph refused (context closed) — never break gameplay for SFX */
  }
}

/**
 * Mining laser: a heavy charged beam — detuned saw stack sweeping down, a sub-bass
 * impact and a rock crunch. Crits add a bright crystal ring with an echo tail.
 * Pitch wobbles a little so rapid taps don't phase into one tone.
 */
export function playLaser(mutedArg: boolean, critical: boolean) {
  if (mutedArg || muted) return
  const c = audio()
  if (!c) return
  const t0 = c.currentTime
  const j = 1 + (Math.random() - 0.5) * 0.08
  const dur = critical ? 0.22 : 0.14
  const top = (critical ? 1700 : 1150) * j
  for (const det of [-12, 0, 12]) {
    tone(c, "sawtooth", top, critical ? 110 : 140, critical ? 0.07 : 0.05, t0, dur, { attack: 0.002, detune: det })
  }
  tone(c, "square", top / 2, 60, critical ? 0.035 : 0.022, t0, dur, { attack: 0.002 })
  noise(c, "bandpass", critical ? 2600 : 2000, 0.7, critical ? 0.09 : 0.06, t0, dur, { sweepTo: 500 })
  // Impact: sub boom + rock crunch so every hit lands on something solid.
  tone(c, "sine", 120 * j, 38, critical ? 0.24 : 0.16, t0 + 0.01, critical ? 0.32 : 0.2)
  noise(c, "lowpass", 700, 1, critical ? 0.12 : 0.07, t0 + 0.01, 0.14)
  if (critical) {
    const e = echo(c, 0.08, 0.3, 0.35)
    tone(c, "triangle", 2093, 2093, 0.06, t0 + 0.03, 0.35, { dest: e })
    tone(c, "triangle", 3136, 3136, 0.03, t0 + 0.05, 0.3, { dest: e })
  }
}

/** Stamp pitch per worldline so each rebirth lands with its own color. */
const STAMP_ROOT: Record<string, number> = {
  directive_pulse: 440,
  aurelia_grid: 392,
  resonance_protocol: 523,
  volatile_core: 311,
  adaptive_architect: 466,
}

/** Rebirth beat cues, keyed by the placeholder names in `REBIRTH_AUDIO_CUES`. */
export function playRebirthCue(name: string) {
  if (muted) return
  const c = audio()
  if (!c) return
  const t = c.currentTime
  if (name === "sfx_rebirth_confirm_click") {
    tone(c, "square", 1200, 900, 0.04, t, 0.06)
  } else if (name === "sfx_rebirth_collapse_whoosh") {
    tone(c, "sine", 520, 70, 0.07, t, 0.5)
    noise(c, "bandpass", 700, 0.6, 0.05, t, 0.5, { sweepTo: 200 })
  } else if (name === "sfx_rebirth_void_tear") {
    noise(c, "bandpass", 3200, 2, 0.06, t, 0.35)
    tone(c, "sawtooth", 90, 45, 0.05, t, 0.55)
  } else if (name.startsWith("sfx_rebirth_stamp_")) {
    const root = STAMP_ROOT[name.slice("sfx_rebirth_stamp_".length)] ?? 440
    const e = echo(c, 0.16, 0.35, 0.35)
    tone(c, "triangle", root, root, 0.08, t, 0.6, { dest: e })
    tone(c, "sine", root * 1.5, root * 1.5, 0.05, t + 0.04, 0.5, { dest: e })
    noise(c, "lowpass", 180, 1, 0.08, t, 0.18)
  } else if (name === "sfx_rebirth_rebuild_rise") {
    tone(c, "sine", 220, 880, 0.05, t, 0.7)
  } else if (name === "sfx_rebirth_settle_chime") {
    const e = echo(c, 0.2, 0.4, 0.4)
    tone(c, "sine", 1046, 1046, 0.04, t, 0.8, { dest: e })
    tone(c, "sine", 1318, 1318, 0.03, t + 0.08, 0.7, { dest: e })
  }
}

/** Region field challenge feedback: a clean hit, a miss, and the final whistle. */
export function playChallengeCue(mutedArg: boolean, cue: "hit" | "miss" | "done") {
  if (mutedArg || muted) return
  const c = audio()
  if (!c) return
  const t = c.currentTime
  if (cue === "hit") {
    tone(c, "triangle", 880, 1320, 0.05, t, 0.12)
    noise(c, "bandpass", 3000, 1.5, 0.02, t, 0.08)
  } else if (cue === "miss") {
    tone(c, "sawtooth", 180, 90, 0.04, t, 0.2)
  } else {
    tone(c, "sine", 660, 660, 0.05, t, 0.25)
    tone(c, "sine", 990, 990, 0.04, t + 0.12, 0.45)
  }
}

export type HuntCue =
  | "shot"
  | "hit"
  | "crit"
  | "weak"
  | "kill"
  | "bossKill"
  | "charge"
  | "interrupt"
  | "shield"
  | "miss"
  | "wave"
  | "boss"
  | "adds"
  | "enrage"
  | "won"
  | "lost"
  | "timeout"

const HUNT_GAP_MS: Partial<Record<HuntCue, number>> = { shot: 35, hit: 30, crit: 40, weak: 40, miss: 60, charge: 120 }
const huntLast = new Map<HuntCue, number>()

/**
 * Monster hunt cues. The blaster is lighter than the mining laser so rapid fire stays readable;
 * weak points crack like glass, bosses roar through a lowpassed saw stack.
 */
export function playHuntCue(cue: HuntCue) {
  if (muted) return
  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now()
  if (nowMs - (huntLast.get(cue) ?? -Infinity) < (HUNT_GAP_MS[cue] ?? 0)) return
  huntLast.set(cue, nowMs)
  const c = audio()
  if (!c) return
  const t = c.currentTime + 0.003
  const j = 1 + (Math.random() - 0.5) * 0.1
  try {
    switch (cue) {
      case "shot":
        tone(c, "sawtooth", 1900 * j, 380, 0.035, t, 0.09, { attack: 0.001, detune: -8 })
        tone(c, "sawtooth", 1900 * j, 380, 0.035, t, 0.09, { attack: 0.001, detune: 8 })
        noise(c, "bandpass", 3200, 1, 0.03, t, 0.06, { sweepTo: 900 })
        break
      case "hit":
        tone(c, "sine", 190 * j, 70, 0.14, t, 0.14)
        noise(c, "lowpass", 1400, 1, 0.07, t, 0.09)
        tone(c, "square", 420 * j, 300, 0.02, t, 0.05)
        break
      case "crit":
        tone(c, "sine", 210 * j, 60, 0.2, t, 0.2)
        noise(c, "bandpass", 2400, 1.2, 0.08, t, 0.12)
        tone(c, "triangle", 1568, 1568, 0.05, t + 0.02, 0.22, { dest: echo(c, 0.07, 0.25, 0.3) })
        break
      case "weak": {
        const e = echo(c, 0.09, 0.3, 0.35)
        noise(c, "highpass", 5200, 0.8, 0.09, t, 0.12)
        ;[2637, 3520].forEach((f, i) => tone(c, "triangle", f * j, f * j, 0.045, t + i * 0.025, 0.25, { dest: e }))
        tone(c, "sine", 160, 50, 0.22, t, 0.22)
        break
      }
      case "kill": {
        const e = echo(c, 0.1, 0.3, 0.3)
        noise(c, "lowpass", 2200, 0.9, 0.14, t, 0.3, { sweepTo: 200 })
        tone(c, "sine", 140, 40, 0.24, t, 0.35)
        ;[880, 1320].forEach((f, i) => tone(c, "triangle", f * j, f * j * 1.02, 0.035, t + 0.05 + i * 0.05, 0.25, { dest: e }))
        break
      }
      case "bossKill": {
        const e = echo(c, 0.16, 0.4, 0.45)
        tone(c, "sine", 90, 24, 0.4, t, 1.6)
        noise(c, "lowpass", 900, 0.8, 0.3, t, 1.8, { sweepTo: 80 })
        for (let i = 0; i < 10; i++) noise(c, "bandpass", 1500 + Math.random() * 3000, 3, 0.06, t + 0.05 + Math.random() * 0.8, 0.08)
        ;[523, 659, 784, 1046].forEach((f, i) => tone(c, "triangle", f, f, 0.05, t + 0.5 + i * 0.09, 0.9, { dest: e }))
        break
      }
      case "charge":
        tone(c, "sawtooth", 180, 720, 0.03, t, 0.5, { attack: 0.3 })
        tone(c, "sine", 360, 1440, 0.025, t, 0.5, { attack: 0.3 })
        break
      case "interrupt": {
        const e = echo(c, 0.08, 0.3, 0.3)
        tone(c, "square", 1200, 300, 0.05, t, 0.18, { attack: 0.001 })
        noise(c, "bandpass", 4000, 2, 0.08, t, 0.15, { sweepTo: 800 })
        tone(c, "triangle", 988, 988, 0.05, t + 0.08, 0.3, { dest: e })
        tone(c, "triangle", 1318, 1318, 0.045, t + 0.14, 0.35, { dest: e })
        break
      }
      case "shield":
        tone(c, "sawtooth", 320, 60, 0.09, t, 0.5, { attack: 0.002 })
        tone(c, "square", 240, 50, 0.05, t, 0.5, { attack: 0.002, detune: 20 })
        noise(c, "highpass", 3000, 0.7, 0.12, t, 0.35)
        tone(c, "sine", 70, 30, 0.3, t, 0.5)
        break
      case "miss":
        noise(c, "bandpass", 700, 1.5, 0.03, t, 0.07)
        break
      case "wave": {
        const e = echo(c, 0.15, 0.35, 0.35)
        tone(c, "sawtooth", 147, 147, 0.035, t, 0.7, { attack: 0.02, dest: e, detune: -6 })
        tone(c, "sawtooth", 220, 220, 0.03, t, 0.7, { attack: 0.02, dest: e, detune: 6 })
        noise(c, "lowpass", 300, 1, 0.1, t, 0.3)
        tone(c, "sine", 60, 40, 0.2, t, 0.4)
        break
      }
      case "boss": {
        // Horn blast, then the roar: detuned low saws through a sweeping lowpass.
        const e = echo(c, 0.2, 0.4, 0.4)
        ;[73.4, 110, 146.8].forEach((f, i) => tone(c, "sawtooth", f, f, 0.05, t, 1.1, { attack: 0.08, detune: i * 5 - 5, dest: e }))
        const roar = t + 0.9
        for (const det of [-25, 0, 25]) tone(c, "sawtooth", 95, 55, 0.07, roar, 1.1, { attack: 0.05, detune: det })
        noise(c, "bandpass", 500, 0.8, 0.2, roar, 1.2, { sweepTo: 180, attack: 0.05 })
        tone(c, "sine", 55, 28, 0.35, roar, 1.2)
        break
      }
      case "adds":
        for (let i = 0; i < 4; i++) tone(c, "square", 880 + i * 120, 440, 0.02, t + i * 0.06, 0.08)
        noise(c, "bandpass", 1800, 2, 0.05, t, 0.3, { sweepTo: 600 })
        break
      case "enrage":
        for (const det of [-30, 0, 30]) tone(c, "sawtooth", 130, 70, 0.07, t, 0.9, { attack: 0.03, detune: det })
        noise(c, "lowpass", 700, 1, 0.18, t, 0.9, { sweepTo: 150 })
        break
      case "won": {
        const e = echo(c, 0.14, 0.35, 0.4)
        const notes = [523.3, 659.3, 784, 1046.5, 784, 1046.5]
        notes.forEach((f, i) => tone(c, "triangle", f, f, 0.055, t + i * 0.1, i === notes.length - 1 ? 1.1 : 0.22, { dest: e }))
        ;[261.6, 329.6, 392].forEach((f) => tone(c, "sawtooth", f, f, 0.018, t + 0.5, 1.2, { attack: 0.05, dest: e }))
        break
      }
      case "lost": {
        const e = echo(c, 0.2, 0.35, 0.35)
        ;[392, 349.2, 311.1, 293.7].forEach((f, i) => tone(c, "triangle", f, f, 0.05, t + i * 0.22, 0.5, { dest: e }))
        tone(c, "sine", 73, 36, 0.2, t + 0.66, 1.2)
        break
      }
      case "timeout": {
        const e = echo(c, 0.15, 0.3, 0.3)
        tone(c, "sine", 880, 880, 0.05, t, 0.2, { dest: e })
        tone(c, "sine", 660, 660, 0.05, t + 0.18, 0.5, { dest: e })
        break
      }
    }
  } catch {
    /* audio graph refused — never break gameplay for SFX */
  }
}
