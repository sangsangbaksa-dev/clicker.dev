import { SAVE_CODE_PREFIX } from "./clicker-save-transfer.ts"

/**
 * Pull save-code candidates out of pasted text such as a whole backup e-mail. The code
 * is the run of base64url tokens that starts at the prefix (line breaks added by mail or
 * chat apps are allowed), ending at the first blank line or non-code word. Candidates are
 * returned longest first, then with trailing tokens dropped, because a short English word
 * after the code (a signature) looks just like more base64url.
 */
export function extractSaveCodeCandidates(text: string): string[] {
  const start = text.indexOf(SAVE_CODE_PREFIX)
  if (start < 0) return []
  const rest = text.slice(start).replace(/\r\n?/g, "\n")
  const firstBlank = rest.search(/\n[ \t]*\n/)
  const block = firstBlank < 0 ? rest : rest.slice(0, firstBlank)

  const tokens: string[] = []
  for (const token of block.split(/\s+/)) {
    if (!token) continue
    if (!/^[A-Za-z0-9_-]+$/.test(token) && !(tokens.length === 0 && token.startsWith(SAVE_CODE_PREFIX))) break
    tokens.push(token)
  }
  const out: string[] = []
  for (let n = tokens.length; n >= 1; n--) {
    const candidate = tokens.slice(0, n).join("")
    if (candidate.length > SAVE_CODE_PREFIX.length) out.push(candidate)
  }
  return out
}
