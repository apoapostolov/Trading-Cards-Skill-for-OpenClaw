# Changelog

## v2.0.0 — 2026-05-09

**Major refactor: Monolith → Modular architecture**

- Split `card-engine.js` (7,536 → 2,100 lines) into 7 lib modules under `scripts/lib/`:
  - `constants.js` (466 lines) — Lookup tables, pack/parallel/grade/emoji data
  - `helpers.js` (598 lines) — File I/O, config/collection loaders, grading math, RNG
  - `pack-engine.js` (177 lines) — Card pulling, parallel rolling, `fmtCard`
  - `market-engine.js` (505 lines) — Secondary market ticks, macro state
  - `flopps-engine.js` (447 lines) — Flopps simulation, stock, bulletins
  - `economy-engine.js` (662 lines) — Stores, scalpers, auctions, marketplace
  - `grading-engine.js` (85 lines) — Grading rarity analysis, gradeflation

**New features:**
- **Variant & duplicate detection** — Pack opening now shows:
  - `[x2]` for true duplicates (same card number + same parallel)
  - `✨ New Variant!` for new parallels of owned cards
  - `🌟 New Best Variant!!` for new variants that beat the existing highest price
  - Summary line: `New: 2 (2 variants) | Dupes: 3`
- **Hermes Agent compatibility** — Full support; runs identically on OpenClaw and Hermes Agent

**Fixes:**
- **Slot-based portfolio display** — Collection count now uses unique card numbers ("slots") with a separate variant count, instead of counting every parallel as a distinct card. Portfolio shows: `125/150 slots (+86 variants)`
- **Real calendar days for Flopps** — Simulation day tracking switched from manual day counter to `Math.floor((Date.now() - createdAt) / 86400000)`, matching real-world elapsed days. Flopps status now shows actual dates: `Sim day: 39 (8 May 2026)`
- Collection file auto-creation on first pack open

## v1.1.1 — 2026-05-06

- Card gifting between players
- Stipend sync fix
- Undo set lookup fix

## v1.1.0 — 2026-05-04

- Multi-user system with player-manager.js
- Player trading system
- Daily stipends with dedup protection
- NPC traders and trade offers

## v1.0.0 — Initial Release

- Single-player trading card system
- Pack opening (retail, hobby, blaster, jumbo)
- 18 parallel tiers
- Flopps corporate simulation
- Procedural and AI set generation
- Set categories (Character, Sports, Celebrity, Movie, TV, Collection, Novelty)
