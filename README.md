# Trading Cards Skill for OpenClaw & Hermes Agent

A complete virtual trading card ecosystem with pack breaks, collection tracking, secondary markets, grading, stores, scalpers, auctions, corporate parody (Flopps), and multi-player support.

**Works with Hermes Agent and OpenClaw.**

## Quick Start

```bash
# Set up
cd trading-cards-skill
npm install
node scripts/player-manager.js register <your-name>

# Generate a set
node scripts/card-engine.js generate-set

# Open packs
TRADING_CARDS_DATA_DIR=$(node scripts/player-manager.js dir) \
  node scripts/card-engine.js open-pack retail

# Open for real (saves to collection)
TRADING_CARDS_DATA_DIR=$(node scripts/player-manager.js dir) \
  node scripts/card-engine.js open-pack retail --real
```

## Features

- **18 parallel tiers** — Base to 1/1 Superfractors
- **7 card formats** — Standard, Mini, Landscape, Booklet, Die-Cut, Oversized, Acetate
- **5 pack types** — Hobby ($120), Blaster ($50), Retail ($5), Jumbo ($30)
- **Multi-user** — Each player gets wallet, collection, trade history
- **Secondary market** — Dynamic pricing, macro events, market ticks
- **Grading system** — PSA-style grading with pop reports
- **Flopps corporation** — Fake stock price, release calendar, wildcard events
- **Stores & scalpers** — NPC economy with reputation, sales, restocks
- **Auctions & trading** — Player-to-player and NPC trading
- **7 set categories** — Character, Sports, Celebrity, Movie, TV, Collection, Novelty
- **AI set generation** — LLM-powered card names and flavor text
- **Player trading & gifting** — Send cards between players
- **Daily stipends** — Auto-granted per-player with dedup
- **Variant & duplicate detection** — Clear `[x2]`, `✨ New Variant!`, `🌟 New Best Variant!!` badges

## Documentation

Full documentation in `SKILL.md`. Key reference docs in `references/`:

| Document | Covers |
|----------|--------|
| `system-design.md` | Architecture, data flow, component layout |
| `card-economics-research.md` | Pricing models, rarity curves |
| `secondary-market-simulation.md` | Market ticks, macro events |
| `flopps-layer.md` | Corporate parody, blog writing, launch workflow |
| `flopps-business-research.md` | Real-world card business mechanics |
| `scalpers-stores-ecosystem.md` | Store system, scalper AI, reputation |
| `card-grading-research.md` | Grading system, pop reports, gradeflation |
| `card-image-generation-research.md` | Modular card image prompt synthesis |
| `stat-clash-rules.md` / `stat-clash-v2-rules.md` | Card stat clash mini-game |
| `module-architecture.md` | Codebase layout post-refactor |
| `testing-patterns.md` | Smoke test patterns |
| `variant-duplicate-detection.md` | New variant/best variant display system |

## Data

The repo ships seeded data to kickstart a fresh instance:

- `data/sets/` — Pre-generated BOC and WRE sets
- `data/stores/` — Default store configurations
- `data/scalpers/` — Default scalper configurations
- `data/orderbook/` — Market order book
- `data/market-macro.json` — Market macro baseline

Player data (collections, wallets, history) is stored under `TRADING_CARDS_DATA_DIR` and is not included.

## License

MIT
