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
  nav: 45,
  select: 45,
  playerHurt: 200,
  bossPhase: 900,
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
  // iOS parks the context in "interrupted" after a call or backgrounding, not "suspended".
  if (ctx.state !== "running" && ctx.state !== "closed") void ctx.resume().catch(() => {})
  return ctx
}

/** Call from a capture-phase gesture listener so later SFX aren't stuck suspended. */
export function unlockSfx() {
  audio()
}

/** The shared context, for BGM gain routing. Only call after a user gesture. */
export function sharedAudioContext(): AudioContext | null {
  return audio()
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

/**
 * Soft UI pluck: a sine that starts a touch sharp and settles, through a lowpass,
 * so presses sound rounded instead of like raw oscillator blips.
 */
function pluck(c: AudioContext, freq: number, gain: number, start: number, dur: number, bend = 1.12) {
  const lp = c.createBiquadFilter()
  lp.type = "lowpass"
  lp.frequency.value = Math.min(9000, freq * 4)
  lp.Q.value = 0.3
  lp.connect(out(c))
  const osc = c.createOscillator()
  osc.type = "sine"
  osc.frequency.setValueAtTime(freq * bend, start)
  osc.frequency.exponentialRampToValueAtTime(freq, start + Math.min(0.03, dur / 2))
  const g = envGain(c, gain, start, 0.003, dur)
  osc.connect(g)
  g.connect(lp)
  osc.start(start)
  osc.stop(start + dur + 0.03)
}

/** Small bell: fundamental plus a quiet inharmonic partial, soft attack. */
function bell(c: AudioContext, freq: number, gain: number, start: number, dur: number, dest?: AudioNode) {
  tone(c, "sine", freq, freq, gain, start, dur, { attack: 0.004, dest })
  tone(c, "sine", freq * 2.76, freq * 2.76, gain * 0.18, start, dur * 0.5, { attack: 0.002, dest })
}

/** ±6% pitch drift so looping creature sounds never repeat exactly. */
/** Shimmering run of high sine blips (world skills, skill casts). */
function sparkle(c: AudioContext, start: number, base = 1568, count = 6, gain = 0.018, step = 0.028) {
  for (let i = 0; i < count; i++) {
    const f = base * 2 ** ((i * 3 + Math.random()) / 12)
    tone(c, "sine", f, f * 1.01, gain, start + i * step, 0.16)
  }
}

/** Sub-bass kick under a reward. */
function thump(c: AudioContext, start: number, gain = 0.09, from = 140) {
  tone(c, "sine", from, 42, gain, start, 0.22, { attack: 0.002 })
}

const vary = () => 0.94 + Math.random() * 0.12

/** Creature voice: detuned saws with vibrato through two vowel formants. */
function formantVoice(c: AudioContext, freq: number, start: number, dur: number, gain: number, formants: number[]) {
  const g = envGain(c, gain, start, 0.08, dur)
  g.connect(out(c))
  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  lfo.frequency.value = 7
  lfoGain.gain.value = freq * 0.06
  lfo.connect(lfoGain)
  for (const f of formants) {
    const bp = c.createBiquadFilter()
    bp.type = "bandpass"
    bp.frequency.value = f
    bp.Q.value = 5
    bp.connect(g)
    for (const d of [-9, 9]) {
      const osc = c.createOscillator()
      osc.type = "sawtooth"
      osc.detune.value = d
      osc.frequency.setValueAtTime(freq * 1.15, start)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.8, start + dur)
      lfoGain.connect(osc.frequency)
      osc.connect(bp)
      osc.start(start)
      osc.stop(start + dur + 0.05)
    }
  }
  lfo.start(start)
  lfo.stop(start + dur + 0.05)
}

/** Pentatonic-ish step so repeated purchases climb a little instead of droning. */
let purchaseStep = 0
const PURCHASE_STEPS = [0, 2, 4, 7, 9, 12]
const semis = (base: number, n: number) => base * 2 ** (n / 12)

