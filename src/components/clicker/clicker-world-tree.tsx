"use client"

import {
  formatNumber,
  regionCurrencyBalance,
  regionCurrencyRate,
  worldTreeNodeCost,
  worldTreeNodeError,
  worldTreeNodes,
  worldTreeOwned,
  type RunState,
} from "@/application/clicker-ui"
import { CurrencyIcon } from "@/components/clicker/clicker-currency-icon"
import type { ClickerGame } from "@/hooks/use-clicker"

/** A world's own skill tree: five nodes in order, paid in that world's currency only. */
export function ClickerWorldTree({ game, run, regionId }: { game: ClickerGame; run: RunState; regionId: string }) {
  const nodes = worldTreeNodes(game.config, regionId)
  const region = game.config.regions.find((r) => r.id === regionId)
  if (!nodes.length || !region?.currency) return null
  const balance = regionCurrencyBalance(run, regionId)
  const rate = regionCurrencyRate(run, game.config, regionId)
  const owned = nodes.filter((n) => worldTreeOwned(run, n.id)).length
  const nextIndex = nodes.findIndex((n) => !worldTreeOwned(run, n.id))
  return (
    <section className="clicker-world-tree" aria-label={`${region.name} 월드 스킬 트리`}>
      <header className="clicker-world-tree-head">
        <strong>월드 스킬</strong>
        <span>
          {owned}/{nodes.length}
        </span>
        <span className="clicker-world-tree-wallet">
          <CurrencyIcon regionId={regionId} /> {formatNumber(balance)}
        </span>
        <span className="clicker-world-tree-rate" title="이 지역에서 번 CORE 중 화폐로 바뀌는 비율">
          획득률 {(rate * 100).toFixed(rate < 0.1 ? 1 : 0)}%
        </span>
      </header>
      <ol className="clicker-world-tree-nodes">
        {nodes.map((node, i) => {
          const have = worldTreeOwned(run, node.id)
          const isNext = i === nextIndex
          const cost = worldTreeNodeCost(run, game.config, node)
          const error = isNext ? worldTreeNodeError(run, game.config, node.id) : undefined
          return (
            <li key={node.id} className={`clicker-world-tree-node${have ? " is-owned" : isNext ? " is-next" : " is-locked"}`}>
              <span className="clicker-world-tree-step" aria-hidden>
                {have ? "✓" : i + 1}
              </span>
              <span className="clicker-world-tree-text">
                <b>{node.name}</b>
                <small>{node.description}</small>
              </span>
              {have ? (
                <span className="clicker-world-tree-done">습득</span>
              ) : isNext ? (
                <button
                  type="button"
                  className="clicker-primary clicker-world-tree-buy"
                  disabled={Boolean(error)}
                  title={error}
                  aria-label={`${node.name} 습득 — ${formatNumber(cost)} ${region.currency!.name}`}
                  onClick={() => game.buyWorldTreeNode(node.id)}
                >
                  <CurrencyIcon regionId={regionId} /> {formatNumber(cost)}
                </button>
              ) : (
                <span className="clicker-world-tree-cost">
                  <CurrencyIcon regionId={regionId} /> {formatNumber(cost)}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
