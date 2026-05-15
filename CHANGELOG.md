# Changelog

## v2.3.0 — 2026-05-15

**Pack openings are now real by default**

### Changed
- **Pack opening default flipped**: `open-pack` and `open-box` are now **real** by
  default (commit to collection, spend wallet, advance market). Dry-run is opt-in.
- Use `--dry-run`, `--dry`, or `--virtual` to simulate without saving cards or
  spending money (mainly for development/testing).
- Updated `isReal()` logic and all help text / SKILL.md documentation to reflect
  the new default.

### Migration
- Old behavior: you had to pass `--real` to commit.
- New behavior: packs are real unless you explicitly ask for dry-run.

## v2.2.0 — 2026-05-15

**`help` command for new users + enhanced `wallet` with per-set breakdown**

### Added
- **`help` command** — teaches new players the Flopps trading card premise, economics
  (daily stipend, market ticks, FLPS stock, scalpers/stores), and the most common
  actions (open packs, sell/buy, grade, trade, auction, stores, lots, Flopps world)
- **`help` command is player-free** — runs without a player context, accessible to
  anyone
- **SKILL.md guidance** — new "When the Player Is Confused — Recommend help"
  section tells agents to stop guessing and run `help` when a user is lost

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
