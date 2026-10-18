# Clicker quality registry

Living backlog for design, balance, code, audio, art, and motion. Cron automations pick items from **Now** first; **Done** records what shipped.

Last reviewed: 2026-10-18 (cron)

## Now (actionable)

| Area | Item | Source / notes |
|------|------|----------------|
| Art | Optional full swap of `orePlate` → hitech still (skip crossfade) once door-walk v20 is re-encoded on the hi-tech master | `mine-assets.ts` |
| Design | Rebirth stamp PNGs vs geometric placeholders until final art lands | handoff-pack |
| BGM | Older `bgm_hub_v2` / `bgm_mine_v2` / short `bgm_mine_v3` kept for rollback only | README-sfx |
| Balance | Run `node --experimental-strip-types scripts/pacing-sim.ts` after economy edits | ~95m to REBIRTH 10M @ 6 c/s |
| Code | ESLint warnings (mostly React setState-in-effect); zero errors | `npm run lint` |
| Deploy | Pages asset paths must stay quoted for `prepare-pages.sh` | CI |

## Done (2026-10-18)

| Area | Item |
|------|------|
| Design | Forge next-tier preview glow only when the slot is actually forgeable (matches relic vault) |
| Design | Hunt lair entry button soft pulse when the boss is ready (`is-next`) |
| BGM | Boss loop pre-warm while hunt-region entry HUD is open (before `enterLair`) |
| Design | Golden vein claim → purchase burst (PRODUCTION / FEVER by outcome); field monster slay → HUNT burst + region currency icon |

## Done (2026-10-17 pass 2)

| Area | Item |
|------|------|
| Design | Shop: cheapest buyable potion/skill row soft pulse (`is-next`) |
| Design | Forge + relic vault: affordable slot pulse; relic preview no longer glows when broke |
| BGM | Forge tab pre-warms `bgm_boss_loop_v1` before first lair fight |

## Done (2026-10-17)

| Area | Item |
|------|------|
| BGM | Region lair fights crossfade to `bgm_boss_loop_v1` (overlay `bossFight` includes `lair`) |
| BGM | Transcendence tab pre-warms rebirth intro + HQ loop (`warmClickerRebirthBgm`) |
| Design | Active skill casts → purchase burst by role (FOCUS/FEVER/PRODUCTION) + skill icon |
| Design | Exchange buys → RESONANCE burst + region currency icon; next affordable offer `is-next` pulse |

## Done (2026-10-16 pass 2)

| Area | Item |
|------|------|
| Audio | Lair strikes → `bossHit` / `bossDeath` (aligned with guardian fight samples) |
| BGM | Boss/lair scene pre-warms `bgm_boss_loop_v1` (`warmClickerBossBgm`) |
| Design | Gauge FEVER, drill overdrive, achievements, region activity → purchase bursts |
| Motion | Upgrades + producers: cheapest buyable row soft pulse (`is-next`) |

## Done (2026-10-16)

| Area | Item |
|------|------|
| BGM | Core guardian fight → `bgm_boss_loop_v1` via `resolveBgmScene` (`bossFight`) |
| BGM | Mine enter pre-warms `bgm_mine_loop_v2` alongside session art (`warmClickerMineBgm`) |
| Design | Region field challenge claim → RESONANCE purchase burst + region currency art |
| Design | Crisis choice resolve → FOCUS purchase burst |
| Motion | Skill circuit map: next affordable node soft pulse (`is-next`, reduced-motion safe) |
| Audio | `crisisResolve` prefers `sfx_skill_overdrive_v3.mp3` |

## Done (2026-10-15 pass 2)

| Area | Item |
|------|------|
| Design | Shop potion/active-skill buys + potion use → purchase bursts (UTILITY / FEVER icons); world-tree buys → RESONANCE burst with region currency art |
| Motion | Next world-tree node soft pulse (`is-next`); reduced-motion off only |
| Audio | World travel tab pre-warms region BGM beds (`relay`–`heart`) to cut first-hop decode hitch |

## Done (2026-10-15)

| Area | Item |
|------|------|
| Audio | Lair boss hurt/death + world-tree skills prefer HQ mp3 (`bossHurt`, `bossDeath`, `worldSkill` in `SFX_SAMPLE`) |
| Audio | First gesture warms all mapped one-shots + laser/rebirth HQ paths (reduces first-hit hitch) |
| Design | Relic vault upgrades → TRANSCENDENCE purchase burst + relic icon; exchange → `purchase` SFX + UTILITY burst |

