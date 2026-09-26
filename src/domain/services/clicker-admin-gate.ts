export type ClickerAdminGateInput = {
  nodeEnv?: string
}

/**
 * Playtest admin panel/cheats — shown in every non-production build (local dev, LAN),
 * never on the deployed site. UI also strips via `process.env.NODE_ENV !== "production"`
 * for dead-code elimination.
 */
export function isClickerAdminAllowed(input: ClickerAdminGateInput = {}): boolean {
  const nodeEnv = (
    input.nodeEnv ??
    (typeof process !== "undefined" && process.env.NODE_ENV ? process.env.NODE_ENV : "production")
  ).toLowerCase()
  // Hard deny: production (and Production casing) never exposes admin helpers.
  return nodeEnv !== "production"
}