const CUES = {
  /** Generic UI press: soft rounded pop with a faint glassy top. */
  tap(c: AudioContext, t: number) {
    pluck(c, 660, 0.05, t, 0.09)
    pluck(c, 1980, 0.008, t, 0.05)
  },
  /** Soft tick — tab / panel switch. */
  tick(c: AudioContext, t: number) {
    pluck(c, 1760, 0.014, t, 0.04)
  },
  /** Buy OK: coin clink, then a warm three-note chime that climbs on streaks, with a soft kick and sparkle. */
  purchase(c: AudioContext, t: number) {
    const step = PURCHASE_STEPS[purchaseStep % PURCHASE_STEPS.length]
    purchaseStep += 1
    const root = semis(784, step)
    const e = echo(c, 0.08, 0.2, 0.22)
    bell(c, root * 2, 0.026, t, 0.1, e)
    bell(c, root * 2.52, 0.02, t + 0.022, 0.12, e)
    bell(c, root, 0.042, t + 0.035, 0.2, e)
    bell(c, root * 1.26, 0.036, t + 0.075, 0.24, e)
    bell(c, root * 1.5, 0.036, t + 0.115, 0.34, e)
    sparkle(c, t + 0.13, root * 2, 4, 0.01, 0.024)
    thump(c, t, 0.045, 170)
  },
  /** Permanent upgrade: two-note rise with a sparkle tail. */
  upgrade(c: AudioContext, t: number) {
    const e = echo(c, 0.09, 0.25, 0.25)
    tone(c, "triangle", 659, 659, 0.05, t, 0.12, { dest: e })
    tone(c, "triangle", 988, 988, 0.055, t + 0.07, 0.22, { dest: e })
    tone(c, "sine", 1976, 1976, 0.018, t + 0.1, 0.3, { dest: e })
  },
  /** Can't afford / refused: muted low double bump. */
  deny(c: AudioContext, t: number) {
    pluck(c, 220, 0.06, t, 0.1, 0.8)
    pluck(c, 185, 0.06, t + 0.11, 0.13, 0.8)
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
    const e = echo(c, 0.1, 0.2, 0.2)
    bell(c, 1175, 0.025, t, 0.15, e)
    bell(c, 1568, 0.022, t + 0.07, 0.25, e)
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
    pluck(c, 990, 0.03, t, 0.06)
    pluck(c, 1320, 0.022, t + 0.04, 0.07)
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
  /** Tab / dock / navigation button: soft woody knock. */
  nav(c: AudioContext, t: number) {
    pluck(c, 494, 0.06, t, 0.1)
    pluck(c, 988, 0.012, t, 0.06)
  },
  /** Back / close: gentle falling two-step. */
  back(c: AudioContext, t: number) {
    pluck(c, 880, 0.035, t, 0.07)
    pluck(c, 660, 0.035, t + 0.05, 0.1)
  },
  /** Opening a panel or screen: airy rising two-step. */
  open(c: AudioContext, t: number) {
    pluck(c, 660, 0.035, t, 0.08)
    pluck(c, 988, 0.035, t + 0.05, 0.12)
    noise(c, "bandpass", 5000, 1.5, 0.006, t, 0.12, { sweepTo: 8000, attack: 0.03 })
  },
  /** Selecting a node / card: glassy ping. */
  select(c: AudioContext, t: number) {
    bell(c, 1568, 0.025, t, 0.14)
  },
  /** Confirm / primary action (not a purchase). */
  confirm(c: AudioContext, t: number) {
    const e = echo(c, 0.09, 0.18, 0.18)
    bell(c, 784, 0.035, t, 0.16, e)
    bell(c, 1175, 0.035, t + 0.06, 0.24, e)
  },
  /** Dangerous choice (crisis options, reset): low muted thud with a minor second. */
  danger(c: AudioContext, t: number) {
    pluck(c, 196, 0.07, t, 0.18, 0.8)
    pluck(c, 208, 0.04, t + 0.02, 0.18, 0.8)
  },
  /** Region monster slain: squelch + coin spill. */
  monsterDie(c: AudioContext, t: number) {
    tone(c, "sawtooth", 420, 90, 0.06, t, 0.25, { attack: 0.002 })
    noise(c, "lowpass", 1200, 1, 0.08, t, 0.25, { sweepTo: 200 })
    ;[1318, 1568, 2093].forEach((f, i) => tone(c, "triangle", f, f, 0.03, t + 0.18 + i * 0.05, 0.15))
  },
  /** Guardian wakes. */
  bossRoar(c: AudioContext, t: number) {
    tone(c, "sawtooth", 90, 55, 0.12, t, 1.2, { attack: 0.08, detune: 12 })
    tone(c, "sawtooth", 92, 50, 0.1, t, 1.2, { attack: 0.08, detune: -12 })
    noise(c, "lowpass", 500, 1, 0.12, t, 1.2, { sweepTo: 120, attack: 0.1 })
  },
  /** Guardian strikes the player. */
  playerHurt(c: AudioContext, t: number) {
    tone(c, "square", 220, 110, 0.06, t, 0.18)
    noise(c, "bandpass", 700, 1.5, 0.08, t, 0.2)
  },
  /** Guardian falls. */
  bossDown(c: AudioContext, t: number) {
    const e = echo(c, 0.2, 0.45, 0.45)
    tone(c, "sine", 60, 25, 0.3, t, 1.6)
    noise(c, "lowpass", 800, 1, 0.2, t, 1.8, { sweepTo: 80 })
    ;[523, 659, 784, 1046, 1318].forEach((f, i) => tone(c, "triangle", f, f, 0.05, t + 0.6 + i * 0.12, 0.8, { dest: e }))
  },
  /* ---------- Boss monsters (kept quiet: they loop in the background) ---------- */
  /** Wingbeat: a leathery whoosh that sweeps down, with a soft air thump. */
  wingFlap(c: AudioContext, t: number) {
    const v = vary()
    noise(c, "bandpass", 900 * v, 0.9, 0.045, t, 0.32, { sweepTo: 220 * v, attack: 0.06 })
    noise(c, "lowpass", 260, 0.7, 0.04, t + 0.08, 0.22, { attack: 0.02 })
    tone(c, "sine", 58 * v, 40, 0.035, t + 0.08, 0.2, { attack: 0.02 })
  },
  /** Heavy footfall: sub impact, ground rumble tail and a scatter of pebbles. */
  stomp(c: AudioContext, t: number) {
    const v = vary()
    tone(c, "sine", 82 * v, 30, 0.14, t, 0.34, { attack: 0.002 })
    tone(c, "triangle", 160 * v, 60, 0.04, t, 0.08, { attack: 0.001 })
    noise(c, "lowpass", 420, 1, 0.06, t, 0.35, { sweepTo: 70 })
    for (let i = 0; i < 3; i++) noise(c, "bandpass", 2600 + i * 700, 6, 0.015, t + 0.05 + i * 0.045 * v, 0.03)
  },
  /** Windup: throaty growl — a vowel-shaped saw stack with a slow wobble. */
  bossGrowl(c: AudioContext, t: number) {
    const v = vary()
    formantVoice(c, 68 * v, t, 0.5, 0.06, [320, 780])
    noise(c, "bandpass", 260, 2, 0.035, t, 0.5, { attack: 0.12 })
  },
  /** Weapon smash: crack transient, sub boom with cavern echo, debris rattle. */
  bossSmash(c: AudioContext, t: number) {
    const v = vary()
    const e = echo(c, 0.19, 0.34, 0.32)
    noise(c, "highpass", 1800, 0.7, 0.09, t, 0.05)
    tone(c, "sine", 120 * v, 26, 0.26, t, 0.7, { attack: 0.002, dest: e })
    tone(c, "square", 70 * v, 35, 0.03, t, 0.25, { attack: 0.002 })
    noise(c, "lowpass", 2600, 0.8, 0.14, t, 0.55, { sweepTo: 110 })
    for (let i = 0; i < 7; i++) noise(c, "bandpass", 1800 + ((i * 523) % 2600), 5, 0.02, t + 0.12 + i * 0.05 * v, 0.035)
  },
  /** Boss takes a tap: meaty thwack plus a short pained grunt. */
  bossHurt(c: AudioContext, t: number) {
    const v = vary()
    noise(c, "bandpass", 1400 * v, 1.2, 0.07, t, 0.07)
    tone(c, "sine", 180 * v, 90, 0.08, t, 0.12, { attack: 0.002 })
    formantVoice(c, 95 * v, t + 0.03, 0.22, 0.035, [450, 900])
  },
  /** Boss falls: a long dying roar sliding down, then the body crashing and crumbling. */
  bossDeath(c: AudioContext, t: number) {
    const e = echo(c, 0.22, 0.4, 0.4)
    formantVoice(c, 150, t, 1.2, 0.07, [650, 1100])
    tone(c, "sine", 70, 24, 0.28, t + 0.7, 1.1, { attack: 0.003, dest: e })
    noise(c, "lowpass", 1600, 0.8, 0.16, t + 0.7, 1.2, { sweepTo: 60 })
    for (let i = 0; i < 12; i++) noise(c, "bandpass", 900 + ((i * 677) % 2400), 5, 0.025, t + 0.8 + i * 0.07, 0.05)
  },
  /** Dragon breath: roaring voice under a crackling, buzzing lightning torrent. */
  dragonBreath(c: AudioContext, t: number) {
    const v = vary()
    formantVoice(c, 118 * v, t, 0.95, 0.06, [700, 1150])
    tone(c, "sawtooth", 60 * v, 45, 0.05, t, 0.9, { attack: 0.05 })
    noise(c, "bandpass", 2400, 0.9, 0.08, t + 0.04, 0.85, { sweepTo: 900, attack: 0.03 })
    for (let i = 0; i < 10; i++) {
      const at = t + 0.06 + i * 0.075 + Math.random() * 0.03
      noise(c, "highpass", 3500 + Math.random() * 3000, 1, 0.05, at, 0.025)
      tone(c, "square", 1400 + Math.random() * 900, 300, 0.012, at, 0.04, { attack: 0.001 })
    }
  },
  // Cues added after the original set (world skills, boss hits, skill casts), in their first form.
  /** Guardian struck: short meaty impact. */
  bossHit(c: AudioContext, t: number) {
    noise(c, "bandpass", 1600, 1.5, 0.05, t, 0.07)
    tone(c, "square", 260 * vary(), 140, 0.035, t, 0.09)
    thump(c, t, 0.08, 150)
  },
  /** Guardian HP phase (66% / 33%): riser + sub slam + shimmer. */
  bossPhase(c: AudioContext, t: number) {
    const e = echo(c, 0.16, 0.38, 0.42)
    tone(c, "sine", 180, 720, 0.07, t, 0.55, { attack: 0.08, dest: e })
    noise(c, "bandpass", 900, 1.2, 0.05, t, 0.5, { sweepTo: 2800, attack: 0.12 })
    thump(c, t + 0.48, 0.22, 72)
    sparkle(c, t + 0.52, 1400, 7, 0.018, 0.024)
  },
  /** World skill learned: deep gong + rising chime. */
  worldSkill(c: AudioContext, t: number) {
    const e = echo(c, 0.18, 0.4, 0.4)
    tone(c, "sine", 196, 196, 0.08, t, 1.1, { dest: e })
    tone(c, "sine", 294, 294, 0.04, t, 0.9, { dest: e })
    ;[784, 988, 1175, 1568].forEach((f, i) => tone(c, "triangle", f, f, 0.04, t + 0.12 + i * 0.06, 0.4, { dest: e }))
    sparkle(c, t + 0.4, 1760, 6)
    thump(c, t, 0.1, 120)
  },
  /** Instant energy (CORE PULSE, TIME WARP): reverse swell, huge core impact, shower of coins. */
  skillBurst(c: AudioContext, t: number) {
    const e = echo(c, 0.15, 0.38, 0.42)
    noise(c, "lowpass", 200, 1, 0.09, t, 0.32, { sweepTo: 4000, attack: 0.3 })
    tone(c, "sine", 55, 110, 0.08, t, 0.32, { attack: 0.3 })
    const hit = t + 0.3
    tone(c, "sine", 160, 30, 0.3, hit, 0.9, { attack: 0.002 })
    noise(c, "lowpass", 700, 1, 0.16, hit, 0.4)
    noise(c, "bandpass", 2500, 2, 0.05, hit, 0.12)
    ;[523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(c, "triangle", f, f, 0.05, hit + i * 0.02, 0.9, { dest: e }))
    // Coin shower: bright bells scattered over half a second.
    for (let i = 0; i < 12; i++) {
      const f = 2000 + Math.random() * 2200
      bell(c, f, 0.022, hit + 0.08 + i * 0.045 + Math.random() * 0.02, 0.22)
    }
  },
  /** Mining buff (LASER FOCUS): charging whine into a laser zap and a ringing crystal. */
  skillLaser(c: AudioContext, t: number) {
    const e = echo(c, 0.09, 0.32, 0.36)
    tone(c, "sine", 400, 3200, 0.05, t, 0.28, { attack: 0.2 })
    tone(c, "square", 800, 6400, 0.012, t, 0.28, { attack: 0.2 })
    noise(c, "highpass", 2000, 1, 0.03, t, 0.28, { sweepTo: 9000, attack: 0.2 })
    const zap = t + 0.27
    tone(c, "sawtooth", 3200, 160, 0.09, zap, 0.26, { attack: 0.001, dest: e })
    tone(c, "square", 1600, 90, 0.035, zap, 0.3, { attack: 0.001 })
    noise(c, "highpass", 4500, 0.8, 0.12, zap, 0.06)
    thump(c, zap, 0.14, 180)
    ;[1318.5, 1975.5, 2637].forEach((f, i) => bell(c, f, 0.045 - i * 0.01, zap + 0.06 + i * 0.05, 0.7, e))
    sparkle(c, zap + 0.12, 2637, 6, 0.016, 0.022)
  },
  /** Production buff (OVERCLOCK, GRID BOOST, STABILIZER): turbine spin-up, power-chord slam, engine thrum. */
  skillPower(c: AudioContext, t: number) {
    const e = echo(c, 0.13, 0.36, 0.4)
    tone(c, "sawtooth", 80, 640, 0.05, t, 0.36, { attack: 0.25 })
    tone(c, "square", 160, 1280, 0.018, t, 0.36, { attack: 0.25 })
    noise(c, "bandpass", 300, 1.3, 0.07, t, 0.36, { sweepTo: 6000, attack: 0.28 })
    const hit = t + 0.34
    tone(c, "sine", 120, 36, 0.26, hit, 0.75, { attack: 0.002 })
    noise(c, "lowpass", 500, 1, 0.14, hit, 0.3)
    ;[146.8, 220, 293.7, 440].forEach((f, i) => tone(c, "sawtooth", f, f, 0.04, hit, 1.1, { detune: i % 2 ? 10 : -10, dest: e }))
    tone(c, "triangle", 1174.7, 1174.7, 0.035, hit + 0.02, 0.6, { dest: e })
    sparkle(c, hit + 0.05, 2093, 8, 0.02, 0.026)
    // Engine thrum: the chord re-strikes and fades, so the buff feels like it keeps running.
    ;[0.26, 0.42, 0.58].forEach((dt, i) => {
      const g = 0.03 * (1 - i * 0.28)
      tone(c, "sawtooth", 293.7, 293.7, g, hit + dt, 0.14, { detune: -8 })
      tone(c, "sawtooth", 440, 440, g, hit + dt, 0.14, { detune: 8 })
    })
  },
} satisfies Record<string, (c: AudioContext, t: number) => void>

export type SfxName = keyof typeof CUES

/** HQ one-shots for cues that also have a synth fallback in `CUES`. */
const SFX_SAMPLE: Partial<Record<SfxName, string>> = {
  bossRoar: "/clicker/audio/sfx_boss_appear_v1.mp3",
  bossHit: "/clicker/audio/sfx_boss_hit_v1.mp3",
  bossPhase: "/clicker/audio/sfx_boss_phase_change_v1.mp3",
  bossDown: "/clicker/audio/sfx_boss_defeat_v1.mp3",
}

type OneShotSampleRec = { audio: HTMLAudioElement; wired: boolean }
const oneShotSamples = new Map<string, OneShotSampleRec>()

/** One-shot mp3 samples routed through the same master bus as synth SFX. */
function playOneShotSample(url: string, onFail: () => void): boolean {
  if (typeof window === "undefined") return false
  const c = audio()
  if (!c) return false
  let rec = oneShotSamples.get(url)
  if (!rec) {
    const audioEl = new Audio(url)
    audioEl.preload = "auto"
    rec = { audio: audioEl, wired: false }
    oneShotSamples.set(url, rec)
  }
  if (!rec.wired) {
    try {
      c.createMediaElementSource(rec.audio).connect(out(c))
      rec.wired = true
      rec.audio.volume = 1
    } catch {
      rec.audio.volume = MASTER_GAIN
    }
  }
  rec.audio.currentTime = 0
  void rec.audio.play().catch(onFail)
  return true
}

/** Play a named UI/game cue. Respects the global mute and per-cue rate limits. */
export function playSfx(name: SfxName) {
  if (muted) return
  const now = typeof performance !== "undefined" ? performance.now() : Date.now()
  const gap = MIN_GAP_MS[name] ?? 30
  if (now - (lastPlayed.get(name) ?? -Infinity) < gap) return
  lastPlayed.set(name, now)
  const playSynth = () => {
    const c = audio()
    if (!c) return
    try {
      CUES[name](c, c.currentTime + 0.005)
    } catch {
      /* audio graph refused (context closed) — never break gameplay for SFX */
    }
  }
  const sampleUrl = SFX_SAMPLE[name]
  if (sampleUrl && playOneShotSample(sampleUrl, playSynth)) return
  playSynth()
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

const REBIRTH_CUE_SAMPLE: Record<string, string> = {
  sfx_rebirth_confirm_click: "/clicker/audio/sfx_rebirth_trigger_hq.mp3",
  sfx_rebirth_collapse_whoosh: "/clicker/audio/sfx_rebirth_collapse_whoosh_v3.mp3",
  sfx_rebirth_void_tear: "/clicker/audio/sfx_rebirth_void_tear_v3.mp3",
  sfx_rebirth_rebuild_rise: "/clicker/audio/sfx_rebirth_rebuild_hq.mp3",
  sfx_rebirth_settle_chime: "/clicker/audio/sfx_rebirth_complete_hq.mp3",
}

function rebirthCueSampleUrl(name: string): string | null {
  const direct = REBIRTH_CUE_SAMPLE[name]
  if (direct) return direct
  if (name.startsWith("sfx_rebirth_stamp_")) return `/clicker/audio/${name}_hq.mp3`
  return null
}

function playRebirthCueSynth(name: string, c: AudioContext) {
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

/** Rebirth beat cues, keyed by the names in `REBIRTH_AUDIO_CUES`. Prefers HQ mp3 when mapped. */
export function playRebirthCue(name: string) {
  if (muted) return
  const synth = () => {
    const c = audio()
    if (!c) return
    try {
      playRebirthCueSynth(name, c)
    } catch {
      /* context closed */
    }
  }
  const sampleUrl = rebirthCueSampleUrl(name)
  if (sampleUrl && playOneShotSample(sampleUrl, synth)) return
  synth()
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

/** The original rebirth had no background drone; kept as a no-op so the sequence API stays the same. */
export function playRebirthDrone(seconds: number): () => void {
  void seconds
  return () => {}
}
