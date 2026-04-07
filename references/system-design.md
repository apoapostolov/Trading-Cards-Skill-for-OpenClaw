# Virtual Trading Card System — Complete Design Document

## 1. Overview

A fully virtual trading card generation and collection system. Each "season" receives a random theme (AI-generated), a set of 100–200 unique character cards, and a parallel rarity hierarchy modeled after real-world products like Topps Chrome and Panini Prizm. Cards are opened from randomized packs, tracked in a JSON collection ledger, and priced by a dynamic algorithm.

---

## 2. Theme & Set Generation

### 2.1 Theme Parameters

Each season/set is generated with:

| Field | Description | Example |
|---|---|---|
| `setName` | Display name | "Deep Sea Explorers 2026" |
| `year` | Season year | 2026 |
| `totalCards` | Base card count (100–200) | 150 |
| `rookieCount` | % of set flagged as rookies | 20–30% |
| `legendCount` | % flagged as legends | 5–10% |
| `allStarCount` | % flagged as all-stars | 10–15% |
| `flashbackCount` | % flagged as flashback | 5–10% |
| `loreSeed` | Short thematic prompt for AI name/lore generation | "Deep ocean research crew, mythical creatures, submarine tech" |

### 2.2 Character Generation

For each card the AI produces:

```json
{
  "cardId": "DSE-001",
  "name": "Cpt. Marina Voss",
  "subset": "Rookie",
  "tier": "Star",
  "description": "Youngest submarine commander in the Atlantic fleet.",
  "stats": {
    "power": 72,
    "speed": 88,
    "technique": 65,
    "endurance": 80,
    "charisma": 91
  },
  "starPower": 0.72,
  "rookieFlag": true,
  "legendFlag": false,
  "allStarFlag": false
}
```

**Star tiers** (controls base price & demand):
| Tier | % of set | Base price range | Demand modifier |
|---|---|---|---|
| Common | 55–65% | $0.10–$0.30 | 1.0× |
| Uncommon | 15–20% | $0.30–$0.75 | 1.2× |
| Star | 8–12% | $0.75–$1.50 | 1.8× |
| Superstar | 3–6% | $1.50–$3.00 | 3.0× |
| Legendary | 1–3% | $3.00–$5.00 | 5.0× |

---

## 3. Parallel Tier System

### 3.1 Parallel Table (18 Tiers)

| # | Name | Odds (per card slot) | Numbered | Serial | Price Multiplier | Visual Effect |
|---|---|---|---|---|---|---|
| 1 | **Base** | 1:1 | No | — | 1.0× | Standard card stock, matte finish |
| 2 | **Chrome** | 1:3 | No | — | 2.0× | Crisp chrome finish, light refractive sheen |
| 3 | **Purple Shimmer** | 1:6 | No | — | 3.5× | Deep purple tint, subtle wave holographic |
| 4 | **Blue Crackle** | 1:12 | No | — | 6.0× | Electric blue ice-crackle pattern, sparkle |
| 5 | **Tie-Dye** | 1:18 | No | — | 9.0× | Swirling multicolor tie-dye, trippy pattern |
| 6 | **Pink Neon** | 1:24 | No | — | 12.0× | Hot pink border glow, neon pulse effect |
| 7 | **Gold** | 1:36 | Yes | /2026 | 18.0× | Full gold foil, embossed border |
| 8 | **Green Lava** | 1:60 | Yes | /499 | 28.0× | Dark green with lava-flow metallic streaks |
| 9 | **Cyan Ice** | 1:80 | Yes | /299 | 40.0× | Frosted cyan, ice-crystal refraction |
| 10 | **Magenta Pulse** | 1:100 | Yes | /199 | 55.0× | Pulsing magenta energy field effect |
| 11 | **Orange Blaze** | 1:130 | Yes | /99 | 75.0× | Flame-orange gradient, fire-edge foil |
| 12 | **Teal Surge** | 1:160 | Yes | /75 | 100.0× | Deep teal with electric surge lines |
| 13 | **Red Magma** | 1:200 | Yes | /50 | 140.0× | Molten red, cracked-lava texture |
| 14 | **Black Shattered** | 1:350 | Yes | /25 | 220.0× | Black with shattered-glass overlay, prismatic |
| 15 | **White Rainbow** | 1:500 | Yes | /10 | 400.0× | Prismatic rainbow on white, full-spectrum foil |
| 16 | **1/1 Gold Superfractor** | 1:set_run | Yes | 1/1 | 1,000.0× | Full gold superfractor, deep rainbow refraction |
| 17 | **1/1 Black Infinite** | 1:set_run | Yes | 1/1 | 1,500.0× | Black on black, infinite depth laser etch |
| 18 | **1/1 Printing Plate** | 1:set_run | Yes | 1/1 | 800.0× | Cyan/Magenta/Yellow/Black metal plate |

