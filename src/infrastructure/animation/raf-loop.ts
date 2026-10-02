/** Browser timing: the only place that touches requestAnimationFrame for monster motion. */
export function startLoop(tick: (tSeconds: number) => void): () => void {
  let raf = 0
  const t0 = performance.now()
  const step = (now: number) => {
    tick((now - t0) / 1000)
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
  return () => cancelAnimationFrame(raf)
}
