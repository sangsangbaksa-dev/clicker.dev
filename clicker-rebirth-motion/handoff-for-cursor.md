# Handoff — Cursor agent clicker.md.Waldo (bc-5c0f96b1)

From: Waldomage art direction pack (`/workspace/clicker-rebirth-motion/`)  
Target: hsms-md clicker (localhost:8080) — rebirth after worldline select.

## Read first

1. This file
2. `rebirth-motion-spec.md` (timeline, layers, variants, tech notes)
3. `prompt-sheets/` only when wiring real art assets; prompts are for the user’s image tool, not for inventing code assets

## Added

- `prompt-sheets/07-particles-overlay.md` — shared and per-worldline fullscreen particle/overlay plates
- `prompt-sheets/08-ui-chrome-worldline-select.md` — four-card worldline selection chrome
- `prompt-sheets/09-reduced-motion-stills.md` — one stable still keyframe per worldline
- Cursor can use geometric placeholders until the PNGs exist.

## Implement first (order)

1. Hook: worldline select confirm → play rebirth sequence → land on new worldline UI
2. Timeline driver (0–3.5s phases from spec); respect `prefers-reduced-motion`
3. Layers: `overlay_fullscreen` → `ui_fade` → `screen_shake` → placeholder stamp (colored shape OK) → `particles` (minimal)
4. Per-worldline params from variant table (color roles PROVISIONAL, motif switch)
5. Chromatic / motif polish only after 1–4 feel solid
6. Audio cue hooks by placeholder name only (no assets required in this pack)

## Do not

- Invent hex as locked brand; keep PROVISIONAL roles until style guide
- Invent assets beyond this pack (no extra worldlines, no alternate timelines)
- Block on final PNG stamps — use geometric placeholders matching glyph ideas until user pastes generated art

## Acceptance criteria

1. Player picks a worldline → confirms → rebirth motion plays → game settles on that worldline
2. Sequence covers: Select confirm → Collapse → Void/tear → Worldline stamp → Rebuild → Settle (or reduced-motion short path)
3. Each of the four worldlines shows distinct stamp motif / color temperature
4. Flashy but readable on phone and desktop; HUD usable at Settle
5. No dependency on files outside this pack except existing game UI hooks

## Pack root

`/workspace/clicker-rebirth-motion/`