**Set run** = total hobby boxes produced (default: 5,000). Since each box has 60 cards, a 150-card set × 5,000 boxes means each specific card appears ~2,000 times across the print run. 1/1 odds are effectively 1 per card per print run.

### 3.2 Parallel Probability Math (per single card slot)

The roll order cascades from rarest to most common:

```
P(Superfractor)  = 1/total_print_run_per_card
P(Black Infinite) = 1/total_print_run_per_card
P(Printing Plate) = 4/total_print_run_per_card  (CMYK set)
P(White Rainbow)  = 1/500
P(Black Shattered)= 1/350
...
P(Gold)           = 1/36
...
P(Base)           = remainder (~55%)
```

---

## 4. Special Card Types

| Type | Odds | Parallel Coverage | Notes |
|---|---|---|---|
| **Autograph** | 1:box (hobby), 1:3 boxes (blaster) | Base through Orange Blaze | Handwritten-style sig overlay, stamped serial |
| **Relic / Patch** | 1:box (hobby), 1:3 boxes (blaster) | Base through Red Magma | Embedded "material" swatch (themed to set) |
| **Dual Auto** | 1:6 boxes | Chrome through Orange Blaze | Two character signatures |
| **Auto Patch** | 1:12 boxes | Gold through White Rainbow | Signature + relic combined |
| **Booklet** | 1:24 boxes | Gold+ only | Two-panel foldout, premium stock |
| **Variation (Alt Art)** | 1:20 packs | Base, Chrome, Blue | Different artwork of same character |
| **Error Variant** | 1:200 packs | Base only | Misspelled name, wrong stats, inverted colors — becomes collectible |
| **Novelty (Food Issue)** | 1:50 packs | Base only | Parody packaging theme (pizza, cereal box, etc.) |
| **Printing Plate** | 1 per card per set run | Unique | Cyan / Magenta / Yellow / Key (Black) — 4 plates per card |

### Special Type Bonus Multipliers

| Type | Multiplier (applied on top of parallel multiplier) |
|---|---|
| Autograph | 15× |
| Relic / Patch | 12× |
| Dual Auto | 35× |
| Auto Patch | 50× |
| Booklet | 8× |
| Variation (Alt Art) | 2.5× |
| Error Variant | 3.0× |
| Novelty | 1.5× |
| Printing Plate | (included in parallel multiplier) |

---

## 5. Pack Configuration

### 5.1 Pack Types

| Pack Type | Packs | Cards/Pack | Hits Guaranteed | Box Price | Pack EV |
|---|---|---|---|---|---|
| **Hobby Box** | 12 | 5 | 2 hits/box (min 1 auto + 1 relic) | $120 | $95–$110 |
| **Blaster Box** | 6 | 5 | 1 hit/box | $50 | $35–$45 |
| **Retail Pack** | 1 | 5 | 0 guaranteed | $5 | $2.50–$4.00 |
| **Jumbo Pack** | 1 | 10 | 1 hit | $30 | $20–$28 |
| **Mega Box** | 8 | 6 | 3 hits | $200 | $160–$190 |

### 5.2 Card Slot Allocation (per Hobby Pack — 5 cards)

| Slot | Contents |
|---|---|
| Slot 1 | Base or Chrome parallel (70% base, 30% chrome) |
| Slot 2 | Any parallel tier 1–6 (weighted toward common) |
| Slot 3 | Any parallel tier 1–10 |
| Slot 4 | Any parallel tier 1–15 (hot slot) |
| Slot 5 | Hit slot: Auto, Relic, or special insert |

Per Hobby Box (12 packs = 60 cards):
- ~30 base, ~10 chrome, ~8 mid-tier parallels (tiers 3–6), ~8 high-tier (7–10), ~2 chase (11–15)
- 2 guaranteed hit slots (1 auto, 1 relic) with small chance of dual/auto-patch replacing base hits

