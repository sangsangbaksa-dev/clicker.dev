/** Floating hit numbers live outside React state so popping one repaints only the float layer. */
export type FloatNumber = {
  id: number
  text: string
  critical: boolean
  /** Extra strike label — lightning / shockwave / echo. */
  strike?: "lightning" | "quake" | "echo"
  x: number
  y: number
}

const MAX_FLOATS = 13
let floats: FloatNumber[] = []
let nextId = 0
const listeners = new Set<() => void>()
const timers = new Set<ReturnType<typeof setTimeout>>()

function emit() {
  for (const listener of listeners) listener()
}

/** Pop a floating number; it removes itself after `ms`. */
export function pushFloat(float: Omit<FloatNumber, "id">, ms: number) {
  const id = ++nextId
  floats = [...floats.slice(-(MAX_FLOATS - 1)), { id, ...float }]
  emit()
  const timer = setTimeout(() => {
    timers.delete(timer)
    floats = floats.filter((f) => f.id !== id)
    emit()
  }, ms)
  timers.add(timer)
}

export function clearFloats() {
  for (const timer of timers) clearTimeout(timer)
  timers.clear()
  if (!floats.length) return
  floats = []
  emit()
}

export function subscribeFloats(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getFloats() {
  return floats
}

const EMPTY: FloatNumber[] = []
export function getServerFloats() {
  return EMPTY
}
