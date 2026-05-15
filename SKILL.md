---
description: Virtual trading card pack breaks, collection system, and Flopps corporate parody layer. Generate AI-themed card sets, open packs, collect cards, track portfolio value, write fake corporate blog posts, and build satirical set-launch copy. Use when the user wants to open packs, check their collection, see card values, start a new set, write Flopps release notes/articles, or do anything related to virtual trading cards.
name: trading-cards
---

# Trading Cards — Virtual Pack Breaks & Collection

> Compartmentalized trading card system that generates modern artificial scarcity card sets with random AI themes. Open packs, collect cards, track portfolio value.

## Compatibility

This skill runs on **Hermes Agent** and **OpenClaw** without changes:

| Feature | Hermes Agent | OpenClaw |
|---------|-------------|----------|
| CLI commands | `node scripts/card-engine.js <cmd>` | `node scripts/card-engine.js <cmd>` |
| Player management | `node scripts/player-manager.js <cmd>` | `node scripts/player-manager.js <cmd>` |
| Data directory | Set via `TRADING_CARDS_DATA_DIR` env var | Set via `TRADING_CARDS_DATA_DIR` env var |
| Skill loading | `skills:` in `config.yaml` | `agents[].skills` in `openclaw.json` |
| Daily stipend cron | `cronjob` tool + `stipend all` | OpenClaw cron + `stipend all` |
| AI set generation | Requires `OPENROUTER_API_KEY` in `.env` | Requires `OPENROUTER_API_KEY` in `.env` |
| RNG seed | `--seed <value>` flag | `--seed <value>` flag |
| Grading system | Built-in | Built-in |
| Flopps simulation | Built-in | Built-in |
| Stores & scalpers | Built-in | Built-in |

Set `TRADING_CARDS_DATA_DIR` to the player's data directory before running any wallet/collection commands.

## Multi-User System

Each registered player gets their own wallet, collection, trade history, marketplace state, and checklist.
Never assume a shared/default wallet. Always resolve the player first, then run `card-engine` commands against that player's data directory.

**Sets are global.** All card sets live in `data/sets/` and are shared across every player. When a set is created (via `ai-set-generator`, `boc-set-generator`, or manually), it becomes available to all players immediately. No per-player set paths — saying "my set" means "the set I'm collecting from," not a private copy.

**Set creation triggers an announcement.** Both set generators emit a `[SET_ANNOUNCEMENT]` line. The downstream agent — when running the generator — MUST then announce the set to all registered players using `player-manager announce-set <setCode>` or by constructing the @-mention message directly. This ensures every player knows a new set has landed.

Player identity comes from `player-manager.js`; do not invent a new user name inside the engine.

### Player Manager (scripts/player-manager.js)

```
player-manager register <name> [display-name]   # Register new player
player-manager player <name>                      # Switch active player
player-manager players                            # List all players
player-manager me                                 # Show active player
player-manager dir                               # Get active player data dir
player-manager stipend <name>                    # Check/grant daily $5 stipend
player-manager stipend all                       # Grant stipend to all players
player-manager stipend default [amount]          # Show/set the default daily stipend
player-manager stipend set <name> <amount>       # Override one player's stipend
player-manager stipend clear <name>              # Remove a player's stipend override
player-manager announce-set <setCode>             # Generate an @-mention announcement for a new set
```

### Flopps Simulation — Real-World Day Catch-Up

The Flopps simulation uses **real-world elapsed days** since the market was created (`createdAt`), not manual day increments. `getSimulationDay(market)` returns `Math.floor((Date.now() - createdAt) / 86400000)`.

When a command runs, `maybeAnnounceFloppsNews` detects any gap between `lastSeenDay` and the current real day, then **catches up day-by-day**:

1. Iterates each missed day (from `lastSeenDay+1` to `currentDay`)
2. Runs per-day stock price ticks via `updateFloppsStockPrice`
3. Checks for scheduled announcements at each day milestone (teaser at -7, launch at 0, sell-through at +14, quarterly at %90)
4. Records all generated bulletins in the news history