### 5.3 Blaster Pack Slots (5 cards)

| Slot | Contents |
|---|---|
| Slot 1–2 | Base or Chrome (80/20) |
| Slot 3 | Any parallel tier 1–8 |
| Slot 4 | Any parallel tier 1–12 |
| Slot 5 | Hit slot: Auto or Relic (50/50) |

### 5.4 Retail Pack Slots (5 cards)

| Slot | Contents |
|---|---|
| Slot 1–3 | Base or Chrome (85/15) |
| Slot 4 | Any parallel tier 1–6 |
| Slot 5 | Any parallel tier 1–10 |

### 5.5 Expected Value Math

**Hobby Box EV calculation example (150-card set, standard theme):**

```
Base card average value:           $0.45
Typical pack contents value:
  3 base/chrome:                   $0.45 × 2 + $0.90 × 1 = $1.80
  1 mid parallel (avg 4×):         $0.45 × 4 = $1.80
  1 hit (avg auto $25):            $25.00
  Pack EV ≈ $28.60
  Box EV ≈ $28.60 × 12 = $343... 
  
  BUT — house edge via heavy base distribution:
  Adjusted realistic pack EV ≈ $8.50–$9.50
  Adjusted box EV ≈ $102–$114
  
  Price: $120 → House edge ~8–15%
```

The system targets **8–18% house edge** to simulate real break-even-to-slight-loss dynamics that keep collectors engaged.

---

## 6. Pricing Algorithm

### 6.1 Base Price Formula

```
basePrice = starTierBasePrice × subsetModifier × demandFactor
```

Where:
- `starTierBasePrice`: From the Star Tier table (Common $0.10 → Legendary $5.00)
- `subsetModifier`: Rookie=1.3×, Legend=1.5×, All-Star=1.2×, Flashback=1.1×
- `demandFactor`: Scaled by how many of that card have been pulled (dynamic, see §6.3)

### 6.2 Parallel Pricing

```
finalPrice = basePrice × parallelMultiplier × specialTypeMultiplier × serialBonus × conditionModifier
```

### 6.3 Serial Number Bonus

For numbered cards, low serial numbers command premiums:

| Serial Range | Bonus |
|---|---|
| /1 | 3.0× |
| /5 (1–5) | 2.5× |
| /10 (1–10) | 2.0× |
| /25 (1–5) | 1.8× |
| /25 (6–25) | 1.3× |
| /50 (1–10) | 1.5× |
| /99 (1–10) | 1.4× |
| Other | 1.0× |

### 6.4 Dynamic Demand Factor

```
demandFactor = max(0.8, min(3.0, expectedPulls / actualPulls + 0.5))
```

- `expectedPulls` = how many should exist based on odds × packs opened
- `actualPulls` = how many have actually been generated
- If a card is "under-pulled" relative to expectations, demand rises
- Floor at 0.8×, ceiling at 3.0×
- This creates natural price volatility: popular characters get traded more, tracked via a `pullCount` field

### 6.5 Condition Modifier

Cards are generated in Near Mint–Mint condition. A small random "condition roll" affects price:

| Condition | Probability | Modifier |
|---|---|---|
| Gem Mint 10 | 5% | 1.3× |
| Mint 9 | 25% | 1.1× |
| NM-MT 8 | 45% | 1.0× |
| NM 7 | 20% | 0.85× |
| EX 6 | 5% | 0.65× |

---

## 7. JSON Schemas

### 7.1 Card Object Schema

