# Changelog

All notable changes to this repository are documented here.

## [1.1.1] - 2026-04-16

### Added
- **Card gifting** — `player-manager gift <from> <to> <card#>` transfers a card between players. If the sender has duplicates, gifts the cheapest copy (keeps the best one).

### Fixed
- **Stipend wallet sync** — daily stipend now writes to both `config.json` and all collection files, preventing the card-engine from clobbering the stipend with stale wallet values.
- **Undo set lookup** — undo function now prefix-matches set files (e.g. `BOC` → `BOC-2026.json`), fixing a bug where history entries with short set codes failed to resolve.
- **Gift card lookup** — fixed card matching to use `cardNum` (string) instead of `number`.

### Changed
- Cron job (`daily-pocket-money`) uses `stipend all` instead of raw `add-money` for built-in dedup.

## [1.1.0] - 2026-04-12

### Added

- **Multi-user system** — players have independent wallets, collections, and trade history
- **`player-manager.js`** — register players, switch active player, manage daily $5 stipend
- **Daily stipend** — every registered player auto-receives $5/day, tracked per-player by date (no double payments)
- **Player trading** — offer trades, accept/reject, browse other collections
- **Auto-registration** — Discord/Telegram users in #trading-cards are registered automatically
- **`flopps-wildcard`** — force a surprise Flopps event

### Changed

- **Set name lookup** — set codes with date suffixes (e.g. `BOC-2026-04-09`) now resolve correctly to their base set
- `card-engine.js` now uses `TRADING_CARDS_DATA_DIR` env var for player-scoped data

## [1.0.0] - 2026-04-08

### Added

- Public mirror of the OpenClaw `trading-cards` skill
- Runtime scripts for set generation, prompt synthesis, pack opening, and Flopps simulation
- Reference files and seed data used by the skill
- Public README with installation and capability overview
- MIT license
