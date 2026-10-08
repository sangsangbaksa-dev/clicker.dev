#!/usr/bin/env node
/**
 * Shift skill-tree node WebP hues to each branch accent while keeping luminance and alpha.
 *
 *   node --experimental-strip-types scripts/tint-skill-node-icons.mjs
 *
 * Reads branch mapping from clickerConfig.skillNodes (asset path → branch).
 */
import { readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import { clickerConfig } from "../src/data/clicker/catalog.ts"
import { SKILL_BRANCH_COLOR } from "../src/domain/services/clicker-skill-branch-theme.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SKILL_NODE_DIR = path.join(__dirname, "../public/clicker/skill-node")

/** Filename prefix fallbacks when a file is not tied to a single catalog id. */
const PREFIX_BRANCH = {
  focus_: "FOCUS",
  auto_: "AUTOMATION",
  reso_: "RESONANCE",
  echo_: "RESONANCE",
  hunt_: "HUNT",
  trans_: "TRANSCENDENCE",
  storm_: "TRANSCENDENCE",
  drone_: "AUTOMATION",
  quake_: "HUNT",
  mine_: "FOCUS",
  hub_: "TRANSCENDENCE",
}

function hexToRgb(hex) {
  const h = hex.replace("#", "")
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]
}

function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0)
      break
    case g:
      h = (b - r) / d + 2
      break
    default:
      h = (r - g) / d + 4
      break
  }
  return [h / 6, s, l]
}

function hslToRgb(h, s, l) {
  if (s === 0) return [l, l, l]
  const hue2rgb = (p, q, t) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)]
}

function wrapHueDelta(delta) {
  while (delta > 0.5) delta -= 1
  while (delta < -0.5) delta += 1
  return delta
}

function branchForBasename(name) {
  for (const [prefix, branch] of Object.entries(PREFIX_BRANCH)) {
    if (name.startsWith(prefix)) return branch
  }
  return null
}

function buildBranchByFile() {
  const byFile = new Map()
  for (const node of clickerConfig.skillNodes) {
    const asset = node.assetId ?? `/clicker/skill-node/${node.id}.webp`
    if (!asset.includes("/skill-node/")) continue
    const base = path.basename(asset)
    const ownsDefault = base === `${node.id}.webp`
    if (!byFile.has(base) || ownsDefault) byFile.set(base, node.branch)
  }
  return byFile
}

function measureMeanHue(data, width, height) {
  let sumSin = 0
  let sumCos = 0
  let weight = 0
  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    const a = data[o + 3]
    if (a < 24) continue
    const r = data[o] / 255
    const g = data[o + 1] / 255
    const b = data[o + 2] / 255
    const [, s, l] = rgbToHsl(r, g, b)
    if (s < 0.06 || l < 0.04 || l > 0.98) continue
    const [h] = rgbToHsl(r, g, b)
    const w = a / 255 * s
    const ang = h * 2 * Math.PI
    sumSin += Math.sin(ang) * w
    sumCos += Math.cos(ang) * w
    weight += w
  }
  if (weight < 1e-6) return null
  return (Math.atan2(sumSin / weight, sumCos / weight) / (2 * Math.PI) + 1) % 1
}

function tintRaw(data, width, height, targetHex) {
  const [tr, tg, tb] = hexToRgb(targetHex)
  const [targetH, targetS] = rgbToHsl(tr, tg, tb)
  const sourceH = measureMeanHue(data, width, height)
  const hueDelta = sourceH === null ? 0 : wrapHueDelta(targetH - sourceH)

  const out = Buffer.from(data)
  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    const a = out[o + 3]
    if (a === 0) continue
    let r = out[o] / 255
    let g = out[o + 1] / 255
    let b = out[o + 2] / 255
    let [h, s, l] = rgbToHsl(r, g, b)
    if (s < 0.02 && l < 0.08) continue
    h = (h + hueDelta + 1) % 1
    // Nudge saturation toward the branch accent without flattening metal highlights.
    const satBoost = 0.22
    s = Math.min(1, s * (1 - satBoost) + targetS * satBoost)
    ;[r, g, b] = hslToRgb(h, s, l)
    out[o] = Math.round(r * 255)
    out[o + 1] = Math.round(g * 255)
    out[o + 2] = Math.round(b * 255)
  }
  return out
}

async function tintFile(filePath, branch) {
  const accent = SKILL_BRANCH_COLOR[branch]
  if (!accent) throw new Error(`Unknown branch ${branch} for ${filePath}`)
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const tinted = tintRaw(data, info.width, info.height, accent)
  await sharp(tinted, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 92, effort: 4 })
    .toFile(filePath)
}

async function main() {
  const branchByFile = buildBranchByFile()
  const names = await readdir(SKILL_NODE_DIR)
  let done = 0
  for (const name of names.sort()) {
    if (!name.endsWith(".webp")) continue
    const branch = branchByFile.get(name) ?? branchForBasename(name)
    if (!branch) {
      console.warn(`skip (no branch): ${name}`)
      continue
    }
    const filePath = path.join(SKILL_NODE_DIR, name)
    await tintFile(filePath, branch)
    done += 1
    if (done % 25 === 0) console.log(`tinted ${done}…`)
  }
  console.log(`Done — tinted ${done} skill-node icons.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
