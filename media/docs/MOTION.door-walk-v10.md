# Mine Enter — Door Walk v10 (SEAM=658 matchTemplate + 2× quality)

**Pack:** `mine-enter-door-walk-v10-2026-09-24`  
**Date:** 2026-09-24 (KST)  
**Spec:** 200 frames · 20 fps · **10.0 s** · 1280×720 RGB PNG  
**Method:** Self-made PIL/OpenCV compositing only. No Cursor, Runway, or messaging.

## What changed vs v9

- **SEAM=658** from markup→door **cv2.matchTemplate** (crop mapping).
  Markup (825, 566) is a crop (scale≈0.9125,
  origin (x0,y0)=(296,108),
  score≈0.914); orange x=397
  → SEAM = x0 + ox·scale ≈ 658.26.
  **Not 616** (naïve resize was wrong) and **not 640**.
- Earlier/crisper vertical crack on the orange line before wide travel.
- Validation measures **leaf-edge gap center** (mean of left_edge & right_edge),
  not the hex aperture centroid.
- **Quality:** compose at **2× (2560×1440)** then LANCZOS → 1280×720; light unsharp;
  libx264 **crf 12** preset slow; AAC 320k; PNG frames only.

## Kept from v8/v9

1. Interior — continuous mineral plate ~60% scale
2. Static hub shell — rock + cyan frame OUTSIDE hex; never translated/split
3. Door leaves only — hex plate split at SEAM, clipped to hex (through-gap feel)
4. Hex mask: HEX_CX/CY=640/350, HALF_W/H=210/195
5. 10.000s + full-length SFX; no settle/ore swap; f00 MAE=0 vs closed door

## Timeline

| Phase | Frames | Time | Motion |
|---|---:|---:|---|
| Approach | f000–f024 | 1.25 s | Closed door, zoom ~1.00→1.10, slide=0 |
| Crack + leaves part | f026–f090 | 3.25 s | Clear SEAM slit then plate-only travel |
| Cross threshold | f091–f140 | 2.50 s | Leaves hide under frame; aperture + dolly |
| Inside chamber | f141–f199 | 2.95 s | Shell cropped by zoom; full interior |

## Files

- Frames: `frames/mine_enter_door_walk_v10_f000.png` … `f199.png`
- Silent preview: `mine_enter_door_walk_v10_preview.mp4`
- Hi-bitrate preview: `mine_enter_door_walk_v10_preview_hibit.mp4`
- Audio preview: `mine_enter_door_walk_v10_with_sfx.mp4` (SFX v2)
- Debug: `debug_seam_closed_and_mid.png` (orange line at SEAM)
- Incoming-art: `/workspace/clicker-local/incoming-art/mine-enter-door-walk-v10-2026-09-24/`
- Preview mirror: `/tmp/mine-enter-preview/mine_enter_door_walk_v10_with_sfx.mp4`
