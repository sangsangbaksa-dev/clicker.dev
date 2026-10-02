import { planClickerSaveHandoff } from "../../domain/services/clicker-account-save-slot.ts"
import {
  copyClickerRawBetweenSlots,
  readClickerRawAtLoginId,
  setClickerSaveSlotLoginId,
  writeClickerRawAtLoginId,
} from "./clicker-save.ts"

/** Move the active save slot when the signed-in account changes. */
export function handoffClickerSaveForAccount(
  previousLoginId: string | null,
  nextLoginId: string | null,
): void {
  const guestHas = !!readClickerRawAtLoginId(null)
  const accountHas = nextLoginId ? !!readClickerRawAtLoginId(nextLoginId) : false
  const plan = planClickerSaveHandoff(previousLoginId, nextLoginId, guestHas, accountHas)

  if (plan.kind === "copy-guest-into-account" && nextLoginId) {
    copyClickerRawBetweenSlots(null, nextLoginId)
  }
  if (plan.kind === "mirror-account-to-guest-on-logout" && previousLoginId) {
    const accountRaw = readClickerRawAtLoginId(previousLoginId)
    if (accountRaw) writeClickerRawAtLoginId(null, accountRaw)
  }

  setClickerSaveSlotLoginId(nextLoginId)
}
