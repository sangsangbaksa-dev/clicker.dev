/**
 * Stage presentation for the clicker UI.
 * The domain decides the surface and the frame; this module only attaches the plate catalog.
 */
import { BOSS_SCENES } from "@/data/clicker/boss-scenes"
import {
  drillMotes,
  frameBossScene,
  hubSurface,
  sceneCameraY,
  weatherMotes,
  type BossSceneDef,
  type BossWeather,
  type HubSurface,
  type HubSurfaceInput,
} from "@/domain/services/clicker-stage"

export type { BossSceneDef, BossWeather, HubSurface, HubSurfaceInput }
export { drillMotes, sceneCameraY, weatherMotes }

export function clickerHubSurface(input: HubSurfaceInput): HubSurface {
  return hubSurface(input)
}

export function clickerFramedBossScene(kind: string, wide: boolean): BossSceneDef | undefined {
  const scene = BOSS_SCENES[kind]
  if (!scene) return undefined
  return frameBossScene(scene, wide)
}