A catch-up summary is printed showing days caught up, FLPS price movement, and any milestone bulletins that fired.

The state also tracks `lastSeenDate` (real timestamp) alongside `lastSeenDay` — parallels the stipend system's date-based catch-up pattern.

Commands that trigger the catch-up: `flopps-status`, `flopps-day`, `flopps-today`, `open-pack`, `open-box`, and any real pack-opening command.

**flopps-status display** now shows real-world dates:
- `Sim day: 39 (8 May 2026)` instead of just the simulation day number
- `Next launch: 14 May 2026 — Murrican Harry Potter Collectors Set` instead of `day 45`
- FLPS price history shows per-day entries even after multi-day gaps

**Flopps state file duality:** The flopps state is stored per-player at `data/players/<id>/flopps/state.json` AND at the global `data/flopps/state.json`. The player-scoped one is the source of truth when running under `TRADING_CARDS_DATA_DIR`. Keep them in sync if you manually edit one. **Sets are not affected by this** — all sets are always read from `data/sets/` regardless of `TRADING_CARDS_DATA_DIR`.

### Daily Stipend

Every registered player gets a daily stipend automatically. The amount comes from:

1. A per-player `stipendAmount` override, if present
2. The registry default `defaultStipendAmount`
3. The fallback `$5/day`

- `card-engine.js` and `player-manager.js` auto-check stipend on command entry
- Manual `player-manager.js stipend <player>` still works, but is only needed for explicit checks
- `stipend default` sets the registry-wide default for new and unconfigured players
- `stipend set <player> <amount>` gives one player a custom daily stipend
- `stipend clear <player>` removes the per-player override and restores the registry default
- The stipend is tracked per-player by date and catches up missed calendar days
- **`stipend all`** checks all registered players at once
- The cron job (`daily-pocket-money`) can call `stipend all` at a configured time to announce paydays, but it is now a safety net rather than the only trigger
- **Do NOT use `card-engine.js add-money 5` for daily stipend** — that bypasses the dedup and causes double payments
- Avoid relying on unnamed or shared users.

### Running Card Engine for a Specific Player

Set `TRADING_CARDS_DATA_DIR` to the player's directory before invoking the engine:
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
```

### Gifting Cards

```
player-manager gift <from> <to> <card#>   # Gift a card to another player
```
- If the sender has duplicates, gifts the cheapest copy (keeps the best)
- If only one copy, gifts the only copy
- The card's `source` is updated to "gift from <player>"
- No money changes hands — it's a gift!

### Identifying Users

When someone speaks in #trading-cards, check their Discord/Telegram name against registered players. If not registered, register them automatically with their display name.

### When the Player Is Confused — Recommend `help`

If the player types something that doesn't make sense, uses wrong arguments, seems
lost, or clearly doesn't understand how the skill works — **stop and tell them to
run `help` or run it for them directly.**

Good responses:
- "That command doesn't work like that. Try `help` — it walks through everything
  you can do here."
- "Sounds like you're new here. Run `help` to see the full guide — packs, grading,
  stores, auctions, the whole Flopps world."
- *Just run `card-engine help` and show the output.*

Never guess what they meant if they're clearly confused. The `help` command was
built for exactly this situation. Use it.

### Player Defaults

- **Default pack type:** Retail ($5, 5 cards, no guaranteed hits). Use `retail` unless the player explicitly asks for hobby/blaster/jumbo.
- **Real by default in dedicated Discord channels:** If you run `#trading-cards` as a dedicated channel, configure pack openings to be real by default (dry-run opt-in with `--dry-run`). For other contexts (DM, Telegram, general channels), virtual/dry-run is the default and `--real` is opt-in.

## 🏪 Shop Behavior — NON-NEGOTIABLE

You are the card shop owner. Every transaction starts with a wallet check. **Never promise a sale before verifying funds.**

### Before ANY command that costs money, you MUST:

1. **Know the wallet balance.** If you don't have it in context, run `wallet` FIRST.
2. **Know the cost.** Pack types have fixed prices. Grading costs $5/card. Store purchases have listed prices. Auctions require bid amounts.
3. **Compare.** If `balance < cost`, REFUSE and tell the player what they can afford instead.
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

