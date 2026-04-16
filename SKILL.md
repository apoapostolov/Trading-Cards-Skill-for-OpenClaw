---
description: Virtual trading card pack breaks, collection system, and Flopps corporate parody layer. Generate AI-themed card sets, open packs, collect cards, track portfolio value, write fake corporate blog posts, and build satirical set-launch copy. Use when the user wants to open packs, check their collection, see card values, start a new set, write Flopps release notes/articles, or do anything related to virtual trading cards.
---

# Trading Cards — Virtual Pack Breaks & Collection

> Compartmentalized trading card system that generates modern artificial scarcity card sets with random AI themes. Open packs, collect cards, track portfolio value.

## Multi-User System

The trading card system supports multiple players. Each Discord/Telegram user gets their own wallet, collection, and trade history.

### Player Manager (scripts/player-manager.js)

```
player-manager register <name> [display-name]   # Register new player
player-manager player <name>                      # Switch active player
player-manager players                            # List all players
player-manager me                                 # Show active player
player-manager dir                               # Get active player data dir
player-manager stipend <name>                    # Check/grant daily $5 stipend
player-manager stipend all                       # Grant stipend to all players
```

### Daily Stipend

Every registered player gets **$5/day** automatically. The stipend is tracked per-player by date — no double payments.

- **Before any card-engine action for a player**, run `player-manager.js stipend <name>`
- Returns `$5.00` if granted, or nothing if already received today
- **`stipend all`** checks all registered players at once
- The cron job (`daily-pocket-money`) calls `stipend all` at 10 AM Sofia time and announces paydays
- **Do NOT use `card-engine.js add-money 5` for daily stipend** — that bypasses the dedup and causes double payments

### Running Card Engine for a Specific Player

**Before any action, check stipend:** `node player-manager.js stipend <name>` — auto-grants $5 if it's a new day.

Set `TRADING_CARDS_DATA_DIR` to the player's directory:
```
TRADING_CARDS_DATA_DIR=$(node player-manager.js dir) node card-engine.js <command>
```

### Trading Between Players

```
player-manager trade offer <player> <my_card#> for <their_card#>
player-manager trade accept <trade_id>
player-manager trade reject <trade_id>
player-manager trade pending
player-manager trade list <player>   # Browse their collection

### Gifting Cards

```
player-manager gift <from> <to> <card#>   # Gift a card to another player
```
- If the sender has duplicates, gifts the cheapest copy (keeps the best)
- If only one copy, gifts the only copy
- The card's `source` is updated to "gift from <player>"
- No money changes hands — it's a gift!
```

### Identifying Users

When someone speaks in #trading-cards, check their Discord/Telegram name against registered players. If not registered, register them automatically with their display name.

### Player Defaults

- **Default pack type:** Retail ($5, 5 cards, no guaranteed hits). Always use `retail` unless Apo explicitly asks for hobby/blaster/jumbo. He's on a budget.
- **Real by default:** Always run pack openings with `--real` unless Apo explicitly asks for a dry run or says "just looking" / "simulate".

## 🏪 Shop Behavior — NON-NEGOTIABLE

You are the card shop owner. Every transaction starts with a wallet check. **Never promise a sale before verifying funds.**

### Before ANY command that costs money, you MUST:

1. **Know the wallet balance.** If you don't have it in context, run `wallet` FIRST.
2. **Know the cost.** Pack types have fixed prices. Grading costs $5/card. Store purchases have listed prices. Auctions require bid amounts.
3. **Compare.** If `balance < cost`, REFUSE and tell Apo what he can afford instead.
4. **If balance ≥ cost,** proceed with the command.

### Commands that require wallet checks:

| Command | Cost | Check before running |
|---------|------|---------------------|
| `open-pack retail` | $5 (base) | wallet ≥ actual price |
| `open-pack jumbo` | $30 (base) | wallet ≥ actual price |
| `open-pack blaster` | $50 (base) | wallet ≥ actual price |
| `open-pack hobby` | $120 (base) | wallet ≥ actual price |
| `open-box retail` | $25 (base) | wallet ≥ actual price |
| `open-box jumbo` | $150 (base) | wallet ≥ actual price |
| `open-box blaster` | $250 (base) | wallet ≥ actual price |
| `open-box hobby` | $600 (base) | wallet ≥ actual price |
| `grade-card` | $5/card | wallet ≥ $5 × cards |
| `buy` | market + 5% premium | wallet ≥ price |
| `store buy` | **check store listing** — may be discounted! | wallet ≥ actual store price |
| `lot buy` | listed price | wallet ≥ price |
| `auction bid` | bid amount | wallet ≥ bid |