## Done (2026-10-14 pass 2)

| Area | Item |
|------|------|
| Design | Transcendence: warm every worldline stamp; rebirth motion plates preload even when picker is locked |
| Motion | Forge success → HUNT purchase burst with forged gear icon |
| Audio | True ending story beats advance with `nav` UI cue |
| Code | `clicker-audio-assets.test.ts` guards SFX/BGM/rebirth mp3 paths on disk |

## Done (2026-10-14)

| Area | Item |
|------|------|
| Art | Mine enter: priority-decode session plates (ore + hi-tech enhance, dust, chrome, fever lights) during door-walk |
| Motion | Hi-tech chamber crossfade adds brightness/saturation ramp + `will-change` for smoother GPU fade-in |
| Design | Transcendence panel preloads `selectConfirmFlash` so confirm sheet flash paints on first open |

## Done (2026-10-13 pass 2)

| Area | Item |
|------|------|
| Art | Mine session: door-walk landing `orePlate` + 1.1s hi-tech chamber enhance overlay (crystal layer matched) |
| Motion | Plate/crystal crossfade after enter; disabled under `prefers-reduced-motion` |
| Code | `clicker-mine-assets.test.ts` for `MineArt` + ore plate paths |

## Done (2026-10-13)

| Area | Item |
|------|------|
| Design | Transcendence panel: `worldlineSelectBg` backdrop; Wave A cards use chrome/focus/locked sheet quadrants |
| Audio | Worldline confirm opens with `select` → `sfx_worldline_hover_v2.mp3` |
| Code | `clicker-rebirth-assets.test.ts` for select art paths + chrome quadrant map |

## Done (2026-10-12 pass 2)

| Area | Item |
|------|------|
| BGM | Mine session → seamless `bgm_mine_loop_v2.mp3` (was 30s `bgm_mine_v3`) |
| Audio | Hybrid worldline stamp → `sfx_rebirth_stamp_directive_pulse_hq.mp3` |
| Design | Rebirth confirm sheet plays `selectConfirmFlash` overlay (reduced-motion off) |
| Code | `MINE_ORE_PLATE` coords at native 1920×1080; rebirth cue + BGM path tests |

## Done (2026-10-12)

| Area | Item |
|------|------|
| Audio | Manual ore laser uses `sfx_core_hit_heavy_v2`; hub drill / boss / lair keep light; crits + veins use crit sample |
| Design | Mine stage BG → `MineArt.orePlate` so door-walk landing matches session plate |
| Code | `mineLaserHitKind` + laser sample path test |

## Done (2026-10-11 pass 2)

| Area | Item |
|------|------|
| BGM | Hub catalog → `bgm_hub_loop_v2.mp3` (seamless loop) |
| Design | Mine resonance feedback: integrity bar, `--ore-crack` stress, `is-weak` glow (CSS was dormant) |
| Audio | Shatter plays `oreShatter` → `sfx_ore_hold_release_v3`; stat tick keeps `oreBreak` / yield_big |

## Done (2026-10-11)

| Area | Item |
|------|------|
| Design | Restored center-ore **resonance shatter** (24-strike pulse, 650ms regrow, no bonus strikes) so ORES achievements / stats / `oreBreak` SFX work again after durability removal |
| Code | `clicker-mine-ore-pulse` domain helper + unit test |

## Watch (needs asset or design call)

| Area | Item |
|------|------|
| Motion | Region intro BGM in `media/region-intro/` — baked into intro MP4s, not a separate public catalog |

## Done (2026-10-10 pass 2)

| Area | Item |
|------|------|
| Art | Mine session: ambient dust overlay + UI chrome plate + hit dust puffs (`MineArt.dustOverlay`, `uiChrome`) |
| Audio | Mining laser prefers `sfx_core_hit_light_v2` / `sfx_core_crit_v2`; golden vein spawn/claim → hover + purchase mp3 |
| Motion | Hit dust puffs on ore strikes (respects reduced motion) |

## Done (2026-10-10)

| Area | Item |
|------|------|
| Test | `clicker-exchange-week.test.ts`: KST Monday week boundary, stale-week reset, `sanitizeExchange` guard |
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
