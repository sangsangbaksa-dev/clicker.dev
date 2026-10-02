"use client"

/**
 * Client-only DI bootstrap. Server Components that import infrastructure bindings only run
 * on the server, so module-level ports stay unbound in the browser bundle unless we import
 * the adapters from a Client Component.
 */
import "@/infrastructure/audio/legacy-sfx-client-bind"
import "@/infrastructure/audio/clicker-bgm-client-bind"
import "@/infrastructure/persistence/clicker-client-bind"

export function ClickerClientBootstrap({ children }: { children: React.ReactNode }) {
  return children
}
