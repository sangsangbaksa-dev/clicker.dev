# Mine / Core Chamber art (Waldomage + Waldo Wave B)

Place stills here. Wired via `MineArt` in `src/data/clicker/mine-assets.ts`.

Layer (bottom → top): chamber BG (stage) + ore → dust → chrome.

- `mine_scene_core_chamber_v1.png` — fullscene chamber BG
- `mine_dust_overlay_v1.png` — sparse dust/motes (screen blend, ~15–25% opacity; skipped under prefers-reduced-motion)
- `mine_ui_chrome_v1.png` — HUD/bezel (edge + bottom slots; center masked open for ore; pointer-events none)

Optional later: `mine_core_hit_v1.png`

## Registered, not wired
- `mine_interior_hitech_mineral_1080p_v1.png` — 1080p chamber + center ore reference (`MineArt.chamberInteriorMineral1080pV1`; keep `chamberBg` on hitech_v1 for seam/hitbox)