### When the player asks conversationally:

- "let's open a pack", "rip a pack", "get me a pack", "gimme another", "one more" → **STOP. Check wallet first.** Then answer with what's affordable or just open what you can.
- "can I get a hobby box?" → Check wallet, then say yes/no with balance.
- Do NOT ever say "sure!" or "yes!" to a pack request without confirming the wallet can cover it.

### Tone:

You're a card shop owner. Be helpful but don't give away product. If the customer is short, tell them straight: "You've got $3.69 — not enough for a retail pack ($5). You can sell some cards or I can show you what's in your price range."

### Edge cases:

- **Sealed inventory:** Check `store list` or sealed inventory before spending wallet. If the player owns sealed product, use that first (it's already paid for).
- **Grading bulk:** `grade-card --all` could wipe the wallet. Warn before running if cost approaches the balance.
- **Multiple packs:** If the player asks for 3 retail packs, check wallet ≥ $15, not just ≥ $5.
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
On any simulation day, the first command after a gap triggers the Flopps catch-up (see Flopps Status section above), which iterates through each missed day, runs stock ticks, and surfaces any milestone bulletins that fired during the gap. The output includes a `FLOPPS CATCH-UP` block with the price movement and full blog messages. On a same-day command, Flopps may surface a fresh bulletin directly in the command result. `flopps-wildcard` force-generates a surprise AI-written corporate event and records it in the same history stream.

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
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js generate-set
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js generate-set --category sports --sport basketball
```

### Generate a New Set (AI via OpenRouter)
```bash
# Requires OPENROUTER_API_KEY in ~/.hermes/.env or ~/git/lifestyle/.env
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js generate-set-ai
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js generate-set-ai --model google/gemini-2.0-flash-001
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js generate-set-ai --model meta-llama/llama-4-maverick:free
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js generate-set-ai --theme "Cyberpunk Street Racing"
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js generate-set-ai --cards 200 --set-code DRG
```

The AI generator uses OpenRouter to call an LLM for creative character names, flavor text, and themed descriptions. Falls back to procedural generation if parsing fails.

### Flopps Status and Day Summary
```bash
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js flopps-status
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js flopps-day 9
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js flopps-day today
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js flopps-today
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js flopps-wildcard
```

These commands summarize Flopps activity, the current fake `FLPS` share price, and any recorded press releases or blog posts for the requested simulation day.

**`flopps-status` now shows real-world dates:**
- `Sim day: 39 (8 May 2026)` instead of a bare simulation day number
- `Next launch: 14 May 2026 — Murrican Harry Potter Collectors Set` instead of `day 45`

**Catch-up on first command of the day:**  
The simulation tracks `lastSeenDay` (real-world elapsed days since market creation) and `lastSeenDate` (last interaction timestamp). When a command runs after a multi-day gap, the system iterates each missed day — running per-day stock price ticks, checking for scheduled announcements (teasers at -7, launches at 0, sell-through at +14, quarterly at %90), and recording all generated bulletins. The output includes a `FLOPPS CATCH-UP` block showing:

```
  🏛️ FLOPPS CATCH-UP
  ════════════════════════════════════════════════════════
  Flopps caught up 4 days (day 36 → 39).
    FLPS: $752.76 → $1,277.53 (69.7%)
    Phase: prelaunch
  ────────────────────────────────────────────────────────
  Blog messages from the catch-up period:

    ── day 38 ──
    📰 Coming Next: Murrican Harry Potter
    Flopps published a controlled teaser for Murrican Harry Potter...
    They started the prelaunch hype cycle one week out.
    Spokesperson: Chief Marketing Officer Elena Cross

  ════════════════════════════════════════════════════════
```

Commands that trigger the catch-up: `flopps-status`, `flopps-day`, `flopps-today`, `open-pack`, `open-box`, and any real pack-opening command.

`flopps-wildcard` force-generates a surprise AI-written corporate event and records it in the same history stream.

**Flopps state file duality:**  
The flopps state is stored per-player at `data/players/<id>/flopps/state.json` AND at the global `data/flopps/state.json`. The player-scoped one is the source of truth when running under `TRADING_CARDS_DATA_DIR`. Keep them in sync if you manually edit one. **Sets are always global** — `data/sets/` is shared across all players regardless of `TRADING_CARDS_DATA_DIR`.

### Build Modular Card Image Prompts
```bash
node ~/.hermes/skills/gaming/trading-cards/scripts/card-image-prompts.js --set <set-code> --card 097 --side front
node ~/.hermes/skills/gaming/trading-cards/scripts/card-image-prompts.js --set <set-code> --card 097 --side back
node ~/.hermes/skills/gaming/trading-cards/scripts/card-image-prompts.js --set <set-code> --card 097 --side both --format json
node ~/.hermes/skills/gaming/trading-cards/scripts/card-image-prompts.js --set <set-code> --card 097 --side front --format json --prompt-format json
node ~/.hermes/skills/gaming/trading-cards/scripts/card-image-prompts.js --set <set-code> --all --side both --write-set
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
node ~/.hermes/skills/gaming/trading-cards/scripts/card-image-prompts.js --set <set-code> --card <card-num> --side front --format json
node ~/.hermes/skills/gaming/trading-cards/scripts/card-image-prompts.js --set <set-code> --card <card-num> --side back --format json
node ~/.hermes/skills/gaming/trading-cards/scripts/card-image-prompts.js --set <set-code> --card <card-num> --side both --format json
```
3. Use `front.renderPromptShort` / `back.renderPromptShort` as the exact prompt input to image generation when you want the compact text version. If you need the richer version for review, inspect `front.promptDetailed` / `back.promptDetailed`. If you intentionally want JSON mode, use `front.prompt` / `back.prompt` from `--prompt-format json`.
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
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js open-pack hobby
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js open-pack blaster
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js open-pack retail
```

### Open a Full Box
```bash
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js open-box hobby
```

### View Portfolio
```bash
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js portfolio
```

### New Season
```bash
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js new-season
```

### Quick Start (Most Used)

```bash
# Open packs (dry-run by default)
TRADING_CARDS_DATA_DIR=$(node ~/.hermes/skills/gaming/trading-cards/scripts/player-manager.js dir) node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js open-pack hobby
TRADING_CARDS_DATA_DIR=$(node ~/.hermes/skills/gaming/trading-cards/scripts/player-manager.js dir) node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js open-pack retail --real    # commit to collection

# Compare all players (no TRADING_CARDS_DATA_DIR needed — global command)
node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js compare

# Financial overview
TRADING_CARDS_DATA_DIR=$(node ~/.hermes/skills/gaming/trading-cards/scripts/player-manager.js dir) node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js portfolio
TRADING_CARDS_DATA_DIR=$(node ~/.hermes/skills/gaming/trading-cards/scripts/player-manager.js dir) node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js wallet

# Market dashboard
TRADING_CARDS_DATA_DIR=$(node ~/.hermes/skills/gaming/trading-cards/scripts/player-manager.js dir) node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js market
TRADING_CARDS_DATA_DIR=$(node ~/.hermes/skills/gaming/trading-cards/scripts/player-manager.js dir) node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js market 039                  # specific card

# Collection helpers
TRADING_CARDS_DATA_DIR=$(node ~/.hermes/skills/gaming/trading-cards/scripts/player-manager.js dir) node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js duplicates                  # find dupes
TRADING_CARDS_DATA_DIR=$(node ~/.hermes/skills/gaming/trading-cards/scripts/player-manager.js dir) node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js wishlist list                # show wishlist
TRADING_CARDS_DATA_DIR=$(node ~/.hermes/skills/gaming/trading-cards/scripts/player-manager.js dir) node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js top-cards                   # best cards owned
TRADING_CARDS_DATA_DIR=$(node ~/.hermes/skills/gaming/trading-cards/scripts/player-manager.js dir) node ~/.hermes/skills/gaming/trading-cards/scripts/card-engine.js pack-stats                  # pack opening stats
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
- **Manage wishlist** → Run `wishlist add <card-num>`, `wishlist remove <card-num>`, or `wishlist list`.
- **Start fresh** → Run `new-season` to archive and reset. `reset-collection --confirm` to wipe without archiving.
- **See what sets exist** → Run `list-sets`.
- **View history** → Run `history` for recent activity or `history --all`.
- **Compare players** → Run `compare` to see wallets, cards, slots, value, and completion across all registered players in a table.

The engine handles everything — parallel rolling, pricing, collection tracking, and player wallet management. If a command is not simulation/topps-only, it should run with `TRADING_CARDS_DATA_DIR` pointing at a player directory.

## Pitfalls

### Codebase Architecture (Post-Second-Refactor)

As of May 2026, `card-engine.js` was refactored from a monolith into **eight** files:

| File | Lines | Role |
|------|-------|------|
| `scripts/lib/constants.js` | 466 | All static data: packs, parallels, grades, tiers, flopps data, emojis, categories |
| `scripts/lib/helpers.js` | 598 | All utility functions: file I/O, config/collection loaders, grading math, RNG, card gen |
| `scripts/lib/pack-engine.js` | 177 | Card pulling: `pullCards`, `rollParallel`, `rollSpecial`, `calcPrice`, `fmtCard`, `selectCard` |
| `scripts/lib/market-engine.js` | 505 | Secondary market: `MARKET_EVENT_PROFILES`, tick simulation, price engine, `initMarket`, macro state |
| `scripts/lib/flopps-engine.js` | 447 | Flopps corporate simulation: corporation state, stock price, release calendar, bulletins, wildcards |
| `scripts/lib/economy-engine.js` | 662 | Stores, scalpers, auctions, marketplace, lots, trades, order book, provenance/origin system |
| `scripts/lib/grading-engine.js` | 85 | Grading rarity analysis, gradeflation pressure, `processCompletedSubmissions` |
| `scripts/card-engine.js` | ~2,100 | Game logic (generateSet) + all command handlers + Commander CLI + main entry |

`card-engine.js` imports from all lib modules via destructured `require()`:

All lib modules are in `scripts/lib/`. `card-engine.js` imports from all 7 via destructured `require()`.

**Finding the right module for new code:**
- Card pulling functions → `lib/pack-engine.js`
- Market data/ticks → `lib/market-engine.js`
- Flopps simulation (stock, bulletins, calendar) → `lib/flopps-engine.js`
- Stores, scalpers, auctions, listings → `lib/economy-engine.js`
- Grading system (rarity analysis, pop reports) → `lib/grading-engine.js`
- Static lookup tables → `lib/constants.js`
- Pure utility functions → `lib/helpers.js`

**Circular dependency avoidance:** `flopps-engine.js` lazy-requires `isSetHot` and `getDemandFactor` from `economy-engine.js` (inside function bodies, not at module scope). `economy-engine.js` in turn requires `getFloppsReleaseWindow` and `loadFloppsState` from `flopps-engine.js` (also lazy). Any new cross-module dependency between these two should follow the same lazy-require pattern. `market-engine.js` has no circular dependencies — it's safe to require at module scope.

**Recovery from corruption (the shared-skills trap):** The backup at `~/git/hermes-shared-skills/.../card-engine.js` is the **pre-refactor 8,353-line monolith** — it predates ALL 7 lib modules. Restoring from it and assuming it's the refactored version will produce duplicate declarations. To rebuild:
1. Restore the monolith from shared-skills
2. Strip all function definitions whose names match lib module exports (use a Node.js script with function-def detection by regex, not brace-counting — brace counting fails on arrow functions and nested blocks)
3. Insert the 7 import blocks from the surviving lib modules
4. Re-add any post-refactor command handlers (e.g. `cmdCompare` was added during the first refactor and won't be in the monolith)
5. Verify: `node -e "require('./scripts/card-engine.js')"` — this catches duplicate `Identifier 'X' has already been declared` errors

**Cat truncated when reading large files via terminal:** `cat`, `head`, and similar terminal commands cap output at ~50KB. For files >1,000 lines, write a Node.js script that uses `fs.readFileSync` directly rather than piping through terminal. The truncation is silent — you won't see a warning, you'll just get partial data and silently corrupt anything you write back.

### Subagent Delegation Forbidden for Refactoring
Large-scale refactoring tasks (splitting a monolith, extracting lib modules, moving function bodies) must be done **directly**, not delegated to subagents. Subagents lose full session context, can truncate files, and introduce bugs that are hard to track. The user explicitly forbids subagent delegation for this class of work. Always do JS monolith splitting in-line with direct read_file/write_file or Node.js scripts.

### LOG Object Pattern

`LOG` from `lib/helpers.js` is a mutable reference object `{ current: null }`. When used in `card-engine.js`:
```js
LOG.current = createTradingLogger({...});  // set
LOG.current?.log('process.start', {...});  // use (never LOG.log or LOG?.log)
```

All `LOG?.` calls become `LOG.current?.`. If you define a helper that uses LOG, make sure it accesses `LOG.current`, not `LOG` directly.

### compare Command — Global Context

`compare` is a **player-free command** — it reads all players from the global `data/players.json` and doesn't need `TRADING_CARDS_DATA_DIR`. Run it directly:
```bash
node scripts/card-engine.js compare
```
It was added to `PLAYER_FREE_COMMANDS` in the init block and registered in Commander. If you add a new global command, do the same.

### Portfolio Display: Slots vs Variants

Portfolio and collection views now use **slot-based display** (unique card numbers, not unique IDs):

```
  $167.96 (211 cards, 125/150 slots (+86 variants))
             ↑ unique card nums from 001-150
                                       ↑ parallel variants beyond the base card
```

This avoids confusion where "163 unique cards" seemed impossible in a 150-card set. The count breakdown:
- **Total cards** = all owned parallels combined
- **Slots** = unique card numbers owned (the "set checklist" metric)
- **Variants** = extra copies of the same card number in different parallels

### Flopps State File Duality

The flopps state exists in **two locations**:
- Player-scoped: `data/players/<id>/flopps/state.json` (used when `TRADING_CARDS_DATA_DIR` is set)
- Global: `data/flopps/state.json` (used when `TRADING_CARDS_DATA_DIR` is NOT set)

When running commands with the player scoping pattern (`TRADING_CARDS_DATA_DIR=$(node player-manager.js dir)`), the player-scoped one is read and written. The global one falls out of sync. To check or manually edit flopps state, always target the player-scoped version if you're in the standard workflow.

**Sets are NOT dual** — all sets live in `data/sets/` (global) and are read from there regardless of `TRADING_CARDS_DATA_DIR`. The code explicitly resolves sets against the project-level `data/` directory, not the player-scoped one.

### ~Collection File Auto-Creation Bug (FIXED)~
~~`card-engine.js` `loadCol()` returns `null` if the collection file doesn't exist, causing crashes on first pack open.~~

**Status: FIXED** - `loadCol()` now auto-creates empty collections when missing. No manual workaround needed.

### Flopps Catch-Up History Duplication → Timeouts

The flopps catch-up mechanism (`maybeAnnounceFloppsNews`) appends new stock history entries on each catch-up run. When it re-processes already-seen days (e.g. because the `lastSeenDay` tracking mismatches), the stock history accumulates **duplicate entries for the same day**, inflating from ~25 entries to 40+ in successive runs.

Symptoms:
- `flopps-status`, `flopps-today`, `open-pack`, or any trigger command **hangs for 30+ seconds and eventually times out**
- The stock history in `state.json` shows the same day numbers (e.g. 36-39) appearing 2-3 times

**Workaround:** Manually deduplicate the stock history by day, keeping only the last entry per day. Edits go into `data/players/<id>/flopps/state.json` (player-scoped) and `data/flopps/state.json` (global):
```bash
# Check the file first
cat data/flopps/state.json | node -e "
const d = require('fs').readFileSync('/dev/stdin','utf8');
const s = JSON.parse(d);
const seen = {};
s.stock.history = s.stock.history.filter(e => {
  const k = e.day;
  return seen[k] ? false : (seen[k] = true);
});
// also check dayHistory if it has duplicates
const seen2 = {};
s.dayHistory = s.dayHistory.filter(e => {
  const k = e.day;
  return seen2[k] ? false : (seen2[k] = true);
});
console.log(JSON.stringify(s, null, 2));
" > tmp.json && mv tmp.json data/flopps/state.json
```

### Network Cache Bug (SP500 FRED Fetch)

Every command calls `getMacroState()` which fetches SP500 data from FRED. **The fallback cache was never written on failure**, so every command retried the ~9s timeout. Fixed in `market-engine.js`: write `cached.lastFetch = Date.now()` even when the fetch fails.

### OpenRouter Wildcard Hang

`maybeGenerateFloppsWildcardBulletin` spawns `ai-set-generator.js` via child process. A disabled API key caused an ~8s hang per command. Fixed with `OPENROUTER_API_KEY` guard and 5s child-process timeout.

### Debugging Slow Commands

Use `console.time()` to instrument the init chain. Both 8-second timeouts (SP500 fetch + OpenRouter wildcard) were invisible until timed individually.

### Commander Argument Declaration

Commands parsing subcommands from `process.argv` (e.g., `wishlist add 001`, `sell 007`, `flag owned`) must declare `.argument()` or Commander rejects extra args. Add `.argument('[subcommand]')` and `.argument('[args...]')` (variadic) to every such command.

### Variant vs Duplicate Display in Pack Output (FIXED May 2026)

The pack opening output now clearly distinguishes three states per card:

| Badge | Meaning | Can gift/sell? |
|-------|---------|---------------|
| `[x2]` | True duplicate — same cardNum **AND same parallel** | ✅ Yes |
| `✨ New Variant!` | New parallel for an already-owned cardNum | ❌ No (only copy of this parallel) |
| `🌟 New Best Variant!!` | New parallel AND it's the highest-priced variant you own for that cardNum | ❌ No (only copy of this parallel) |

**Implementation:** Three files were modified:
- `lib/helpers.js` — `createAcquisitionTracker` now builds `pullsBeforeByKey` (`cardNum:parallel` → count) and `prevCardInfo` (cardNum → {maxPrice, parallels[]}). `annotateAcquiredCard` checks by `cardNum:parallel` key for true dupes, then checks `prevCardInfo` for variant/best-variant status.
- `lib/pack-engine.js` — `fmtCard` reads `c.acquiredIsVariant` and `c.acquiredIsBestVariant` to display the badges.
- `card-engine.js` — pack/box output tracks `variantCount` separately from `newCount` and `dupCount`. Summary line shows: `New: X (Y variants) | Dupes: Z`

**Key design notes:**
- The old code used `cardNum` only (across all parallels) → this caused `[x2]` to appear even when the pulled card was a different parallel than any existing copy
- `col.pulls` (cardNum → count) was NOT changed — it's used by sell/auction/economy logic
- The new `pullsBeforeByKey` lives only in the acquisition tracker at pack-open time
- `prevCardInfo` pre-scans `col.cards` at tracker creation to know existing max prices per cardNum
- Best variant = strictly higher `card.price` than any existing copy's price (parallel rarity ordering is implicit through price)
- Dry runs have no `col` context so no badges appear — correct behavior



## References

- `references/card-economics-research.md` — Topps/Panini economics research
- `references/system-design.md` — Full system design document
- `references/flopps-layer.md` — Flopps corporate parody voice, set-launch workflow, and simulation passes
- `references/flopps-business-research.md` — real-world card business mechanics, hidden incentives, and Flopps executive cast
- `references/testing-patterns.md` — Smoke test patterns and CLI testing approach
- `references/module-architecture.md` — Codebase layout post-refactor: lib exports, player-free vs player-scoped commands, LOG handling, common pitfalls
- `references/module-extraction-pattern.md` — How the 7,500→2,100 line refactoring was done: multi-pass approach, tooling, pitfalls encountered and solved
- `references/variant-duplicate-detection.md` — Variant vs duplicate display in pack output: detection pipeline, data structures, files modified, test scenarios, pitfalls