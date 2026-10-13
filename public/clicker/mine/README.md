# Mine / Core Chamber art (Waldomage + Waldo Wave B)

Place stills here. Wired via `MineArt` in `src/data/clicker/mine-assets.ts`.

Layer (bottom → top): chamber BG (stage) + ore → dust → chrome.

- `mine_scene_core_chamber_v1.png` — fullscene chamber BG
- `mine_core_ore_click_v1.webp` — harvestable ore / core target
- `mine_dust_overlay_v1.png` — sparse dust/motes (screen blend, ~15–25% opacity; skipped under prefers-reduced-motion)
- `mine_ui_chrome_v1.png` — HUD/bezel (edge + bottom slots; center masked open for ore; pointer-events none)

Optional later: `mine_core_hit_v1.png`

## Session plate layering
- `mine_interior_mineral_ore_v2.webp` — door-walk v19 landing frame (`MineArt.orePlate` / `MINE_ORE_PLATE`)
- `mine_interior_hitech_mineral_1080p_v1.webp` — fades in over the landing plate after enter (`MineArt.chamberInteriorMineral1080pV1`; same crystal framing + hitbox)

Wired in session UI: `mine_dust_overlay_v1.png`, `mine_ui_chrome_v1.png` (`MineArt.dustOverlay`, `MineArt.uiChrome` in `ClickerMine`).