```jsonc
{
  "$schema": "Card",
  "type": "object",
  "required": ["cardId", "setName", "setYear", "character", "parallel", "specialType", "serialNumber", "condition", "pullTimestamp"],
  "properties": {
    "cardId": {
      "type": "string",
      "description": "Unique card instance ID, e.g. 'DSE-001-PR7-42/99-NM8'",
      "pattern": "^[A-Z]{3}-\\d{3}-[A-Z]{2}\\d*-\\d+\\/\\d+-.+$"
    },
    "setName": { "type": "string", "description": "Theme set name" },
    "setYear": { "type": "integer" },
    "baseCardNumber": {
      "type": "string",
      "description": "Base card ID in set, e.g. 'DSE-001'"
    },
    "character": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "subset": { "type": "string", "enum": ["Base", "Rookie", "Legend", "AllStar", "Flashback", "Variation", "Novelty"] },
        "starTier": { "type": "string", "enum": ["Common", "Uncommon", "Star", "Superstar", "Legendary"] },
        "description": { "type": "string" },
        "stats": {
          "type": "object",
          "properties": {
            "power": { "type": "integer", "minimum": 1, "maximum": 99 },
            "speed": { "type": "integer", "minimum": 1, "maximum": 99 },
            "technique": { "type": "integer", "minimum": 1, "maximum": 99 },
            "endurance": { "type": "integer", "minimum": 1, "maximum": 99 },
            "charisma": { "type": "integer", "minimum": 1, "maximum": 99 }
          }
        }
      }
    },
    "parallel": {
      "type": "object",
      "properties": {
        "name": { "type": "string", "description": "Parallel tier name" },
        "tier": { "type": "integer", "minimum": 1, "maximum": 18 },
        "odds": { "type": "string", "description": "Pull odds, e.g. '1:36'" },
        "numbered": { "type": "boolean" },
        "serialNumber": { "type": ["string", "null"], "description": "e.g. '42/99'" },
        "priceMultiplier": { "type": "number" }
      }
    },
    "specialType": {
      "type": "string",
      "enum": ["None", "Autograph", "Relic", "DualAuto", "AutoPatch", "Booklet", "Variation", "ErrorVariant", "Novelty", "PrintingPlate"],
      "default": "None"
    },
    "printingPlateColor": {
      "type": ["string", "null"],
      "enum": ["Cyan", "Magenta", "Yellow", "Black", null]
    },
    "condition": {
      "type": "object",
      "properties": {
        "grade": { "type": "number", "minimum": 1, "maximum": 10 },
        "label": { "type": "string" },
        "modifier": { "type": "number" }
      }
    },
    "pricing": {
      "type": "object",
      "properties": {
        "baseValue": { "type": "number" },
        "finalValue": { "type": "number" },
        "demandFactor": { "type": "number" },
        "calculationBreakdown": { "type": "string" }
      }
    },
    "pullTimestamp": { "type": "string", "format": "date-time" },
    "packType": { "type": "string", "enum": ["Hobby", "Blaster", "Retail", "Jumbo", "Mega"] },
    "boxNumber": { "type": "integer", "description": "Sequential box number in session" }
  }
}
```

### 7.2 Collection State Schema

```jsonc
{
  "$schema": "CollectionState",
  "type": "object",
  "required": ["version", "setName", "setYear", "cards", "stats", "created", "lastUpdated"],
  "properties": {
    "version": { "type": "string", "description": "Schema version, e.g. '1.0.0'" },
    "setName": { "type": "string" },
    "setYear": { "type": "integer" },
    "totalBaseCards": { "type": "integer", "description": "Total unique base cards in set" },
    "printRunBoxes": { "type": "integer", "description": "Total hobby boxes in print run" },
    "cards": {
      "type": "array",
      "items": { "$ref": "Card" },
      "description": "All pulled cards in chronological order"
    },
    "uniqueCards": {
      "type": "array",
      "items": { "$ref": "Card" },
      "description": "Best copy of each unique card (baseCardNumber + parallel tier)"
    },
    "pullCounts": {
      "type": "object",
      "description": "Map of baseCardNumber -> pull count for demand tracking",
      "additionalProperties": { "type": "integer" }
    },
    "stats": {
      "type": "object",
      "properties": {
        "totalCardsPulled": { "type": "integer" },
        "totalUniqueCards": { "type": "integer" },
        "setCompletionPercent": { "type": "number" },
        "totalDuplicates": { "type": "integer" },
        "totalCollectionValue": { "type": "number" },
        "totalSpent": { "type": "number" },
        "profitLoss": { "type": "number" },
        "boxesOpened": { "type": "integer" },
        "packsOpened": { "type": "integer" },
        "hitsPulled": { "type": "integer" },
        "oneOfOnesPulled": { "type": "integer" },
        "bestPull": { "$ref": "Card" },
        "parallelBreakdown": {
          "type": "object",
          "description": "Map of parallel name -> count pulled",
          "additionalProperties": { "type": "integer" }
        },
        "subsetCompletion": {
          "type": "object",
          "description": "Map of subset -> unique count / total in subset",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "collected": { "type": "integer" },
              "total": { "type": "integer" },
              "percent": { "type": "number" }
            }
          }
        }
      }
    },
    "created": { "type": "string", "format": "date-time" },
    "lastUpdated": { "type": "string", "format": "date-time" }
  }
}
```

