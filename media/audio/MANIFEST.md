# MANIFEST — file → game event

Maps each asset to the intended clicker game event. Filenames have no lore spoilers.

**Pack version:** v2.2 — Added cyan core/skill impact SFX; BGM loops verified.
**SFX polish v2:** Targeted UI, reward, timer, rebirth, transcend, worldline, and hold-loop SFX refreshed; mine-enter/ore/session/ambience/BGM unchanged.

| File | Game event | Notes |
|------|------------|-------|
| `sfx_ui_tap.wav` | Generic UI button / tab press | Short; spam-safe |
| `sfx_ui_purchase.wav` | Shop buy / upgrade confirm / confirm dialog Yes | Distinct from tap |
| `sfx_ui_deny.wav` | Insufficient currency / locked / invalid action | Downward / blocked feel |
| `sfx_ore_hit.wav` | Single ore/core click harvest | Crystal + soft thud; polished v2.1 spam-safe; First-wire alias `mine_ore_hit.wav` |
| `sfx_ore_hold_loop.wav` | While finger/mouse held on core (loop) | Loop from 0; stop on release |
| `sfx_dust_yield_tick.wav` | Small DUST / CORE counter increment | Can layer lightly with hit |
| `sfx_ore_hold_start.wav`, `sfx_ore_hold_release.wav`, `sfx_core_hit_light.wav`, `sfx_yield_big.wav` | Hold start/release, lighter core hit, and large CORE yield | Short mono SFX; ~0.20s / ~0.25s / ~0.10s / ~0.40s; peak −3 dBFS |
| `sfx_enter_mine.wav` | Transition hub → timed mine session start | Play once on enter; polished v2.1 whoosh+tech (~1.15s); First-wire alias `mine_enter_stinger.wav` |
| `sfx_exit_mine.wav` | Mine leave / session timeout → hub | Play once on exit; polished resolve; First-wire `mine_session_end.wav` for end-of-session |
| `sfx_session_timer_warn.wav` | Mine timer low (e.g. ≤10s) | Soft double beep; not jump-scare |
| `sfx_session_timer_end.wav` | Mine timer hits 0 | Lower resolve tone (not alarm); related to `mine_session_end.wav` |
| `sfx_potion_fever.wav` | Potion use / fever mode activate | Rising energy swirl |
| `sfx_rebirth_confirm_click.wav` | User confirms rebirth | Pre-sequence click |
| `sfx_rebirth_collapse_whoosh.wav` | Rebirth phase: collapse start | Void whoosh |
| `sfx_rebirth_void_tear.wav` | Rebirth phase: void tear beat | After/with collapse |
| `sfx_rebirth_stamp_directive_pulse.wav` | Worldline stamp — Directive Pulse | Cyan timbre |
| `sfx_rebirth_stamp_aurelia_grid.wav` | Worldline stamp — Aurelia Grid | Gold timbre |
| `sfx_rebirth_stamp_resonance_protocol.wav` | Worldline stamp — Resonance Protocol | Magenta timbre |
| `sfx_rebirth_stamp_volatile_core.wav` | Worldline stamp — Volatile Core | Orange / unstable |
| `sfx_rebirth_rebuild_rise.wav` | Rebirth phase: rebuild | Rising settle |
| `sfx_rebirth_settle_chime.wav` | Rebirth phase: settle complete | Soft cyan chime |
| `sfx_transcend_open.wav` | Open transcend / meta layer UI | Portal-open |
| `sfx_worldline_select.wav` | Select a worldline in hub/select | Mid confirm |
| `bgm_loading_loop.wav` | App / asset loading screen | Soft neon idle; loop; quieter (−9 dBFS) |
| `bgm_hub_loop.wav` | Hub / world select BGM | Loop; duck under SFX; polish v2 |
| `bgm_mine_loop.wav` | Inside mine chamber BGM | Loop; deeper pulse + light grit |
| `bgm_rebirth_stinger.wav` | Rebirth cinematic bed | One-shot ~10.5s under sequence |


## First-wire names (Waldo the First)

These are **First-wire filenames** for enter-mine motion/SFX wiring. Prefer them when wiring the entrance→interior gate. Pack `sfx_*` equivalents remain valid.

| File | Game event | Notes |
|------|------------|-------|
| `mine_enter_stinger.wav` | Enter Mine / entrance→interior motion | Play with enter motion; whoosh+tech cyan; stronger than soft UI whoosh |
| `mine_ore_hit.wav` | Ore/core tap (and hold hit accent) | Crystal+thud; spam-safe on phone |
| `mine_session_end.wav` | Timer expire / Exit Mine | Resolve/wind-down; not alarming |
| `mine_ambience_loop.wav` | Optional chamber bed under harvest | Soft ~−11 dBFS; loop; duck under SFX; can layer under or instead of quieter BGM |

**Alias map:** `mine_enter_stinger` ↔ `sfx_enter_mine` · `mine_ore_hit` ↔ `sfx_ore_hit` · `mine_session_end` ↔ (`sfx_exit_mine` / `sfx_session_timer_end` family).

## Suggested rebirth timeline (relative)

```
t≈0.0  sfx_rebirth_confirm_click
t≈0.2  bgm_rebirth_stinger start + sfx_rebirth_collapse_whoosh
t≈0.8  sfx_rebirth_void_tear
t≈2.5  sfx_rebirth_stamp_<variant>   (chosen worldline)
t≈3.5  sfx_rebirth_rebuild_rise
t≈5.0  sfx_rebirth_settle_chime
```

Adjust to match actual animation keys; keep stamp variant tied to selected worldline id.
| `sfx_hub_nav.wav`, `sfx_producer_buy.wav`, `sfx_upgrade_level.wav`, `sfx_mine_timeout_warn_soft.wav` | Hub navigation, producer purchase, level-up, softer mine timeout warning | 0.10s / 0.20s / 0.35s / 0.40s; mono 44.1kHz 16-bit; peak −3 dBFS |
| `sfx_rebirth_open.wav`, `sfx_rebirth_cancel.wav`, `sfx_worldline_hover.wav`, `sfx_confirm_focus.wav` | Rebirth open, rebirth cancel, worldline hover, and confirm-focus UI cues | 0.50s / 0.25s / 0.12s / 0.20s; mono 44.1kHz 16-bit; peak −3 dBFS |

## Pack v3 (generate_audio_v3.py)

Game uses MP3 copies under `public/clicker/audio/` (`python3 generate_audio_v3.py --publish`); wiring lives in `src/components/clicker/clicker-sfx.ts` and `src/hooks/use-clicker.ts`.

| File | Game event | Notes |
|------|------------|-------|
| `sfx_skill_activate.wav` | Active skill cast / drill overdrive | Charge zip + cyan burst, ~0.45s |
| `sfx_achievement.wav` | Achievement unlocked | Rising glass arpeggio, ~1.1s |
| `sfx_crisis_alert.wav` | Core enters crisis | Low dissonant pulses + siren, ~0.9s |
| `sfx_crisis_resolve.wav` | Crisis choice resolved | Hiss release into stable fifth, ~0.8s |
| `sfx_region_travel.wav` | Region travel / return home | Doppler whoosh + arrival thump, ~0.75s |
| `sfx_rebirth_stamp_adaptive_architect.wav` | Worldline stamp — Adaptive Architect | Emerald chord, root A#4 |
