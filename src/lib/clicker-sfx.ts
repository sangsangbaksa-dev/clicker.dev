"use client"

/**
 * Synthesized SFX (Web Audio) — one shared context, unlocked on the first gesture.
 * Everything routes through a master bus (gain → compressor) so click spam and
 * stacked cues don't clip on phone speakers. Nothing here loads a file.
 */

let ctx: AudioContext | null = null
let bus: GainNode | null = null
/** Soft-clip send: impacts go through it so sub hits grow harmonics small speakers can play. */
let drive: AudioNode | null = null
let muted = false
let noiseBuf: AudioBuffer | null = null

const MASTER_GAIN = 0.9
/** Rapid-fire guard per cue so a held key or MAX-buy doesn't machine-gun. */
const MIN_GAP_MS: Partial<Record<SfxName, number>> = {
  tap: 45,
  nav: 45,
  select: 45,
  playerHurt: 200,
  purchase: 60,
  deny: 140,
  tick: 90,
  achievement: 400,
  save: 400,
  lightning: 220,
  quake: 380,
  echoStrike: 120,
  bossHit: 70,
  worldSkill: 200,
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
    const shaper = ctx.createWaveShaper()
    const curve = new Float32Array(1024)
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 3.2)
    shaper.curve = curve
    shaper.oversample = "2x"
    const pre = ctx.createGain()
    pre.gain.value = 2.2
    const post = ctx.createGain()
    post.gain.value = 0.42
    pre.connect(shaper)
    shaper.connect(post)
    post.connect(bus)
    drive = pre
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
  { attack = 0.004, detune = 0, dest, pan = 0 }: { attack?: number; detune?: number; dest?: AudioNode; pan?: number } = {},
) {
  const osc = c.createOscillator()
  osc.type = type
  osc.detune.value = detune
  osc.frequency.setValueAtTime(from, start)
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + dur)
  const g = envGain(c, gain, start, attack, dur)
  osc.connect(g)
  if (pan && c.createStereoPanner) {
    const p = c.createStereoPanner()
    p.pan.value = pan
    g.connect(p)
    p.connect(dest ?? out(c))
  } else {
    g.connect(dest ?? out(c))
  }
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

/** Reward glitter: a fast rising run of tiny bells (the "you got something" sparkle). */
function sparkle(c: AudioContext, start: number, base = 1568, count = 6, gain = 0.018, step = 0.028) {
  for (let i = 0; i < count; i++) {
    const f = base * 2 ** ((i * 3 + Math.random()) / 12)
    tone(c, "sine", f, f * 1.01, gain, start + i * step, 0.16)
  }
}

/** Sub-bass kick under a reward, so it lands in the chest and not just the ears. */
function thump(c: AudioContext, start: number, gain = 0.09, from = 140) {
  tone(c, "sine", from, 42, gain, start, 0.22, { attack: 0.002 })
  // Saturated copy: the harmonics carry the kick on phone and laptop speakers.
  tone(c, "sine", from * 1.6, 55, gain * 0.9, start, 0.12, { attack: 0.001, dest: drive ?? undefined })
}

/** Click transient: a few ms of bright noise that gives a hit its "tick" edge. */
function snap(c: AudioContext, start: number, gain = 0.08, freq = 3800) {
  noise(c, "highpass", freq, 0.7, gain, start, 0.018, { attack: 0.0008 })
}

/** Punchy kick: fast pitch drop through the drive bus, plus a snap on top. */
function punch(c: AudioContext, start: number, gain = 0.2, from = 220, to = 48, dur = 0.2) {
  const dest = drive ?? undefined
  tone(c, "sine", from, to, gain, start, dur, { attack: 0.001, dest })
  tone(c, "triangle", from * 2, to * 2, gain * 0.25, start, dur * 0.4, { attack: 0.001, dest })
  snap(c, start, gain * 0.35)
}

/** Coin ding: bright bell pair with a metallic partial. */
function coin(c: AudioContext, start: number, freq = 1976, gain = 0.035) {
  tone(c, "square", freq, freq, gain * 0.35, start, 0.05, { attack: 0.001 })
  tone(c, "sine", freq, freq, gain, start, 0.22, { attack: 0.001 })
  tone(c, "sine", freq * 1.335, freq * 1.335, gain * 0.9, start + 0.06, 0.3, { attack: 0.001 })
  tone(c, "sine", freq * 2.7, freq * 2.7, gain * 0.2, start + 0.06, 0.12)
}

