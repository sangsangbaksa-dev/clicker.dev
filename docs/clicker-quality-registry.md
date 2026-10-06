# Clicker quality registry

Living backlog for design, balance, code, audio, art, and motion. Cron automations pick items from **Now** first; **Done** records what shipped.

Last reviewed: 2026-10-06

## Now (actionable)

| Area | Item | Source / notes |
|------|------|----------------|
| Audio | `sfx_rebirth_collapse_whoosh` — no dedicated mp3; motion still uses synth whoosh | `public/clicker/audio/README-sfx-v2.txt` |
| Audio | `sfx_boss_phase_change_v1` — mapped, no boss HP phases in engine | README-sfx |
| Art | `mine_interior_hitech_mineral_1080p_v1.png` registered, not wired as chamber BG | `public/clicker/mine/README.md`, `mine-assets.ts` |
| Motion | Rebirth particle tint overlays (Resonance / Volatile Core) — optional polish | `media/docs/PRIORITY.md` bonus |
| Balance | Run `node --experimental-strip-types scripts/pacing-sim.ts` after economy edits | `scripts/pacing-sim.ts` |
| Code | 71 ESLint warnings (mostly React setState-in-effect); zero errors | `npm run lint` |

## Watch (needs asset or design call)

| Area | Item |
|------|------|
| Design | Rebirth stamp PNGs vs geometric placeholders until final art lands |
| BGM | Older `bgm_hub_v2` / `bgm_mine_v2` kept for rollback; catalog prefers v2 loops + mine v3 |
| Deploy | Pages asset paths must stay quoted for `prepare-pages.sh` |

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
