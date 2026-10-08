# Clicker quality registry

Living backlog for design, balance, code, audio, art, and motion. Cron automations pick items from **Now** first; **Done** records what shipped.

Last reviewed: 2026-10-08 (cron pass)

## Now (actionable)

| Area | Item | Source / notes |
|------|------|----------------|
| Art | `mine_interior_hitech_mineral_1080p_v1.png` registered, not wired as chamber BG (layout ≠ ore plate / door-walk seam) | `public/clicker/mine/README.md` |
| Balance | Run `node --experimental-strip-types scripts/pacing-sim.ts` after economy edits | `scripts/pacing-sim.ts` |
| Code | ~69 ESLint warnings (mostly React setState-in-effect); zero errors | `npm run lint` |

## Watch (needs asset or design call)

| Area | Item |
|------|------|
| Design | Rebirth stamp PNGs vs geometric placeholders until final art lands |
| BGM | Older `bgm_hub_v2` / `bgm_mine_v2` kept for rollback; catalog prefers v2 loops + mine v3 |
| Deploy | Pages asset paths must stay quoted for `prepare-pages.sh` |
| Motion | Rebirth plate crossfade timing vs cut flash — tune if seams read on low-end phones |

## Done (2026-10-08)

| Area | Item |
|------|------|
| Motion | Rebirth phase plates A/B opacity crossfade (`PlateStack` outgoing + `rb-plate-in/out`) |
| Motion | Resonance / Volatile stamp+rebuild runtime tint overlays (`data-transcendence-id` + CSS pulse) |
| Balance | Pacing sim baseline re-run (clicks/s=6, REBIRTH 10M ~95m) — no economy edits |

## Done (2026-10-07)

| Area | Item |
|------|------|
| Audio | Boss fight one-shots: appear (`bossRoar`), hit (`bossHit` on strike), phase change, defeat — mp3 preferred via `SFX_SAMPLE`, synth fallback |
| Audio | `bossPhase` synth cue fires once when a guardian drops under 30% HP (enrage) |
| Audio | `sfx_rebirth_collapse_whoosh_v3.mp3` generated + mapped in `playRebirthCue` |
| Code | `backfillClassN` runs on `findUserById` when `classN` missing (fixes unused helper lint) |
| Balance | Pacing sim baseline recorded (clicks/s=6, REBIRTH 10M ~95m) — no economy edits this run |

## Done (2026-10-06)

| Area | Item |
|------|------|
| Audio | Rebirth ceremony cues prefer HQ/v3 mp3 (confirm, void tear, rebuild, settle, stamps) via `playRebirthCue` |
| Code | Removed unused destructuring in `room-repository.ts` load path |

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
