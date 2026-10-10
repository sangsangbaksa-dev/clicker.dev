# Clicker quality registry

Living backlog for design, balance, code, audio, art, and motion. Cron automations pick items from **Now** first; **Done** records what shipped.

Last reviewed: 2026-10-10 (cron pass)

## Now (actionable)

| Area | Item | Source / notes |
|------|------|----------------|
| Art | `mine_interior_hitech_mineral_1080p_v1.png` registered, not wired as chamber BG (seam/layout) | `public/clicker/mine/README.md`, `mine-assets.ts` |
| Design | Rebirth stamp PNGs vs geometric placeholders until final art lands | handoff-pack |
| BGM | Older `bgm_hub_v2` / `bgm_mine_v2` kept for rollback; catalog prefers v2 loops + mine v3 | README-sfx |
| Balance | Run `node --experimental-strip-types scripts/pacing-sim.ts` after economy edits | ~95m to REBIRTH 10M @ 6 c/s |
| Code | ESLint warnings (mostly React setState-in-effect); zero errors | `npm run lint` |
| Deploy | Pages asset paths must stay quoted for `prepare-pages.sh` | CI |

## Watch (needs asset or design call)

| Area | Item |
|------|------|
| Motion | Region intro BGM in `media/region-intro/` — baked into intro MP4s, not a separate public catalog |

## Done (2026-10-10)

| Area | Item |
|------|------|
| Audio | Producer hires use `producerBuy` → `sfx_producer_buy_v2.mp3` (shop/potion keep `purchase`) |
| Design | Producer buys trigger PRODUCTION purchase burst + flash label |

## Done (2026-10-09 pass 2)

| Area | Item |
|------|------|
| Audio | v2/v3 mp3 one-shots mapped in `SFX_SAMPLE` (UI, upgrades, skills, mine enter/exit/timer, rebirth open, transcend) |
| Audio | `rebirthOpen` + `enterMine` / `exitMine` cues; mine leave picks timer vs early exit |
| Code | `backfillClassN` runs on `findUserById` (infers homeroom from BAN membership) |

## Done (2026-10-09)

| Area | Item |
|------|------|
| Audio | `sfx_boss_phase_change_v1` wired at 66% / 33% HP for Core Heart guardian + lair bosses |
| Motion | HP phase flash on guardian fight and painted lair scenes (`is-hp-phase`) |
| Code | `bossHpPhasesCrossed` helper + unit test; room-repository unused destructure cleanup |
| Code | Keyboard mining: Enter / held Space strike a Tab-focused ore at its center (cursor still wins); `resolveKeyboardStrikePoint` + tests |
| A11y | HUD CORE/FEVER/HAUL stats get `role="group"` so labels are read; mine HUD no longer a live region spamming the timer |
| Design | Crisis choice card near-opaque with blur so hub buttons no longer read through |

## Done (2026-10-08)

| Area | Item |
|------|------|
| Audio | Restored HQ mp3 for rebirth ceremony + collapse whoosh v3 via `playRebirthCue` / `playOneShotSample` |
| Audio | Boss appear / hit / defeat prefer v1 mp3 samples in `playSfx` |
| Motion | Rebirth plate A/B crossfade + Resonance/Volatile CSS tint overlays on stamp/rebuild |
| Docs | Restored this registry after production tree revert |

## Reference docs

- Media priority (historical): `media/docs/PRIORITY.md`
- SFX/BGM inventory: `public/clicker/audio/README-sfx-v2.txt`
- Rebirth motion spec: `media/rebirth/handoff-pack/docs/rebirth-motion-spec.md`
- Architecture: `ARCHITECTURE.md`, `.cursor/skills/clean-architecture/SKILL.md`

## Verification before deploy

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```
