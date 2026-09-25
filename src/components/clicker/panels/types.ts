import type { RunState } from "@/domain/entities/clicker"
import type { useClicker } from "@/hooks/use-clicker"

export type ClickerGame = ReturnType<typeof useClicker>

/** What most drawer panels need: the game, the live run, and the icon-pop feedback. */
export type PanelProps = {
  game: ClickerGame
  run: RunState
  popIcons: Record<string, number>
  bumpIcon: (id: string) => void
}
