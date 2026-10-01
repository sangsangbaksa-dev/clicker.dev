import type { ClickerBgmPorts } from "@/application/clicker-audio-ports"

let factory: (() => ClickerBgmPorts) | null = null

export function bindClickerBgmPortFactory(create: () => ClickerBgmPorts): void {
  factory = create
}

export function clickerBgmPorts(): ClickerBgmPorts {
  if (!factory) throw new Error("Clicker BGM ports are not bound")
  return factory()
}

/** Test-only: clear bindings. */
export function resetClickerBgmBindings(): void {
  factory = null
}
