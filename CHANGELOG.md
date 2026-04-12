# Changelog

All notable changes to this repository are documented here.

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
