# Changelog

## v2.2.0 — 2026-05-15

**`help` command for new users + enhanced `wallet` with per-set breakdown**

### Added
- **`help` command** — teaches new players the Flopps trading card premise, economics
  (daily stipend, market ticks, FLPS stock, scalpers/stores), and the most common
  actions (open packs, sell/buy, grade, trade, auction, stores, lots, Flopps world)
- **`help` command is player-free** — runs without a player context, accessible to
  anyone

### Changed
- **`wallet` now shows ALL collections** — cash, total collection value across every
  set, sealed stock, net worth, and P/L. No longer scoped to the active set only.
- **Per-set breakdown table** — when you have cards in multiple sets, wallet shows
  a `COLLECTION BY SET` section with each set's card count, total value, and P/L
- Collection count label now says `X cards across Y sets` instead of just a
  single-set count
- P/L shows signed value (`+$X.XX` or `-$X.XX`) for the total portfolio

### Fixed
- Wallet now skips corrupt collection files (missing `setKey`) instead of crashing

## v2.1.0 — 2026-05-15

**AI set generator overhaul + NEW CARDS REVEAL flavor text**

### Added
- **NEW CARDS REVEAL section** in pack/box opening — shows italic flavor text (`desc` field)
  for new cards only (skips duplicates), gated by `showFlavorText` flag on the set
  - `pack-engine.js`: `desc` field now passed through from base card to pulled card
  - `card-engine.js`: post-summary `📜 NEW CARDS REVEAL` table in both `cmdOpenPack`
    and `cmdOpenBox`
- **`showFlavorText` set config flag** — auto-enabled for all AI-generated sets,
  optional for procedural sets; MHP-2026 enabled
- **Incremental save after each batch** in `ai-set-generator.js` — set written to disk
  after every batch, so partial data survives timeouts
- **Stdout progress markers** (`[PROGRESS]`) during AI set generation for agent visibility

### Changed
- **Default AI model** → `google/gemini-3.1-flash-lite` (fast, reliable on OpenRouter)
- **BATCH_SIZE** reduced from 50 → 20 (each batch completes in ~15s instead of 30-65s)

### Fixed
- AI set generation no longer loses all progress on timeout — partial cards are saved
  incrementally

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