### 7.3 Set Definition Schema (generated by AI per season)

```jsonc
{
  "$schema": "SetDefinition",
  "type": "object",
  "required": ["setName", "setYear", "totalCards", "characters", "printRunBoxes"],
  "properties": {
    "setName": { "type": "string" },
    "setCode": { "type": "string", "pattern": "^[A-Z]{3}$" },
    "setYear": { "type": "integer" },
    "loreSeed": { "type": "string" },
    "totalCards": { "type": "integer", "minimum": 100, "maximum": 200 },
    "printRunBoxes": { "type": "integer", "default": 5000 },
    "characters": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "baseCardNumber": { "type": "string" },
          "name": { "type": "string" },
          "subset": { "type": "string" },
          "starTier": { "type": "string" },
          "description": { "type": "string" },
          "stats": { "type": "object" },
          "rookieFlag": { "type": "boolean" },
          "legendFlag": { "type": "boolean" },
          "allStarFlag": { "type": "boolean" }
        }
      }
    },
    "generatedAt": { "type": "string", "format": "date-time" }
  }
}
```

---

## 8. Theme Generation Parameters

### 8.1 Theme Pool

The system maintains a weighted pool of theme categories. Each season, one is selected (or blended):

| Category | Weight | Examples |
|---|---|---|
| Sci-Fi / Space | 20% | Space Colony Pioneers, Orbital Station Crew, Mars terraformers |
| Fantasy / Myth | 15% | Mythical Beasts: Renaissance, Dragon Riders of Avalon |
| Sports (alt) | 10% | Cyberpunk Street Racing, Zero-G Basketball League |
| Historical | 10% | Renaissance Inventors, WWII Codebreakers, Silk Road Traders |
| Nature / Animals | 10% | Deep Sea Explorers, Rainforest Guardians, Arctic Pack |
| Urban / Modern | 10% | Underground DJs, Street Artists Global, Night Market Chefs |
| Horror / Gothic | 8% | Midnight Paranormal Society, Haunted Mansion Keepers |
| Pop Culture Parody | 7% | Awkward Dating Profiles, Corporate MEME Lords |
| Mecha / Tech | 5% | Mecha Squadron, AI Uprising Survivors |
| Culinary | 5% | Michelin Star Warriors, Street Food Champions |

### 8.2 AI Generation Prompt Template

```
Generate {totalCards} unique characters for the trading card set "{setName}".
Theme: {loreSeed}
Year: {setYear}

Requirements:
- Each character gets a unique name fitting the theme
- Assign one subset per card: {subsetDistribution}
- Assign one star tier per card: {starTierDistribution}
- Give each character 5 stats (power, speed, technique, endurance, charisma) from 40–99
- Write a one-sentence description for each
- Rookies should feel like newcomers; Legends should feel iconic
- Star/Superstar/Legendary characters should have higher average stats (75–95)

Output as JSON array.
```

### 8.3 Subset Distribution Rules

Given `totalCards = N`:
- Rookies: `floor(N × random(0.20, 0.30))`
- Legends: `floor(N × random(0.05, 0.10))`
- All-Stars: `floor(N × random(0.10, 0.15))`
- Flashback: `floor(N × random(0.05, 0.10))`
- Base: remainder

---

## 9. Pack Opening Simulation Flow

```
1. User selects pack type (Hobby/Blaster/Retail/Jumbo/Mega)
2. System deducts cost from virtual wallet
3. For each card slot in the pack:
   a. Roll for special type (auto/relic/etc.) based on slot config
   b. Roll parallel tier using cascading probability
   c. For numbered parallels, roll serial number within range
   d. Select random base card from set (weighted: common cards more likely)
   e. Roll condition grade
   f. Calculate price
   g. Generate card object, add to collection
4. Display results: card images/text, pack value, any notable hits
5. Update collection stats
6. Recalculate demand factors
```

### 9.1 Parallel Roll Algorithm

```python
def roll_parallel(slot_config):
    """Cascading rarity roll from rarest to most common."""
    # Define parallel pool for this slot based on slot_config
    pool = slot_config["allowed_parallels"]  # e.g. tiers 1–10
    
    # Build weighted table (lower odds = higher weight in roll)
    # Sort rarest first for cascading check
    for parallel in sorted(pool, key=lambda p: p["tier"], reverse=True):
        if random() < (1 / parallel["odds"]):
            return parallel
    
    return BASE_PARALLEL  # fallback, majority case
```