/**
 * Laser "pew": a square wave diving from a high pitch, a buzzy saw a fifth up for body,
 * and a fast vibrato so it sizzles like a sci-fi blaster instead of a plain sweep.
 */
function pew(
  c: AudioContext,
  start: number,
  from: number,
  to: number,
  dur: number,
  gain: number,
  { pan = 0, dest, buzz = 0.09 }: { pan?: number; dest?: AudioNode; buzz?: number } = {},
) {
  const g = envGain(c, gain, start, 0.0015, dur)
  const lp = c.createBiquadFilter()
  lp.type = "lowpass"
  lp.Q.value = 6
  lp.frequency.setValueAtTime(Math.min(16000, from * 3), start)
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, to * 2), start + dur)
  lp.connect(g)
  let node: AudioNode = g
  if (pan && c.createStereoPanner) {
    const p = c.createStereoPanner()
    p.pan.value = pan
    g.connect(p)
    node = p
  }
  node.connect(dest ?? out(c))
  const lfo = c.createOscillator()
  const depth = c.createGain()
  lfo.frequency.value = 38
  depth.gain.setValueAtTime(from * buzz, start)
  depth.gain.exponentialRampToValueAtTime(Math.max(1, to * buzz), start + dur)
  lfo.connect(depth)
  for (const [type, mult, det] of [["square", 1, 0], ["sawtooth", 1.5, 7], ["sawtooth", 0.5, -7]] as const) {
    const osc = c.createOscillator()
    osc.type = type
    osc.detune.value = det
    osc.frequency.setValueAtTime(from * mult, start)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to * mult), start + dur)
    depth.connect(osc.frequency)
    const og = c.createGain()
    og.gain.value = type === "square" ? 1 : 0.45
    osc.connect(og)
    og.connect(lp)
    osc.start(start)
    osc.stop(start + dur + 0.03)
  }
  lfo.start(start)
  lfo.stop(start + dur + 0.03)
}

/** Stereo glitter: a sparkle run that flies left↔right across the speakers. */
function shimmer(c: AudioContext, start: number, base = 2093, count = 10, gain = 0.02, step = 0.03, dest?: AudioNode) {
  for (let i = 0; i < count; i++) {
    const f = base * 2 ** (((i * 5) % 24 + Math.random()) / 12)
    tone(c, "sine", f, f * 1.01, gain, start + i * step, 0.24, { pan: i % 2 ? 0.7 : -0.7, dest })
    tone(c, "sine", f * 2.01, f * 2.01, gain * 0.25, start + i * step, 0.1, { pan: i % 2 ? 0.7 : -0.7 })
  }
}

/** Riser: noise + saw climbing into the hit, panned wide as it rises. */
function riser(c: AudioContext, start: number, dur: number, gain = 0.06, from = 300, to = 7000) {
  noise(c, "bandpass", from, 1.3, gain, start, dur, { sweepTo: to, attack: dur * 0.8 })
  tone(c, "sawtooth", from / 2, to / 6, gain * 0.5, start, dur, { attack: dur * 0.7, pan: -0.4 })
  tone(c, "sawtooth", from / 2, to / 6, gain * 0.5, start, dur, { attack: dur * 0.7, detune: 12, pan: 0.4 })
}

