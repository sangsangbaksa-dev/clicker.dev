# USAGE — drop paths & wiring

## Drop path

Copy all `*.wav` into the web app static folder:

```
public/clicker/audio/
```

Example relative URLs:

```
/clicker/audio/sfx_ore_hit.wav
/clicker/audio/bgm_mine_loop.wav
/clicker/audio/bgm_loading_loop.wav
```

Keep this pack’s filenames unchanged so MANIFEST event names stay stable.

Local symlink for handoff: `clicker-local/incoming-audio/` → `/workspace/clicker-artifacts/audio/`.

## Load pattern (suggestion)

- Preload SFX on hub enter (short files).
- Play `bgm_loading_loop.wav` during boot / asset load; crossfade to hub BGM when ready.
- Stream/lazy-load BGM when entering hub or mine.
- Cap concurrent one-shots (e.g. max 4–6) so click spam stays readable on phone speakers.
- BGM gain ~0.35–0.5; SFX gain ~0.7–1.0 (pack already peaks BGM quieter; loading is quieter still).

## Event → file (quick wire)

| Trigger | Play |
|---------|------|
| Loading / splash / asset wait | loop `bgm_loading_loop.wav` |
| UI any tap | `sfx_ui_tap.wav` |
| Purchase / upgrade OK | `sfx_ui_purchase.wav` |
| Can't buy / locked | `sfx_ui_deny.wav` |
| Core click (press) | `mine_ore_hit.wav` or `sfx_ore_hit.wav` + optional `sfx_dust_yield_tick.wav` |
| Core hold (while held) | loop `sfx_ore_hold_loop.wav` |
| Enter mine session | First-wire: `mine_enter_stinger.wav` (or `sfx_enter_mine.wav`) ; start `bgm_mine_loop.wav` or `mine_ambience_loop.wav` ; stop hub BGM |
| Exit / timeout mine | First-wire: `mine_session_end.wav` (or `sfx_exit_mine.wav` / `sfx_session_timer_end.wav`) ; stop mine BGM/ambience ; resume `bgm_hub_loop.wav` |
| Timer ≤ warn threshold | `sfx_session_timer_warn.wav` (once per warn window) |
| Timer = 0 | `sfx_session_timer_end.wav` |
| Potion / fever on | `sfx_potion_fever.wav` |
| Transcend UI open | `sfx_transcend_open.wav` |
| Worldline row select | `sfx_worldline_select.wav` |
| Rebirth confirm | `sfx_rebirth_confirm_click.wav` then sequence (see MANIFEST) |
| Hub ambient | loop `bgm_hub_loop.wav` |
| Rebirth cinematic | one-shot `bgm_rebirth_stinger.wav` under collapse→settle |


## First-wire (Waldo the First) — preferred enter-mine wire

Use these **exact filenames** when wiring entrance gate → motion → interior (see patch `20260922-2236-first-mine-entrance-motion-sfx`). They are First-wire names, not docs-only aliases — files exist beside the pack `sfx_*` set.

| Trigger | Play (First-wire) | Pack equivalent |
|---------|-------------------|-----------------|
| Enter Mine + enter motion | `mine_enter_stinger.wav` | `sfx_enter_mine.wav` |
| Ore tap / hit | `mine_ore_hit.wav` | `sfx_ore_hit.wav` |
| Timer expire / Exit Mine | `mine_session_end.wav` | `sfx_exit_mine.wav` +/or `sfx_session_timer_end.wav` |
| Chamber ambience (optional) | loop `mine_ambience_loop.wav` | quieter bed vs `bgm_mine_loop.wav` |

Suggested sequence: pre-enter shows entrance art → on Enter Mine play motion + `mine_enter_stinger` → swap to interior; start `mine_ambience_loop` or `bgm_mine_loop`; ore hits use `mine_ore_hit`; exit/timeout play `mine_session_end`.

### Stamp variant select

| Worldline key (example) | File |
|-------------------------|------|
| `directive_pulse` | `sfx_rebirth_stamp_directive_pulse.wav` |
| `aurelia_grid` | `sfx_rebirth_stamp_aurelia_grid.wav` |
| `resonance_protocol` | `sfx_rebirth_stamp_resonance_protocol.wav` |
| `volatile_core` | `sfx_rebirth_stamp_volatile_core.wav` |

## Phone notes

- Prefer mono (this pack is mono).
- Avoid stacking hit + tick + hold at full gain; duck tick ~−3 to −6 dB under hit.
- Timer warn should not retrigger every frame — gate to once when crossing threshold.
- BGM v2 uses soft edge fades (~0.5s) plus loop crossfade — gapless loop is OK with `loop=true` from sample 0.

## License note

All assets in this folder are original procedural synthesis for the hsms-md / Aurelia clicker project. No third-party samples. BGM polish v2 = layered pads + filtered noise beds + sparse pulses (still fully original).
