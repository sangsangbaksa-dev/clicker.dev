# Mine entrance door reframe (seam-centered)

| Asset | Seam x before | Shift left (px) | Seam x after |
|-------|---------------|-----------------|--------------|
| Still (`mine_entrance_hub_closed_door_v2.webp`) | 657 | 17 | 640 |
| Video f000 (`mine_enter_door_walk_v11.mp4`) | (see `before_still`) | 17 | 639 |

Method: panel symmetry error minimization on y=180..620, x=600..719.
Target frame center: **640** (1280×720). Tolerance ±1px.

Previous mistake: shifted 68px toward cyan trim (~708px), placing seam near ~590–600px.

Debug overlays: red = measured seam, green = frame center.

## UI (`background-size: cover`, `background-position: 50% 50%`)

With the seam on the image horizontal midpoint (640/1280), `cover` crops equal amounts from the left/right when the stage is taller than 16∶9, so the seam stays on the viewport horizontal center. The entrance CTA uses `left: 50%` + `translateX(-50%)`, so it shares that axis.

Comparison still (wrong 68px cyan-band shift vs seam shift): `compare_wrong_vs_seam_reframe.jpg`.

Reproduce: `python3 scripts/reframe-mine-entrance-door.py --from-git` (requires Pillow, ffmpeg, git history at `0ca36cd`).