/** ±6% pitch drift so looping creature sounds never repeat exactly. */
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
  /** Buy OK: snappy cash-register ka-ching that climbs on streaks. */
  purchase(c: AudioContext, t: number) {
    const step = PURCHASE_STEPS[purchaseStep % PURCHASE_STEPS.length]
    purchaseStep += 1
    const root = semis(1568, step)
    snap(c, t, 0.06, 5000)
    noise(c, "bandpass", 2400, 4, 0.03, t, 0.03)
    coin(c, t + 0.015, root, 0.04)
    sparkle(c, t + 0.09, root * 1.5, 3, 0.012)
    punch(c, t, 0.09, 200, 60, 0.12)
  },
  /** Permanent upgrade: punchy power-up rise with a bright sparkle tail. */
  upgrade(c: AudioContext, t: number) {
    const e = echo(c, 0.09, 0.25, 0.25)
    punch(c, t, 0.16, 240, 50, 0.22)
    tone(c, "square", 523, 1046, 0.03, t, 0.12, { attack: 0.002 })
    tone(c, "triangle", 659, 659, 0.055, t + 0.02, 0.12, { dest: e })
    tone(c, "triangle", 988, 988, 0.06, t + 0.08, 0.24, { dest: e })
    tone(c, "triangle", 1318, 1318, 0.04, t + 0.14, 0.3, { dest: e })
    sparkle(c, t + 0.14, 1760, 6, 0.02)
  },
  /** Can't afford / refused: muted low double bump. */
  deny(c: AudioContext, t: number) {
    pluck(c, 220, 0.06, t, 0.1, 0.8)
    pluck(c, 185, 0.06, t + 0.11, 0.13, 0.8)
  },
  /** Skill circuit unlocked: power-on whoosh, electric arc, glassy arpeggio over a pad, bright bell. */
  skillUnlock(c: AudioContext, t: number) {
    const e = echo(c, 0.11, 0.34, 0.36)
    noise(c, "bandpass", 600, 1.4, 0.035, t, 0.22, { sweepTo: 6500, attack: 0.12 })
    noise(c, "highpass", 5000, 1, 0.04, t + 0.16, 0.08)
    const go = t + 0.16
    punch(c, go, 0.2, 200, 45, 0.3)
    ;[261.6, 392, 523.3].forEach((f, i) => tone(c, "triangle", f, f, 0.03, go, 0.75, { attack: 0.02, detune: i % 2 ? 6 : -6, dest: e }))
    ;[523, 659, 784, 1046, 1318].forEach((f, i) => tone(c, "triangle", f, f * 1.003, 0.05, go + i * 0.05, 0.24, { dest: e }))
    bell(c, 2093, 0.05, go + 0.28, 0.7, e)
    shimmer(c, go + 0.3, 2093, 12, 0.018, 0.026, e)
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
  /** Active skill fired: wide riser, a stereo power chord slam and a glitter storm. */
  skillUse(c: AudioContext, t: number) {
    const e = echo(c, 0.16, 0.42, 0.45)
    riser(c, t, 0.34, 0.07, 400, 8000)
    const hit = t + 0.32
    punch(c, hit, 0.32, 200, 32, 0.7)
    noise(c, "lowpass", 900, 1, 0.14, hit, 0.4, { sweepTo: 120 })
    ;[293.7, 440, 587.3, 880, 1174.7].forEach((f, i) =>
      tone(c, "sawtooth", f, f, 0.04, hit, 1.1, { detune: i % 2 ? 9 : -9, dest: e, pan: (i - 2) * 0.35 }),
    )
    ;[1174.7, 1480, 1760, 2349].forEach((f, i) => tone(c, "triangle", f, f, 0.04, hit + 0.06 + i * 0.05, 0.5, { dest: e, pan: i % 2 ? 0.6 : -0.6 }))
    shimmer(c, hit + 0.12, 2349, 14, 0.018, 0.028, e)
  },
  /** Production buff (OVERCLOCK, GRID BOOST, STABILIZER): turbine spin-up, stereo power-chord slam, engine thrum, fanfare. */
  skillPower(c: AudioContext, t: number) {
    const e = echo(c, 0.15, 0.42, 0.46)
    tone(c, "sawtooth", 80, 640, 0.05, t, 0.38, { attack: 0.26, pan: -0.5 })
    tone(c, "square", 160, 1280, 0.02, t, 0.38, { attack: 0.26, pan: 0.5 })
    riser(c, t, 0.38, 0.07, 300, 7000)
    const hit = t + 0.36
    punch(c, hit, 0.34, 190, 30, 0.8)
    noise(c, "lowpass", 700, 1, 0.16, hit, 0.35, { sweepTo: 100 })
    noise(c, "highpass", 6000, 0.7, 0.05, hit, 0.3)
    ;[146.8, 220, 293.7, 440, 587.3].forEach((f, i) => tone(c, "sawtooth", f, f, 0.038, hit, 1.3, { detune: i % 2 ? 10 : -10, dest: e, pan: (i - 2) * 0.35 }))
    // Fanfare on top, climbing.
    ;[587.3, 740, 880, 1174.7, 1480].forEach((f, i) => tone(c, "triangle", f, f, 0.045, hit + 0.08 + i * 0.07, 0.45, { dest: e, pan: i % 2 ? 0.5 : -0.5 }))
    shimmer(c, hit + 0.15, 2093, 14, 0.018, 0.03, e)
    // Engine thrum: the chord re-strikes and fades, so the buff feels like it keeps running.
    ;[0.3, 0.48, 0.66, 0.84].forEach((dt, i) => {
      const g = 0.03 * (1 - i * 0.22)
      tone(c, "sawtooth", 293.7, 293.7, g, hit + dt, 0.14, { detune: -8, pan: -0.4 })
      tone(c, "sawtooth", 440, 440, g, hit + dt, 0.14, { detune: 8, pan: 0.4 })
      tone(c, "sine", 73.4, 73.4, g * 2, hit + dt, 0.14, { dest: drive ?? undefined })
    })
  },
  /** Mining buff (LASER FOCUS): charging whine, a volley of stereo laser shots, ringing crystals. */
  skillLaser(c: AudioContext, t: number) {
    const e = echo(c, 0.1, 0.38, 0.42)
    tone(c, "sine", 300, 4200, 0.05, t, 0.34, { attack: 0.26, pan: -0.3 })
    tone(c, "square", 600, 8400, 0.012, t, 0.34, { attack: 0.26, pan: 0.3 })
    noise(c, "highpass", 2000, 1, 0.035, t, 0.34, { sweepTo: 10000, attack: 0.26 })
    const zap = t + 0.32
    // Volley: five shots fanning across the stereo field, then a big finishing beam.
    for (let i = 0; i < 5; i++) pew(c, zap + i * 0.065, 3400 + i * 300, 200, 0.14, 0.06, { pan: i % 2 ? 0.6 : -0.6, dest: e })
    const fin = zap + 0.36
    pew(c, fin, 4800, 120, 0.4, 0.1, { buzz: 0.14, dest: e })
    punch(c, fin, 0.26, 230, 40, 0.4)
    noise(c, "highpass", 4500, 0.8, 0.12, fin, 0.08)
    ;[1318.5, 1975.5, 2637, 3520].forEach((f, i) => bell(c, f, 0.045 - i * 0.008, fin + 0.08 + i * 0.05, 0.8, e))
    shimmer(c, fin + 0.12, 2637, 12, 0.016, 0.026, e)
  },
  /** Instant energy (CORE PULSE, TIME WARP): reverse swell, huge core impact, stereo shower of coins. */
  skillBurst(c: AudioContext, t: number) {
    const e = echo(c, 0.17, 0.44, 0.48)
    noise(c, "lowpass", 200, 1, 0.1, t, 0.34, { sweepTo: 5000, attack: 0.32 })
    tone(c, "sine", 55, 110, 0.08, t, 0.34, { attack: 0.32 })
    riser(c, t + 0.05, 0.29, 0.05, 500, 9000)
    const hit = t + 0.32
    punch(c, hit, 0.4, 180, 26, 1.0)
    tone(c, "sine", 160, 30, 0.28, hit, 0.9, { attack: 0.002 })
    noise(c, "lowpass", 900, 1, 0.18, hit, 0.45, { sweepTo: 90 })
    noise(c, "bandpass", 2500, 2, 0.06, hit, 0.12)
    ;[523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => tone(c, "triangle", f, f, 0.05, hit + i * 0.025, 1.1, { dest: e, pan: (i - 2) * 0.3 }))
    // Coin shower: bright coins scattered across the speakers for most of a second.
    for (let i = 0; i < 18; i++) {
      const f = 1800 + Math.random() * 2600
      tone(c, "sine", f, f, 0.022, hit + 0.08 + i * 0.04 + Math.random() * 0.02, 0.2, { pan: Math.random() * 1.6 - 0.8 })
      tone(c, "sine", f * 1.335, f * 1.335, 0.014, hit + 0.12 + i * 0.04, 0.16, { pan: Math.random() * 1.6 - 0.8 })
    }
    shimmer(c, hit + 0.5, 2637, 10, 0.016, 0.035, e)
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
    // Closing major chord + glitter shower.
    ;[523, 659, 784, 1046].forEach((f) => tone(c, "triangle", f, f, 0.03, t + 0.3, 0.8, { dest: e }))
    sparkle(c, t + 0.32, 2093, 8, 0.016, 0.035)
    thump(c, t + 0.3, 0.09)
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
  /** Center ore shattered: crunchy crack, glass shards, sparkle. */
  oreBreak(c: AudioContext, t: number) {
    punch(c, t, 0.24, 240, 40, 0.3)
    noise(c, "highpass", 2500, 0.8, 0.1, t, 0.35)
    noise(c, "lowpass", 900, 1, 0.12, t, 0.3, { sweepTo: 150 })
    for (let i = 0; i < 8; i++) {
      const f = 2200 + Math.random() * 2600
      tone(c, "sine", f, f * 0.9, 0.024, t + 0.02 + i * 0.028, 0.14)
    }
    sparkle(c, t + 0.12, 1318, 8, 0.022, 0.028)
  },
  /** Golden vein claimed: jackpot chime. */
  vein(c: AudioContext, t: number) {
    const e = echo(c, 0.1, 0.35, 0.35)
    ;[1046, 1318, 1568, 2093, 2637].forEach((f, i) => tone(c, "triangle", f, f, 0.045, t + i * 0.045, 0.35, { dest: e }))
    noise(c, "highpass", 7000, 0.7, 0.025, t, 0.4)
    sparkle(c, t + 0.22, 2637, 8, 0.02, 0.03)
    thump(c, t, 0.1)
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
    sparkle(c, t + 0.15, 1568, 6)
    thump(c, t, 0.08)
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
  /** Gacha: crank ratchet + capsule rattle + drop. */
  gachaPull(c: AudioContext, t: number) {
    for (let i = 0; i < 5; i++) noise(c, "bandpass", 1800 + i * 150, 6, 0.035, t + i * 0.05, 0.04)
    for (let i = 0; i < 4; i++) pluck(c, 900 + Math.random() * 500, 0.02, t + 0.3 + i * 0.045, 0.06)
    thump(c, t + 0.5, 0.07, 180)
  },
  /** Gacha reveal · rare: bright two-chime pop. */
  gachaRare(c: AudioContext, t: number) {
    const e = echo(c, 0.09, 0.25, 0.25)
    bell(c, 1175, 0.045, t, 0.3, e)
    bell(c, 1760, 0.04, t + 0.06, 0.4, e)
    sparkle(c, t + 0.1, 2093, 5)
    thump(c, t, 0.06)
  },
  /** Gacha reveal · epic: whoosh riser into a shimmering minor-to-major lift. */
  gachaEpic(c: AudioContext, t: number) {
    const e = echo(c, 0.12, 0.35, 0.35)
    noise(c, "bandpass", 600, 1.4, 0.05, t, 0.4, { sweepTo: 6000, attack: 0.15 })
    ;[587, 740, 880, 1175, 1480].forEach((f, i) => tone(c, "triangle", f, f, 0.045, t + 0.3 + i * 0.06, 0.5, { dest: e }))
    sparkle(c, t + 0.55, 2349, 8, 0.02)
    thump(c, t + 0.3, 0.1)
  },
  /** Gacha reveal · legendary: big riser, impact, golden fanfare and a glitter shower. */
  gachaLegendary(c: AudioContext, t: number) {
    const e = echo(c, 0.16, 0.42, 0.42)
    noise(c, "bandpass", 300, 1.2, 0.06, t, 0.7, { sweepTo: 8000, attack: 0.4 })
    tone(c, "sawtooth", 110, 440, 0.035, t, 0.7, { attack: 0.5 })
    thump(c, t + 0.7, 0.16, 180)
    noise(c, "highpass", 5000, 0.7, 0.05, t + 0.7, 0.6)
    ;[523, 659, 784, 1046].forEach((f) => tone(c, "triangle", f, f, 0.05, t + 0.72, 1.4, { dest: e }))
    ;[1046, 1318, 1568, 2093, 2637].forEach((f, i) => tone(c, "sine", f, f, 0.04, t + 0.8 + i * 0.07, 0.6, { dest: e }))
    sparkle(c, t + 1.0, 2093, 12, 0.02, 0.04)
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
  /** Guardian struck: crunchy meaty impact. */
  bossHit(c: AudioContext, t: number) {
    const v = vary()
    snap(c, t, 0.09, 3000)
    noise(c, "bandpass", 1500 * v, 1.2, 0.08, t, 0.08)
    tone(c, "square", 300 * v, 120, 0.04, t, 0.08, { dest: drive ?? undefined })
    punch(c, t, 0.17, 210 * v, 50, 0.16)
  },
  danger(c: AudioContext, t: number) {
    pluck(c, 196, 0.07, t, 0.18, 0.8)
    pluck(c, 208, 0.04, t + 0.02, 0.18, 0.8)
  },
  /** Region monster slain: heavy splat, burst and a cascading coin spill. */
  monsterDie(c: AudioContext, t: number) {
    const e = echo(c, 0.1, 0.25, 0.25)
    punch(c, t, 0.26, 260, 40, 0.32)
    tone(c, "sawtooth", 480, 70, 0.07, t, 0.24, { attack: 0.002, dest: drive ?? undefined })
    noise(c, "lowpass", 2400, 0.8, 0.13, t, 0.3, { sweepTo: 180 })
    noise(c, "highpass", 4000, 0.7, 0.05, t + 0.01, 0.12)
    ;[1568, 1976, 2349, 2637, 3136].forEach((f, i) => coin(c, t + 0.14 + i * 0.045, f, 0.026))
    sparkle(c, t + 0.36, 2637, 7, 0.016, 0.026)
    tone(c, "triangle", 784, 784, 0.03, t + 0.14, 0.4, { dest: e })
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
  /** Guardian falls: massive boom, debris, victory fanfare. */
  bossDown(c: AudioContext, t: number) {
    const e = echo(c, 0.2, 0.45, 0.45)
    punch(c, t, 0.34, 180, 28, 0.9)
    tone(c, "sine", 60, 25, 0.3, t, 1.6)
    noise(c, "lowpass", 1600, 1, 0.22, t, 1.8, { sweepTo: 80 })
    for (let i = 0; i < 10; i++) noise(c, "bandpass", 1200 + ((i * 677) % 2600), 5, 0.025, t + 0.1 + i * 0.06, 0.05)
    ;[523, 659, 784, 1046, 1318].forEach((f, i) => tone(c, "triangle", f, f, 0.055, t + 0.6 + i * 0.12, 0.8, { dest: e }))
    ;[523, 659, 784, 1046].forEach((f) => tone(c, "sawtooth", f, f, 0.018, t + 1.2, 1.4, { detune: 8, dest: e }))
    sparkle(c, t + 1.25, 2093, 12, 0.02, 0.04)
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
  /** Boss takes a tap: crunchy thwack plus a short pained grunt. */
  bossHurt(c: AudioContext, t: number) {
    const v = vary()
    snap(c, t, 0.08, 2800)
    noise(c, "bandpass", 1400 * v, 1.2, 0.08, t, 0.07)
    punch(c, t, 0.15, 200 * v, 55, 0.14)
    formantVoice(c, 95 * v, t + 0.03, 0.22, 0.035, [450, 900])
  },
  /** Boss falls: a long dying roar sliding down, then the body crashing and crumbling. */
  bossDeath(c: AudioContext, t: number) {
    const e = echo(c, 0.22, 0.4, 0.4)
    formantVoice(c, 150, t, 1.2, 0.08, [650, 1100])
    punch(c, t + 0.7, 0.32, 170, 26, 1)
    tone(c, "sine", 70, 24, 0.28, t + 0.7, 1.1, { attack: 0.003, dest: e })
    noise(c, "lowpass", 2200, 0.8, 0.2, t + 0.7, 1.2, { sweepTo: 60 })
    for (let i = 0; i < 14; i++) noise(c, "bandpass", 900 + ((i * 677) % 2400), 5, 0.03, t + 0.8 + i * 0.06, 0.05)
    ;[1568, 1976, 2349, 2637, 3136, 3520].forEach((f, i) => coin(c, t + 1.0 + i * 0.06, f, 0.024))
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
/** Concert-hall reverb (a generated 3 s impulse), shared by the cinematic cues. */
let hallNode: ConvolverNode | null = null
function hall(c: AudioContext): AudioNode {
  if (!hallNode || hallNode.context !== c) {
    const len = Math.floor(c.sampleRate * 3.2)
    const ir = c.createBuffer(2, len, c.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6
    }
    hallNode = c.createConvolver()
    hallNode.buffer = ir
    const wet = c.createGain()
    wet.gain.value = 0.55
    hallNode.connect(wet)
    wet.connect(out(c))
  }
  return hallNode
}

/** Send a source to both the dry bus and the hall. */
function wide(c: AudioContext): AudioNode {
  const g = c.createGain()
  g.connect(out(c))
  g.connect(hall(c))
  return g
}

/** Brass-like chord: detuned saw stacks with a slow swell through an opening lowpass. */
function brass(c: AudioContext, start: number, freqs: number[], dur: number, gain: number, attack = 0.12) {
  const lp = c.createBiquadFilter()
  lp.type = "lowpass"
  lp.Q.value = 1.2
  lp.frequency.setValueAtTime(400, start)
  lp.frequency.exponentialRampToValueAtTime(3200, start + attack + 0.15)
  lp.frequency.exponentialRampToValueAtTime(900, start + dur)
  lp.connect(wide(c))
  freqs.forEach((f, i) => {
    for (const det of [-11, 0, 11]) tone(c, "sawtooth", f, f, gain / 3, start, dur, { attack, detune: det, dest: lp, pan: (i - (freqs.length - 1) / 2) * 0.3 })
  })
}

/** Choir pad: vowel-filtered saws ("aah"), slow in, wide. */
function choir(c: AudioContext, start: number, freqs: number[], dur: number, gain: number) {
  const out2 = wide(c)
  for (const formant of [700, 1150]) {
    const bp = c.createBiquadFilter()
    bp.type = "bandpass"
    bp.frequency.value = formant
    bp.Q.value = 4
    bp.connect(out2)
    freqs.forEach((f, i) => {
      for (const det of [-14, 14]) tone(c, "sawtooth", f, f, gain, start, dur, { attack: dur * 0.35, detune: det, dest: bp, pan: i % 2 ? 0.5 : -0.5 })
    })
  }
}

/** Timpani hit: pitched thud with a skin rattle. */
function timpani(c: AudioContext, start: number, freq = 73.4, gain = 0.3) {
  const w = wide(c)
  tone(c, "sine", freq * 1.5, freq, gain, start, 0.9, { attack: 0.002, dest: w })
  tone(c, "triangle", freq * 3, freq * 2, gain * 0.25, start, 0.25, { attack: 0.002, dest: w })
  punch(c, start, gain * 0.8, freq * 2.4, freq * 0.7, 0.4)
}

/** Cymbal: a bright noise crash, or a reversed swell leading into a hit. */
function cymbal(c: AudioContext, start: number, dur: number, gain: number, swell = false) {
  const src = c.createBufferSource()
  src.buffer = whiteNoise(c)
  src.loop = true
  const hp = c.createBiquadFilter()
  hp.type = "highpass"
  hp.frequency.value = 5500
  const g = c.createGain()
  if (swell) {
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(gain, start + dur)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur + 0.05)
  } else {
    g.gain.setValueAtTime(gain, start)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  }
  src.connect(hp)
  hp.connect(g)
  g.connect(wide(c))
  src.start(start, Math.random() * 0.5)
  src.stop(start + dur + 0.1)
}

/** Rebirth beat cues, keyed by the placeholder names in `REBIRTH_AUDIO_CUES`. Cinematic and big. */
export function playRebirthCue(name: string) {
  if (muted) return
  const c = audio()
  if (!c) return
  const t = c.currentTime
  if (name === "sfx_rebirth_confirm_click") {
    // A deep gong: the worldline is locked in.
    snap(c, t, 0.06, 3000)
    timpani(c, t, 55, 0.3)
    ;[110, 164.8, 220].forEach((f) => bell(c, f, 0.05, t, 2.4, wide(c)))
    choir(c, t + 0.1, [220, 329.6], 1.2, 0.012)
  } else if (name === "sfx_rebirth_collapse_whoosh") {
    // The world is sucked inward: a long reversed cymbal, a falling brass line, an implosion at the end.
    cymbal(c, t, 2.6, 0.12, true)
    noise(c, "bandpass", 200, 0.8, 0.08, t, 2.6, { sweepTo: 4000, attack: 2.2 })
    brass(c, t + 0.2, [146.8, 174.6], 2.4, 0.05, 1.6)
    tone(c, "sawtooth", 440, 55, 0.04, t, 2.6, { attack: 0.4, dest: wide(c) })
    punch(c, t + 2.6, 0.32, 150, 28, 0.9)
  } else if (name === "sfx_rebirth_void_tear") {
    // The rift opens: a huge orchestral hit — sub boom, minor brass, choir, crash.
    timpani(c, t, 55, 0.36)
    punch(c, t, 0.34, 180, 26, 1.2)
    brass(c, t, [110, 130.8, 164.8, 220], 2.6, 0.08, 0.04)
    choir(c, t + 0.05, [220, 261.6, 329.6], 2.8, 0.016)
    cymbal(c, t, 2.2, 0.1)
    noise(c, "lowpass", 600, 1, 0.14, t, 1.6, { sweepTo: 60 })
  } else if (name.startsWith("sfx_rebirth_stamp_")) {
    const root = STAMP_ROOT[name.slice("sfx_rebirth_stamp_".length)] ?? 440
    // The seal lands: two timpani strikes, a full major brass chord, crash and ringing bells.
    timpani(c, t, root / 6, 0.38)
    timpani(c, t + 0.22, root / 4, 0.3)
    punch(c, t, 0.36, 200, 26, 1)
    brass(c, t, [root / 4, root / 2, (root / 2) * 1.25, (root / 2) * 1.5, root], 3.2, 0.09, 0.03)
    choir(c, t + 0.1, [root / 2, (root / 2) * 1.25, (root / 2) * 1.5], 3.2, 0.018)
    cymbal(c, t, 2.8, 0.12)
    ;[1, 1.5, 2].forEach((m, i) => bell(c, root * m * 2, 0.045, t + 0.15 + i * 0.12, 2.2, wide(c)))
    shimmer(c, t + 0.2, root * 4, 10, 0.014, 0.05, wide(c))
  } else if (name === "sfx_rebirth_rebuild_rise") {
    // The new world assembles: a timpani roll under a rising string swell.
    for (let i = 0; i < 14; i++) timpani(c, t + i * 0.12, 73.4, 0.06 + i * 0.012)
    brass(c, t, [196, 246.9, 293.7, 392], 2.8, 0.06, 2.2)
    choir(c, t + 0.3, [392, 493.9, 587.3], 2.6, 0.014)
    noise(c, "bandpass", 400, 1, 0.05, t, 2.6, { sweepTo: 7000, attack: 2.2 })
  } else if (name === "sfx_rebirth_settle_chime") {
    // Arrival: a majestic major chord with choir, bells and a long hall tail.
    timpani(c, t, 65.4, 0.3)
    punch(c, t, 0.22, 170, 40, 0.6)
    brass(c, t, [130.8, 196, 261.6, 329.6, 392], 3.6, 0.08, 0.06)
    choir(c, t, [261.6, 329.6, 392, 523.3], 3.8, 0.018)
    cymbal(c, t, 2.4, 0.08)
    ;[1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(c, f, 0.04, t + 0.2 + i * 0.14, 2.4, wide(c)))
    shimmer(c, t + 0.4, 2093, 12, 0.014, 0.05, wide(c))
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

/**
 * Rebirth bed: a low detuned drone whose filter opens over the whole sequence, with a high
 * shimmer pad joining for the second half. Returns a stop function (fades out, frees nodes).
 */
export function playRebirthDrone(seconds: number): () => void {
  if (muted) return () => {}
  const c = audio()
  if (!c) return () => {}
  const t = c.currentTime
  const end = t + seconds
  const master = c.createGain()
  master.gain.setValueAtTime(0.0001, t)
  master.gain.exponentialRampToValueAtTime(0.06, t + 2)
  master.gain.setValueAtTime(0.06, end - 1.5)
  master.gain.exponentialRampToValueAtTime(0.0001, end)
  master.connect(out(c))
  master.connect(hall(c))
  const lp = c.createBiquadFilter()
  lp.type = "lowpass"
  lp.Q.value = 3
  lp.frequency.setValueAtTime(180, t)
  lp.frequency.exponentialRampToValueAtTime(2600, end - 1)
  lp.connect(master)
  const oscs: OscillatorNode[] = []
  const add = (type: OscillatorType, freq: number, detune: number, gain: number, dest: AudioNode, at = t) => {
    const o = c.createOscillator()
    o.type = type
    o.frequency.value = freq
    o.detune.value = detune
    const g = c.createGain()
    g.gain.value = gain
    o.connect(g)
    g.connect(dest)
    o.start(at)
    o.stop(end + 0.1)
    oscs.push(o)
  }
  add("sawtooth", 55, -9, 0.5, lp)
  add("sawtooth", 55, 9, 0.5, lp)
  add("sawtooth", 82.4, 4, 0.25, lp)
  add("sine", 41.2, 0, 0.9, master)
  // Shimmer pad for the rebuild half: a fifth stack high up, swelling in.
  const pad = c.createGain()
  pad.gain.setValueAtTime(0.0001, t)
  pad.gain.setValueAtTime(0.0001, t + seconds * 0.55)
  pad.gain.exponentialRampToValueAtTime(0.35, t + seconds * 0.8)
  pad.connect(master)
  ;[659.3, 987.8, 1318.5].forEach((f, i) => add("triangle", f, i % 2 ? 6 : -6, 0.3, pad, t + seconds * 0.5))
  return () => {
    try {
      const now = c.currentTime
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now)
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
      oscs.forEach((o) => {
        try {
          o.stop(now + 0.45)
        } catch {
          /* already stopped */
        }
      })
    } catch {
      /* context closed */
    }
  }
}
