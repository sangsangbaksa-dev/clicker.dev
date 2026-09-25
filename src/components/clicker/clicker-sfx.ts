"use client"

/** Synthesized SFX (Web Audio) — one shared context, unlocked on the first gesture. */

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null
  ctx ??= new AudioContext()
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

/** Call from a capture-phase gesture listener so later SFX aren't stuck suspended. */
export function unlockSfx() {
  audio()
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

/** Rebirth beat cues, keyed by the placeholder names in `REBIRTH_AUDIO_CUES`. */
export function playRebirthCue(name: string) {
  const c = audio()
  if (!c) return
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