---

## 10. Collection Views

### 10.1 Portfolio Summary

```
═══════════════════════════════════════
  📦 COLLECTION PORTFOLIO
  Set: Deep Sea Explorers 2026
═══════════════════════════════════════
  Total Cards:        847
  Unique Cards:       312 / 150 base
  Set Completion:     67.3%
  Duplicates:         535
  
  Total Value:        $2,847.30
  Total Spent:        $3,120.00
  P/L:                -$272.70 (-8.7%)
  
  Boxes Opened:       26
  Hits Pulled:        54
  1/1s Pulled:        1 🏆
  
  Best Pull: Cpt. Marina Voss 1/1 Gold Superfractor
           Value: $4,500.00
═══════════════════════════════════════
```

### 10.2 Set Completion Grid

Visual grid showing which base cards are collected, colored by best parallel owned.

### 10.3 Parallel Breakdown

```
  Base:           412 (48.6%)
  Chrome:         138 (16.3%)
  Purple Shimmer:  67 (7.9%)
  Blue Crackle:    45 (5.3%)
  Gold #:          12 (1.4%)
  Orange Blaze #:   3 (0.4%)
  1/1:              1 (0.1%)
  ...
```

---

## 11. File Structure

```
~/.openclaw/workspace/data/trading-cards/
├── sets/
│   └── {setCode}-{year}.json          # Set definition (characters, theme)
├── collections/
│   └── {username}-{setCode}-{year}.json  # Per-user collection state
├── config.json                         # Global config (wallet, preferences)
└── sessions/
    └── {sessionId}.json                # Pack-opening session logs
```

---

## 12. Implementation Notes

- **Card images**: Generated via AI image generation using parallel-specific style prompts (e.g., "chrome finish card of {character}, holographic border")
- **Wallet**: Virtual currency starting at $1,000. Top up manually. Track spending vs collection value.
- **Trading**: Future feature — peer-to-peer card trades between collections
- **Seasons**: New set every ~2–4 weeks or on demand
- **Random seed**: Each pack uses a seeded RNG for reproducibility / verification
- **Persistence**: All state in JSON files, backed up to daily memory

---

## Category System (v1.1)

### Overview

Sets can have a `setCategory` field that defines what kind of content the cards represent. Categories are additive — the existing character generation is the default, and all pack/market/grading mechanics remain unchanged.

### Categories

| Category | ID | Card Fields | Generation |
|----------|----|-------------|------------|
| Character | `character` | Standard (name, stats, desc) | Original procedural + AI |
| Sports | `sports` | +team, position, sport, jerseyNumber, seasonStats | Procedural per sport + AI |
| Celebrity | `celebrity` | +profession, era, notableWorks, fameScore | Procedural + AI |
| Movie | `movie` | +sceneTitle, sceneDescription, characters, chapter, propertyName | Procedural + AI |
| TV Show | `tv` | +season, episode, (same as movie fields) | Procedural + AI |
| Collection | `collection` | +classification, origin, rarity, theme | Procedural + AI |
| Novelty | `novelty` | +noveltyCategory, viralityScore | Procedural + AI |

### Schema Changes

**Set JSON** — new optional field:
```json
{
  "setCategory": "sports",
  "sport": "basketball",
  "propertySynopsis": "...",
  "collectionTheme": "dinosaurs"
}
```

**Card JSON** — category-specific fields are optional additions:
```json
{
  "num": "001",
  "name": "Marcus Johnson",
  "team": "Thunder Hawks",
  "position": "Point Guard",
  "sport": "basketball",
  "jerseyNumber": 23,
  "seasonStats": {"GP": 72, "PTS": 28, "REB": 7, "AST": 11}
}
```

### Backward Compatibility

Sets without `setCategory` default to `character`. All category-specific fields are optional. Pack opening, parallel selection, grading, pricing, and market simulation are category-agnostic.

### Implementation

- `scripts/categories.js` — Category definitions, generation logic, AI prompt builders, display helpers
- `scripts/card-engine.js` — Integrated via `require('./categories.js')`, `generateSet()` accepts category
- `scripts/ai-set-generator.js` — `--category` flag, category-specific LLM prompts

---

*Document version: 1.1.0*
*Last updated: 2026-03-30*
