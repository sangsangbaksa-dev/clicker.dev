# Prompt sheet — particles / fullscreen overlay plates

Paste-ready. Use with `00-shared-base.md` rules. All colors and role names below are **PROVISIONAL — not locked brand**.

## Purpose

Fullscreen particle and overlay plates for the **Collapse → Void → Stamp** handoff. Make the shared plate reusable across all four worldlines; keep the center readable for the stamp glyph and leave outer margins usable for HUD fade/rebuild.

## Canvas / delivery

- **Primary:** 1920×1080 landscape
- Optional alternate: 1080×1920 portrait with the same center-safe composition
- Prefer transparent alpha or an easy-to-key `role_void` background when the image tool supports it
- No readable UI copy, characters, logos, or worldline glyphs in the shared plate

## Palette roles (PROVISIONAL)

- `role_void` ~#05070D — void field / keyable ground
- `role_ui_ink` ~#0B0F1A — sparse overlay plates
- `role_highlight_white` ~#E8F4FF — particle cores and tear edge
- Shared plate: cool white, desaturated cyan-gray, and near-black only; do not mix all four worldline tints

## Composition / behavior reference

- Fullscreen orthographic 2D VFX plate, camera locked
- Sparse shards, dust points, thin streaks, and a soft vignette pull toward a clear central void
- Add a narrow rift / tear suggestion for the Void beat, but avoid a solid opaque center that hides the stamp
- Keep particle density readable on phone and desktop; no muddy fog
- The plate should read as layered overlay art, not a finished game screen

## Per-worldline tint note

For a tinted variant, keep the same geometry and particle density, then use **one** tint family only:

- **Directive Pulse:** cool cyan → electric blue; particles favor vertical lanes and staccato bursts (`role_pulse_primary` / `role_pulse_accent`, PROVISIONAL)
- **AURELIA Grid:** warm gold → amber; particles favor square-grid intersections and lattice traces (`role_grid_primary` / `role_grid_accent`, PROVISIONAL)
- **Resonance Protocol:** magenta → violet; particles favor orbital arcs and phase-aligned ring edges (`role_res_primary` / `role_res_accent`, PROVISIONAL)
- **Volatile Core:** hot orange → crimson; particles use asymmetric jets and flickering spawn points (`role_core_primary` / `role_core_accent`, PROVISIONAL)

Do not treat any approximate hex in the existing worldline sheets as a locked brand value. Do not combine worldline families in one export.

## Filename convention

`rebirth_particles_[worldline|shared]_v1.png`

Examples: `rebirth_particles_shared_v1.png`, `rebirth_particles_directive_pulse_v1.png`.

## Paste prompt — shared plate (copy block)

```
Fullscreen particle and overlay plate for a dark sci-fi clicker game rebirth transition, shared across Collapse to Void to Stamp, sparse neon dust points, clean UI shards, thin inward-sucking streaks, a narrow central void tear, clear center-safe area for a worldline stamp glyph, near-black #05070D void with dark ink #0B0F1A, cool white #E8F4FF and desaturated cyan-gray edge light, orthographic flat 2D game UI VFX, transparent or easy-to-key background, readable high contrast, no readable text, no characters, no logos, no worldline-specific glyph, no muddy fog, 1920x1080
```

## Paste prompt — tinted plate template (copy block)

```
Fullscreen particle and overlay plate for a dark sci-fi clicker game rebirth transition, same shared Collapse to Void to Stamp composition, clear center-safe area for a stamp glyph, sparse particles and thin streaks, near-black void, orthographic flat 2D game UI VFX, use only the [WORLDLINE TINT FAMILY] as a restrained accent, preserve high contrast and readable negative space, no readable text, no characters, no logos, no extra worldline colors, no worldline-specific glyph, 1920x1080
```
