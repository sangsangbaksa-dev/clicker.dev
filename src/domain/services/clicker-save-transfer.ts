import type { GameConfig, SaveData } from "../entities/clicker"
import { decodeClickerSave } from "./clicker-save-codec.ts"

/**
 * Save codes: a copy-pasteable form of the stored save so players can move a run to
 * another device, or keep it somewhere safer than localStorage (Safari clears site
 * storage after a week without a visit). Prefix + base64url of the UTF-8 save JSON.
 */
export const SAVE_CODE_PREFIX = "AURELIA1."

export type SaveCodeSummary = {
  coreEnergy: number
  totalCoreEnergy: number
  rebirthCount: number
  savedAt: number
}

export type ParsedSaveCode =
  | { ok: true; json: string; save: SaveData; summary: SaveCodeSummary; note?: string }
  | { ok: false; error: string }

function toBase64Url(bytes: Uint8Array): string {
  let bin = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/")
  try {
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/** Wrap stored save JSON (from encodeClickerSave) as a save code. */
export function encodeSaveCode(json: string): string {
  return SAVE_CODE_PREFIX + toBase64Url(new TextEncoder().encode(json))
}

/**
 * Read a pasted save code (or raw save JSON from an exported file). Whitespace and line
 * breaks from chat apps are ignored. Only a save the loader can read cleanly is accepted.
 */
export function parseSaveCode(input: string, config: GameConfig, now: number): ParsedSaveCode {
  const text = input.trim()
  if (!text) return { ok: false, error: "저장 코드를 붙여 넣으세요." }

  let json: string
  if (text.startsWith("{")) {
    json = text
  } else {
    const compact = text.replace(/\s+/g, "")
    if (!compact.startsWith(SAVE_CODE_PREFIX)) {
      return { ok: false, error: `저장 코드는 ${SAVE_CODE_PREFIX}로 시작해야 합니다.` }
    }
    const bytes = fromBase64Url(compact.slice(SAVE_CODE_PREFIX.length))
    if (!bytes || bytes.length === 0) return { ok: false, error: "저장 코드가 잘렸거나 잘못되었습니다." }
    try {
      json = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    } catch {
      return { ok: false, error: "저장 코드가 잘렸거나 잘못되었습니다." }
    }
  }

  const decoded = decodeClickerSave(json, config, now)
  if (decoded.status === "corrupt" || decoded.status === "empty") {
    return { ok: false, error: `읽을 수 없는 저장 코드입니다${decoded.reason ? ` (${decoded.reason})` : ""}.` }
  }
  const { save } = decoded
  return {
    ok: true,
    json,
    save,
    summary: {
      coreEnergy: save.runState.coreEnergy,
      totalCoreEnergy: save.metaState.totalCoreEnergy,
      rebirthCount: save.metaState.rebirthCount,
      savedAt: save.savedAt,
    },
    note: decoded.status === "ok" ? undefined : decoded.reason,
  }
}
