/*
 * What the Core Guardian components may use from the pure motion domain (components do not import
 * the domain directly): the clock and event functions, plus the helpers around them.
 */
export {
  allFrames,
  bossFightOutcome,
  enrageLevel,
  frameId,
  lookahead,
  registerAttack,
  registerDefeat,
  registerHit,
  restrictLayers,
  sampleMotion,
  startMotion,
} from "../domain/services/clicker-guardian-motion.ts"
export type { ClipName, MotionState } from "../domain/services/clicker-guardian-motion.ts"
