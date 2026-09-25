# Mine Enter — Door Walk v11 (final polish · SEAM=658)

**Pack:** `mine-enter-door-walk-v11-2026-09-24`  
**Date:** 2026-09-24 (KST)  
**Spec:** 200 frames · 20 fps · **10.0 s** · 1280×720 RGB PNG  
**Method:** Self-made PIL/OpenCV compositing only. No Cursor, Runway, or messaging.

## ASSETS (locked)

- **Hub poster / start key:** closed door `mine_entrance_hub_closed_door_v1.png` (= door-walk **f000**). Elden-smooth fog f00 discarded — do not use.
- **Door-walk settle interior:** `mine_interior_hitech_v1.png` + center `mine_interior_mineral_ore_v2.png` @ ORE_SCALE=0.48 soft composite → `mine_interior_settle_hitech_ore_v1.png` (continuous; no energy orb; no end settle swap).
- **SEAM:** 658 (user orange line via matchTemplate; NOT 616/640).
- **SFX:** Waldusic v3 `mine_enter_10s.wav` remuxed fresh.

## What polished vs v10

- **Dolly easing:** ease-in at ~2s start + strong ease-out 8–10s (no linear push / hard stop ~9s); late zoom ~3.05.
- **Leaf easing:** slow crack → faster mid → gentle decelerate under frame (smootherstep); softer crack start.
- **Ore scale:** INTERIOR_SCALE **0.48** (was 0.60) — hitech_v1 + mineral_ore_v2 center @ ORE_SCALE; continuous; no settle/swap.
- **AA:** soft hex distance feather + LINEAR leaf-mask warp; FEATHER=6.0.
- **Parallax:** light interior lag (×0.92) under zoom.
- **SFX sync:** crack start f22 (~1.10s) near Waldusic v3 foley onset ~1.12s; SFX file unchanged.
- **Fog:** aperture-only, same strength as v10 (review OK).
- **Locked:** SEAM=658 (NOT 616/640); shell unsplit; f00 MAE=0; 10.000s; 2×→LANCZOS; crf 12.

## SEAM derivation

- **SEAM=658** from markup→door **cv2.matchTemplate** (crop mapping).
  Markup (825, 566) crop (scale≈0.9125,
  origin (x0,y0)=(296,108),
  score≈0.914); orange x=397
  → SEAM = x0 + ox·scale ≈ 658.26.

## Timeline

| Phase | Frames | Time | Motion |
|---|---:|---:|---|
| Approach | f000–f021 | 1.10 s | Closed door, ease-in zoom |
| Crack + leaves part | f022–f090 | — | Soft SEAM slit then smootherstep travel |
| Cross threshold | f091–f138 | — | Leaves hide under frame; dolly through |
| Inside chamber | f139–f199 | — | Strong ease-out zoom; full interior |

## Files

- Frames: `frames/mine_enter_door_walk_v11_f000.png` … `f199.png`
- Silent preview: `mine_enter_door_walk_v11_preview.mp4`
- Hi-bitrate preview: `mine_enter_door_walk_v11_preview_hibit.mp4`
- Audio preview: `mine_enter_door_walk_v11_with_sfx.mp4` (Waldusic v3)
- Debug: `debug_seam_closed_and_mid.png` (orange line at SEAM)
- Incoming-art: `/workspace/clicker-local/incoming-art/mine-enter-door-walk-v11-2026-09-24/`
- Preview mirror: `/tmp/mine-enter-preview/mine_enter_door_walk_v11_with_sfx.mp4`