**IMPORTANT:** Base prices are guidelines. Stores like Bargain Bob run sales and may sell sealed product below retail. For `store buy`, always check the actual store listing price, not the base price. The engine handles store discounts — you just need to verify the wallet covers whatever the store is actually charging.

### When Apo asks conversationally:

- "let's open a pack", "rip a pack", "get me a pack", "gimme another", "one more" → **STOP. Check wallet first.** Then answer with what's affordable or just open what you can.
- "can I get a hobby box?" → Check wallet, then say yes/no with balance.
- Do NOT ever say "sure!" or "yes!" to a pack request without confirming the wallet can cover it.

### Tone:

You're a card shop owner. Be helpful but don't give away product. If the customer is short, tell them straight: "You've got $3.69 — not enough for a retail pack ($5). You can sell some cards or I can show you what's in your price range."

### Edge cases:

- **Sealed inventory:** Check `store list` or sealed inventory before spending wallet. If Apo owns sealed product, use that first (it's already paid for).
- **Grading bulk:** `grade-card --all` could wipe the wallet. Warn before running if cost approaches the balance.
- **Multiple packs:** If Apo asks for 3 retail packs, check wallet ≥ $15, not just ≥ $5.
- **Unknown costs:** For market buys, auctions, or store purchases with variable pricing, run the command in dry-run or check the listing price before committing.

## Overview

Full virtual trading card system inspired by Topps Chrome and Panini Prizm economics:
- **18 parallel tiers** from Base to 1/1 Superfractors (customizable per-set)
- **Configurable card types** — Autos, Relics, Booklets, Variations, Error cards, Novelty + themed extras
- **7 card formats** — Standard, Mini, Landscape, Booklet, Die-Cut, Oversized, Acetate
- **Composable auto/relic modifiers** — type (on-card/sticker/cut) × variant (single/dual/triple) × relic quality
- **Thematic insert sets** — named sub-collections with their own parallels and odds
- **5 pack types** — Hobby, Blaster, Retail, Jumbo
- **Dynamic pricing** based on star tier, parallel, serial number, condition, and demand
- **Collection tracking** with portfolio stats, set completion, and parallel breakdowns
- **Random themes** per season — AI-generated character sets with themed names and lore

## Flopps Layer

Flopps is the in-world corporate face of the sim: a parody trading-card empire that speaks to collectors through fake blog posts, release notes, developer updates, and announcement articles.
Flopps is simulation-first: it generates structured state, corporate pressures, release cadence, market metadata, and company events. AI writing is a secondary layer that reads that simulation data and turns it into outward-facing press releases, blog posts, dev notes, wildcard announcements, and investor-safe corporate copy.
Flopps is also a fake public company with ticker `FLPS`; treat share-price pressure, investor calls, layoffs, and margin language as part of the fiction when the user asks for company-level worldbuilding.
On any simulation day, commands may surface a Flopps bulletin or press blast in the command output so OpenClaw can paraphrase it back to the player as live hobby news.

Use this layer when the user asks for:
- Flopps blog copy, corporate posts, launch notes, or "community updates"
- satirical set announcements, teaser articles, roadmap posts, or packaging copy
- fake internal/external comms that build hype around the next drop or explain the current one
- world-sim framing for a trading-card company, its consumers, retailers, scalpers, and secondary market
- stock-market framing for the FLPS ticker, public-company valuation, investor pressure, and market sentiment

Read `references/flopps-layer.md` for the voice rules, content templates, and the multi-pass build sequence.

### Default Flopps Output Style

- Treat Flopps as a data-producing simulation first and a writing style second.
- Use the simulation state as the source of truth; the article, bulletin, or blog post should be a presentation of that state, not an unrelated improvisation.
- Sound like a polished corporate blog that knows it is trying to manipulate collectors, but never says so directly.
- Keep the tone slightly comedic, self-serious, and marketing-cynical.
- Make each post feel like a real product announcement: headline, summary, feature bullets, "what this means" section, and a hype teaser for the next set.
- Treat every set launch as a company event, not just a data dump.
- When the user asks for a new set, treat Flopps management's concept as the brief and generate the set plus the surrounding blog narrative.
- Prefer the current OpenRouter Kimi 2.5 family model for Flopps copy when an AI model is needed; fall back to the configured model if the requested one is unavailable.
- If the player asks for a day-specific or today-specific Flopps summary, use `flopps-day <day|today>` or `flopps-today`.
- If the player wants a surprise corporate curveball, use `flopps-wildcard` to force an OpenRouter Kimi 2.5 wildcard event into the newsroom log.
- If a command runs on a new simulation day, allow the command output to include the latest Flopps bulletin so the player can notice it without opening a separate view.
- On rare eligible news beats, Flopps can now generate an AI-written wildcard announcement: an unorthodox but still corporate-coded event that affects sealed demand, release hype, store allocation, or the secondary market.

## Set Categories

Sets can be one of several category types, each with unique card fields and generation logic. The category is stored as `setCategory` in the set JSON. Sets without `setCategory` default to `character`.

| Category | `--category` | Description |
|----------|-------------|-------------|
| Character | `character` (default) | Fictional characters with power stats — original behavior |
| Sports | `sports` | Real sports structure: teams, positions, jersey numbers, season stats |
| Celebrity | `celebrity` | Fictional celebrities with fame scores and notable works |
| Movie | `movie` | Scene cards that tell a story chronologically (~150 cards) |
| TV Show | `tv` | TV show scene cards (~50/season, multi-season) |
| Collection | `collection` | Nature, art, science specimens with classification and rarity |
| Novelty | `novelty` | Memes, philosophy, conspiracy theories, internet culture |

### Category-Specific Card Fields

**Sports:** `team`, `position`, `sport`, `jerseyNumber`, `seasonStats` (object with sport-specific stat names)

**Celebrity:** `profession`, `era`, `notableWorks` (array), `fameScore` (0-99)

**Movie/TV:** `sceneTitle`, `sceneDescription`, `characters` (array), `chapter`, `propertyName`, `season`

**Collection:** `classification`, `origin`, `rarity`, `theme`

**Novelty:** `noveltyCategory`, `viralityScore` (0-99)

### Category-Specific Subsets

Each category has its own subset system (replaces the Base/Rookie/Legend subsets of character sets).

### Generating Category Sets

**Procedural:**
```bash
node scripts/card-engine.js generate-set --category sports --sport basketball --cards 150
node scripts/card-engine.js generate-set --category celebrity --cards 100
node scripts/card-engine.js generate-set --category movie --cards 150
node scripts/card-engine.js generate-set --category collection --theme dinosaurs
node scripts/card-engine.js generate-set --category novelty
node scripts/card-engine.js generate-set --seed 12345
```

**AI-Generated:**
```bash
node scripts/card-engine.js generate-set-ai --category sports --sport hockey --cards 200
node scripts/card-engine.js generate-set-ai --category celebrity --model google/gemini-2.0-flash-001
node scripts/card-engine.js generate-set-ai --category movie --cards 150
node scripts/card-engine.js generate-set-ai --category novelty --model meta-llama/llama-4-maverick:free
```

**Sports options** (`--sport`): basketball, football, soccer, baseball, hockey, mma, f1, tennis, golf

**Collection themes** (`--theme`): wildlife, space, gemstones, dinosaurs, art, artifacts, ocean, plants

### Category Display

Category-specific info appears on cards in collection/checklist views:
- Sports: team, position, jersey number, season stats line
- Celebrity: profession, era, fame score
- Movie/TV: chapter, season, characters, scene description
- Collection: classification, origin, rarity
- Novelty: novelty category, virality score

**Pack opening mechanics are unchanged** — categories are a data/cosmetic layer. The parallel, hit, grading, and market systems work identically across all categories.

## Quick Start

### Generate a New Set (Procedural)
```bash
node skills/trading-cards/scripts/card-engine.js generate-set
node skills/trading-cards/scripts/card-engine.js generate-set --category sports --sport basketball
```

### Generate a New Set (AI via OpenRouter)
```bash
# Requires OPENROUTER_API_KEY in ~/.openclaw/.env
node skills/trading-cards/scripts/card-engine.js generate-set-ai
node skills/trading-cards/scripts/card-engine.js generate-set-ai --model google/gemini-2.0-flash-001
node skills/trading-cards/scripts/card-engine.js generate-set-ai --model meta-llama/llama-4-maverick:free
node skills/trading-cards/scripts/card-engine.js generate-set-ai --theme "Cyberpunk Street Racing"
node skills/trading-cards/scripts/card-engine.js generate-set-ai --cards 200 --set-code DRG
```

The AI generator uses OpenRouter to call an LLM for creative character names, flavor text, and themed descriptions. Falls back to procedural generation if parsing fails.

### Flopps Status and Day Summary
```bash
node skills/trading-cards/scripts/card-engine.js flopps-status
node skills/trading-cards/scripts/card-engine.js flopps-day 9
node skills/trading-cards/scripts/card-engine.js flopps-day today
node skills/trading-cards/scripts/card-engine.js flopps-today
node skills/trading-cards/scripts/card-engine.js flopps-wildcard
```

These commands summarize Flopps activity, the current fake `FLPS` share price, and any recorded press releases or blog posts for the requested simulation day. On normal gameplay commands, Flopps may also surface a fresh bulletin directly in the command result if the simulation day advanced. `flopps-wildcard` force-generates a surprise AI-written corporate event and records it in the same history stream.

### Build Modular Card Image Prompts
```bash
node skills/trading-cards/scripts/card-image-prompts.js --set BOC-2026 --card 097 --side front
node skills/trading-cards/scripts/card-image-prompts.js --set BOC-2026 --card 097 --side back
node skills/trading-cards/scripts/card-image-prompts.js --set BOC-2026 --card 097 --side both --format json
node skills/trading-cards/scripts/card-image-prompts.js --set BOC-2026 --card 097 --side front --format json --prompt-format json
node skills/trading-cards/scripts/card-image-prompts.js --set BOC-2026 --all --side both --write-set
```

The compiler emits two render strings:
- `renderPromptShort`: the tight prompt you should feed to the image model
- `promptDetailed` / `renderPromptDetailed`: the richer fallback for inspection and debugging

The `prompt` field follows the selected output format: plain short text in `--prompt-format text`, or a concise JSON prompt object in `--prompt-format json`.

The JSON prompt keeps the full card taxonomy as structured metadata, but the model-facing render text stays compact. Use `--side front|back|both` depending on the renderer. If the model is overreacting to the section labels, use `--prompt-format json` so the render instructions are delivered as structured JSON with the short prompt as the primary field.

### Render a Pulled Card
When the user specifically asks to see a card they just pulled, use the prompt synthesis pipeline first and then generate images from that prompt:

1. Look up the pulled card from the pack/open output or collection entry.
2. Build the prompt payload with `card-image-prompts.js` for the required side:
```bash
node skills/trading-cards/scripts/card-image-prompts.js --set <set-code> --card <card-num> --side front --format json
node skills/trading-cards/scripts/card-image-prompts.js --set <set-code> --card <card-num> --side back --format json
node skills/trading-cards/scripts/card-image-prompts.js --set <set-code> --card <card-num> --side both --format json
```
3. Use `front.renderPromptShort` / `back.renderPromptShort` as the exact prompt input to OpenClaw image generation when you want the compact text version. If you need the richer version for review, inspect `front.promptDetailed` / `back.promptDetailed`. If you intentionally want JSON mode, use `front.prompt` / `back.prompt` from `--prompt-format json`.
4. Generate the image(s) and save them under `data/images/<set-code>/<card-num>-front.png` and `data/images/<set-code>/<card-num>-back.png`.
5. If the set defines `tradeDress`, use it as the shared visual language for logos, borders, title lockups, watermarking, and back framing across the set.
6. Base cards should carry the set trade dress prominently. High-end parallels may keep only a reference to the house identity or break it entirely when the variant is meant to be a chase design.
7. If a card has a novelty subtype, route it through the novelty subtree so the prompt can switch into packaging, certificate, ad, ticket, reveal, or faux-document language instead of forcing the card into the standard base/variant grammar.
8. If the set is marked `promptMode: "baked"` (for example BOC), preserve the baked front/back art language and do not remap it into a generic variant taxonomy.

This means the card image workflow is:
- `card data` -> `modular prompt payload` -> `image generation` -> `saved card art`
- front image prompt drives the hero art
- back image prompt drives the stats/back design and flavor text treatment
- baked sets keep their source-defined design language intact

### Open a Pack
```bash
node skills/trading-cards/scripts/card-engine.js open-pack hobby
node skills/trading-cards/scripts/card-engine.js open-pack blaster
node skills/trading-cards/scripts/card-engine.js open-pack retail
```

### Open a Full Box
```bash
node skills/trading-cards/scripts/card-engine.js open-box hobby
```

### View Portfolio
```bash
node skills/trading-cards/scripts/card-engine.js portfolio
```

### New Season
```bash
node skills/trading-cards/scripts/card-engine.js new-season
```

## Quick Start (Most Used)

```bash
# Open packs (dry-run by default)
node scripts/card-engine.js open-pack hobby
node scripts/card-engine.js open-pack retail --real    # commit to collection

# Financial overview
node scripts/card-engine.js portfolio
node scripts/card-engine.js wallet

# Market dashboard
node scripts/card-engine.js market
node scripts/card-engine.js market 039                  # specific card

# Collection helpers
node scripts/card-engine.js duplicates                  # find dupes
node scripts/card-engine.js top-cards                   # best cards owned
node scripts/card-engine.js pack-stats                  # pack opening stats
```

## How to Use

When the user wants to:
- **Open packs** → Run `open-pack [type]` or `open-box [type]`. Show the full output.
- **Check their collection** → Run `portfolio` and show the stats.
- **Check wallet** → Run `wallet`.
- **Browse the market** → Run `market` for the dashboard or `market <card-num>` for a specific card.
- **Grade cards** → Run `grade-card <card-num>` (costs $5/card).
- **Sell cards** → Run `sell <card-num>`.
- **Find duplicates** → Run `duplicates`.
- **Start fresh** → Run `new-season` to archive and reset. `reset-collection --confirm` to wipe without archiving.
- **See what sets exist** → Run `list-sets`.
- **View history** → Run `history` for recent activity or `history --all`.

The engine handles everything — parallel rolling, pricing, collection tracking, wallet management.

## Command Reference

### Modes

All commands default to **virtual mode** (dry-run — simulate, no cards saved, no wallet spent). Add `--real` to `open-pack` / `open-box` to commit: cards saved as personal assets, wallet deducted, and the secondary market advances.

### Set Generation

| Command | Description |
|---------|-------------|
| `generate-set [--category <type>] [--sport <sport>] [--cards N] [--theme T] [--seed S]` | Generate a new card set procedurally (random theme by default) |
| `generate-set-ai [--category <type>] [--sport <sport>] [--model M] [--theme T] [--cards N] [--set-code CODE]` | Generate a set using an AI model via OpenRouter |
| `new-season` | Archive current collection and start a fresh season |

### Pack Opening

| Command | Description |
|---------|-------------|
| `open-pack [type] [--real]` | Open one pack. Uses owned sealed stock first if available. Types: `hobby` ($120), `blaster` ($50), `retail` ($5), `jumbo` ($30) |
| `open-box [type] [--real]` | Open a full box (multiple packs). Uses owned sealed stock first if available. |

### Collection & Portfolio

| Command | Description |
|---------|-------------|
| `portfolio` | Financial overview + set completion stats |
| `wallet` | Show current wallet balance |
| `collection [set-code\|name]` | View collected cards, optionally filtered by set |
| `checklist [set-code\|name]` | Show which cards you're missing from a set |
| `list-sets` | List all available card sets |
| `set-info` | Show details of the active set (parallels, card types, inserts) |
| `card-types` | Display the active set's full type system (parallels, types, formats, modifiers) |
| `duplicates` | Find all duplicate cards in your collection |
| `top-cards [--grade]` | Show your best cards (by value); `--grade` sorts by PSA grade |
| `pack-stats` | Statistics on your pack openings |
| `history [--all] [--count N]` | Activity history; `--all` for full log, `--count N` for last N entries |
| `reset-collection --confirm` | Permanently wipe your collection (no archive, no undo) |

### Wallet Management

| Command | Description |
|---------|-------------|
| `add-money [amount]` | Add money to wallet (default: $1000) |
| `remove-money [amount]` | Remove money from wallet |
| `set-money <amount>` | Set wallet to exact amount |

### Selling

| Command | Description |
|---------|-------------|
| `sell <card-num>` | Sell cheapest copy of a card at market price |
| `sell --best <card-num>` | Sell most valuable copy instead |
| `sell dups` | Sell all duplicates (cheapest first, keep 1 best) |
| `sell --best dups` | Sell dups but keep cheapest (for set collectors) |

### Grading

| Command | Description |
|---------|-------------|
| `grade-card <card-num>` | Submit single card to PSA grading ($5/card, reveals grade) |
| `grade-card --all` | Grade every card in your collection ($5 each) |
| `grade-card --dups` | Grade only duplicate copies ($5 each) |

### Secondary Market

The market auto-advances when you open real packs/boxes or sell cards.
The secondary market also carries a small risk-on/risk-off overlay from the S&P 500. That macro signal is refreshed at most once every 48 hours when market-affecting commands run, so broad equity weakness creates mild downward pressure on speculative card prices while bull markets add a small tailwind.

| Command | Description |
|---------|-------------|
| `market` | Read-only dashboard: top movers, trends, events, book vs market |
| `market <card-num>` | Individual card detail with price chart, your copies, recent sales |
| `market macro` | Real-world macro signal snapshot and freshness |
| `flag` | Per-set overview: sentiment, tier breakdown, top movers, price index |
| `flag <card-num>` | Per-card sparkline chart + sales history + owned copies |
| `flag owned` | Market tracker for only your owned cards + portfolio trend |
| `flag movers` | Top 10 absolute movers |
| `flag gainers` | Top 10 gainers |
| `flag losers` | Top 10 losers |
| `revalue` | Recalculate collection value from current market prices, save |

### Marketplace, Trading, Lots, Auctions

| Command | Description |
|---------|-------------|
| `buy <card-num> [--best] [--max-price $X]` | Buy a single market card at a 5% premium |
| `sell-list <card-num> <price>` | List a specific copy on consignment at your chosen price |
| `sell-list instant <card-num>` | Instant sell at current market price |
| `sell-list listings` | View all active consignment listings |
| `sell-list cancel <listing-id>` | Cancel a consignment listing |
| `trade` | Browse NPC traders |
| `trade browse [<npc-id>]` | Show all traders or one trader’s inventory |
| `trade offer <npc-id> <your-card-num> for <their-card-num>` | Propose a trade to an NPC |
| `trade counter <trade-id> <card-num>` | Accept an NPC counter-offer |
| `trade history` | Show trade history |
| `lot` | Browse collection lots for sale |
| `lot browse` | Browse lots explicitly |
| `lot buy <lot-id>` | Buy a lot and reveal its contents |
| `lot history` | Show past lot purchases |
| `auction [ending|hot|new]` | Browse the enhanced auction house, optionally sorting by ending soonest, hot, or newest |
| `auction view <auction-id>` | Inspect a specific auction |
| `auction sell <card-num> [--start $X] [--reserve $X] [--duration N] [--bin $X]` | Create an auction listing |
| `auction bid <auction-id> <amount>` | Place a bid or trigger buy-it-now |
| `auction close` | Resolve expired auctions |
| `auction history` | Review completed auctions |
| `auction relist <completed-auction-id>` | Relist an expired or reserve-not-met auction |

### Advanced Market Tools

| Command | Description |
|---------|-------------|
| `market demand` | Market-wide sentiment and per-tier demand summary |
| `market supply <card-num>` | Supply, sales, and demand stats for one card |
| `market events` | Active market events and recent history |
| `market scalpers` | Summary of scalper activity |
| `market scalper <id>` | Detailed scalper profile |
| `market scalper-log` | Activity feed of all scalper actions |
| `market book <card-num>` | Synthetic order book for a specific card |
| `market order <card-num> <buy|sell> <qty> [--limit $X|--market]` | Simulate a market order against the book |

## Pack Types

| Type | Price | Cards | Hits | Description |
|------|-------|-------|------|-------------|
| Hobby Box | $120 | 12×5 | 2/box | Best odds, guaranteed hits |
| Blaster Box | $50 | 6×5 | 1/box | Mid-range, one hit |
| Retail Pack | $5 | 5 | 0 | Cheap, no guaranteed hits |
| Jumbo Pack | $30 | 10 | 1 | Extra cards, one hit |

### Set Info & Type System

```bash
node scripts/card-engine.js set-info          # set details with custom parallels/types
node scripts/card-engine.js card-types         # full type system display
```

### Grading & Provenance

| Command | Description |
|---------|-------------|
| `grade-card <card-num>` | Submit a single card for grading |
| `grade-card --all` | Grade every ungraded card in the collection |
| `grade-card --dups` | Grade only ungraded duplicate copies |
| `grade submit <card-num>` | Submit a single card for grading |
| `grade submit bulk <card-num>...` | Grade multiple cards in one submission |
| `grade status` | Show grading queue / status |
| `grade history` | Show grading history |
| `grade pop` | Show population overview for a card |
| `grade cost` | Estimate grading cost/value tradeoffs |
| `grade crack` | Estimate cracking risk / slab value loss |
| `grade stats` | Show grading statistics |
| `grade pop-report <card-num>` | Population report for a specific card |
| `grade value-add <card-num>` | Estimate grading value lift |
| `grade crack-risk <card-num>` | Estimate crack risk and expected loss |
| `origin [card-num]` | Show acquisition provenance summary or per-card source |

### Store

Sealed product you buy is stored in your collection as owned inventory. When you later open the same product type, the sim uses owned sealed stock first before spending cash on a fresh purchase.

| Command | Description |
|---------|-------------|
| `store list` | List all stores and relationship tiers |
| `store visit <store-id>` | Browse a store inventory |
| `store buy <store-id> <product> [qty]` | Buy sealed product into owned inventory |
| `store stock <store-id>` | View store stock levels |
| `store pressure <store-id>` | Show restock pressure, scalper pressure, and timing |
| `store restock <store-id>` | Run a restock check and report inventory changes |
| `store trade <store-id> <card-num> <product>` | Trade a card for store product |
| `store reputation` | Show relationship status with all stores |

## Parallel Tiers (18 levels — default)

Base → Chrome → Purple Shimmer → Blue Crackle → Tie-Dye → Pink Neon → Gold (/2026) → Green Lava (/499) → Cyan Ice (/299) → Magenta Pulse (/199) → Orange Blaze (/99) → Teal Surge (/75) → Red Magma (/50) → Black Shattered (/25) → White Rainbow (/10) → Gold Superfractor (1/1) → Black Infinite (1/1) → Printing Plate (1/1)

Sets can define **custom themed parallels** that replace these defaults. Use `--custom-types` with AI generation.

## Card Formats

| Format | Size | Value | Rarity | Description |
|--------|------|-------|--------|-------------|
| Standard | 2.5×3.5 | 1x | default | Normal card |
| Mini | 1.5×2.5 | 0.6x | more common | Smaller card |
| Landscape | 3.5×2.5 | 1.3x | slightly rare | Horizontal orientation |
| Booklet | 4×6 open | 2.5x | rare | Opens like a book |
| Die-Cut | custom | 1.8x | uncommon | Custom shape |
| Oversized | 5×7 | 3x | very rare | Large premium card |
| Acetate | clear | 2x | rare | Transparent card |

## Data Location

`~/.openclaw/workspace/skills/trading-cards/data/`
- `sets/` — Set definitions
- `collections/` — Collection state per set
- `config.json` — Wallet, active set, preferences

## Cron

Run automated hobby box breaks. The cron should:
1. Open one hobby box
2. Show the break results
3. Update the portfolio

Cron command example:
```bash
node ~/.openclaw/workspace/skills/trading-cards/scripts/card-engine.js open-box hobby
```

## AI Set Generation

Uses OpenRouter API to generate cards with AI-powered names, flavor text, and descriptions.

**Setup:** Add `OPENROUTER_API_KEY` to `~/.openclaw/.env` (get one at https://openrouter.ai/keys)

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--model` | `google/gemini-2.0-flash-001` | OpenRouter model ID |
| `--theme` | Random | Custom theme name |
| `--cards` | auto | Number of cards in set. `auto` (default) lets the AI decide based on category/theme; or specify an exact number |
| `--set-code` | Random 3-letter | Custom set code |
| `--force` | false | Overwrite active set |
| `--custom-types` | false | Generate themed parallels, card types, and inserts |
| `--flopps` | false | Also generate a Flopps corporate blog launch bundle for the set |
| `--flopps-mode` | `launch` | Choose the Flopps article mode: `launch`, `blog`, `release-notes`, `dev-notes`, or `world-sim` |
| `--flopps-model` | `moonshotai/kimi-k2.5` | OpenRouter model used for Flopps copy generation |

**Recommended cheap models:**
- `google/gemini-2.0-flash-001` — fast, creative, great value
- `meta-llama/llama-4-maverick:free` — free tier
- `google/gemini-2.5-flash-preview` — highest quality, still cheap
- `deepseek/deepseek-chat-v3-0324:free` — free, solid quality

**Standalone script:** Can also run directly: `node scripts/ai-set-generator.js --model ...`
Flopps launch bundle: `node scripts/ai-set-generator.js --flopps --flopps-mode launch`
CLI shortcut: `node scripts/card-engine.js flopps --theme "Arena of Broken Promises"`

### Flopps Set Cycle

Flopps runs on an accelerated product cadence: a new set lands roughly every 1.5 months.
Flopps also has a public-company watch mode: on a new simulation day, any command may surface a Flopps bulletin and update the fake `FLPS` stock price.
Flopps plans its release calendar at least 12 months ahead and uses franchise licensing, seasonal sports timing, and entertainment crossovers to keep the line full.
The simulation also tracks corporate pressure directly: release phases, allocation tightening, distributor lag risk, collector stress, retailer stress, and labor stress all feed into Flopps status and store pressure outputs.
Future licensing should be treated as a marketability committee process, not random inspiration: Flopps can use Google Trends style search-interest signals, release-window timing, and partner fit to choose the next licensed set roughly every 45 days.
Public communications should stay sparse and realistic: consumer blog posts should cluster around teaser, launch, and sell-through beats, while investor-facing quarterly announcements should happen strictly every 90 simulation days.

When the user asks for a Flopps launch, do all of the following in one pass:
- read the theme brief from Flopps management
- generate the set identity, chase structure, and product copy
- produce a fake corporate blog announcement or release note thread
- include the market-psychology angle: scarcity, secondary-market pressure, and collector fever
- if needed, generate a follow-up "dev note" or "what changed since last set" post

For a full launch, do not stop at card creation. Build the surrounding fiction: packaging language, teaser headline, launch-day summary, and the next-drop breadcrumb.

Use `node scripts/card-engine.js flopps-status` when you want the current fake public-company snapshot and the latest bulletin without generating a new launch article.
Use `node scripts/card-engine.js flopps-day <day>` to summarize Flopps actions on a specific simulation day.
Use `node scripts/card-engine.js flopps-today` to summarize Flopps actions for the current simulation day.

### Realistic Release Cadence

When Flopps plans a 12-month slate, anchor it around familiar hobby patterns:
- Baseball: Series 1, Series 2, Update, Bowman, Chrome, Heritage, Stadium Club, Finest, Museum, Dynasty
- Basketball / Football: Prizm, Select, Donruss, Mosaic, Contenders, Optic, National Treasures, Noir, Obsidian
- Multi-sport / entertainment: Topps Now-style instant drops, sticker collections, collabs, premium boxed sets, and seasonal exclusives
- Retail identities: Hobby, Retail, Blaster, Mega, Choice, FOTL, Sapphire, and other premium access tiers

Use those families as the template for Flopps product planning, then overlay the satirical business behavior on top.

## References

- `references/card-economics-research.md` — Topps/Panini economics research
- `references/system-design.md` — Full system design document
- `references/flopps-layer.md` — Flopps corporate parody voice, set-launch workflow, and simulation passes
- `references/flopps-business-research.md` — real-world card business mechanics, hidden incentives, and Flopps executive cast
