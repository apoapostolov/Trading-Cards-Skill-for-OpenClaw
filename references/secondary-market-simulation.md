# Trading Card Secondary Market — Value Degradation & Market Simulation

How cards lose value, why some don't, and how to model a realistic secondary market for a digital card engine.

---

## Part 1: Why Cards Lose Value

### The Natural Degradation Curve

Most trading cards follow a predictable lifecycle. Understanding this is crucial for pricing a virtual economy that *feels* real.

```
Card Value Over Time
$▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
│                                                            ╭──────── HOF spike
│                                         ╭─────── Nostalgia ╯
│              ╭──── Player hot streak     ╯
│    ╭── Hype ╯
│───╯
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────→ Time
0     6mo    1yr    2yr    5yr   10yr   15yr   20yr   25yr   30yr   40yr
  Release  Peak  Cooldown  Decline  Floor  Slow bleed  Flat  Nostalgia bump
```

### Phase 1: Release Hype (0-3 months)
- **What happens:** Set drops, case breaks flood YouTube/Twitch, initial demand outstrips supply
- **Price behavior:** 150-300% of long-term floor for chase cards. Base/commons are already at floor
- **Why:** Speculators buy everything. FOMO. Limited initial supply as product ships
- **Virtual analog:** First 50 "packs opened" by the player base. Prices should be artificially inflated

### Phase 2: Peak (3-12 months)
- **What happens:** The market absorbs supply. Reviews are out. Best cards are identified. The "meta" settles
- **Price behavior:** Chase cards peak here. This is where most selling should happen for profit
- **Key trigger:** Major tournament results, player milestones, viral social media moments
- **Virtual analog:** Once the "set" is established and popular card numbers are known community-wide

### Phase 3: Cooldown (1-3 years)
- **What happens:** Next set releases. Attention shifts. Supply continues entering the secondary market as casual collectors sell
- **Price behavior:** Steady decline. 20-40% off peak for stars. 50-70% off for commons/uncommons
- **The killer:** Continued supply. Every person who stops collecting liquidates. That supply never stops
- **Virtual analog:** Card prices should decay quarterly after the initial hype window

### Phase 4: Floor (3-10 years)
- **What happens:** The card reaches its "base" value. Only collectors buying for PC (personal collection) or set completion drive demand
- **Price behavior:** Relatively flat, slightly declining with inflation
- **What holds value:** Graded PSA 10s of star/legendary cards. Serial-numbered parallels. Rookie cards of future Hall of Famers
- **What doesn't:** Base parallels, commons, non-rookie stars, cards of players who had short careers

### Phase 5: Nostalgia Bump (15-30+ years)
- **What happens:** The kids who collected this set grow up, get disposable income, and want their childhood back
- **Price behavior:** 200-500% increase from floor for iconic cards. Sometimes exceeds original retail
- **The "Jordan Effect":** Cards of transcendent players never really decline — they have multiple nostalgia cycles
- **Virtual analog:** Simulate a "nostalgia event" that temporarily spikes demand for old sets

---

## Part 2: Real-World Degradation Factors

### Supply Pressure (The Biggest Factor)

The #1 reason cards lose value: **supply keeps entering the market forever.**

| Source | Impact | When it matters most |
|--------|--------|---------------------|
| Case breakers opening sealed product | High (new supply) | First 2 years |
| Collections being liquidated | Medium (used supply) | Years 2-10 |
| Reprints/reissues | Variable | Any time |
| Cross-grade arbitrage (buy raw, grade, sell) | Low-Medium | Ongoing |
| Investor sell-off during market downturns | High | During busts |
| Estate sales / inherited collections | Low (but steady) | Years 15+ |

**The math is brutal.** A card with 10,000 base parallels printed:
- Year 1: ~3,000 opened (enters market)
- Year 2-5: ~5,000 more opened
- Year 5-10: Remaining 2,000 trickle in
- Meanwhile, the player pool interested in this card *shrinks* every year

### Player/Subject Performance

In sports cards, the subject's career trajectory is the single biggest demand driver:

| Scenario | Price Impact | Example |
|----------|-------------|---------|
| Rookie sensation / breakout | +200-500% | Shohei Ohtani rookie, Victor Wembanyama |
| MVP / championship season | +100-300% | Patrick Mahomes Super Bowl years |
| Career-ending injury | -40-80% | Any "what could have been" card |
| Scandal / controversy | -30-70% | Josh Gordon, various baseball PED suspensions |
| Hall of Fame induction | +50-150% | Long-term certainty premium |
| Sustained excellence (5+ years) | +50-100% | Consistent All-Stars |
| Retirement | -20-40% (short-term), +30-80% (long-term nostalgia) | Derek Jeter final season |

### Grading Impact on Value Retention

Graded cards retain value better than raw cards. But even graded cards degrade:

| Grade | Value Retention (10-year) | Notes |
|-------|--------------------------|-------|
| PSA 10 | 70-90% of peak | Population growth is the enemy — more PSA 10s exist every year |
| PSA 9 | 50-70% | Large population, less scarce than people think |
| PSA 8 | 40-60% | The "bulk grade" — most common for modern cards |
| PSA 7 | 30-50% | Already discounted from the start |
| PSA 6 or lower | 20-40% | Only matters for vintage key cards |

### The "10-Year Rule"

A widely observed pattern in sports cards: **most modern cards (post-2000) lose 60-80% of their peak value within 10 years** unless the player becomes a Hall of Famer or cultural icon.

Exceptions:
- True 1/1s (only one exists, supply can't increase)
- Short-print variants from small releases
- Cards of players who died young (morbid but real — the "Kobe effect")
- First cards of transcendent talents

### The Hobby Boom-Bust Cycle

The trading card market has gone through several boom-bust cycles:

| Period | Boom | Bust | Trigger |
|--------|------|------|---------|
| 1986-1991 | Junk wax era peak | Massive oversupply crash | Overproduction by every manufacturer |
| 2000-2005 | Internet / eBay enables direct selling | Market saturation | Too much product, eBay democratizes pricing |
| 2016-2021 | COVID boom (people stuck at home, stimulus money) | 2022-2023 correction | Interest rates, economy, supply flood |
| 2024+ | Stabilizing around 2019 levels | TBD | New entrants (Fanatics), shifting collector demographics |

**Key lesson for simulation:** Booms create artificial demand that always corrects. Prices that spike 5x in 6 months usually give back 60-70% of that gain within 2 years.

---

## Part 3: Secondary Market Simulation Model

### Core Variables

Every card in the system tracks these market properties:

```javascript
{
  // Static properties (set at creation)
  basePrice: 0.15,           // Floor price at release
  starTier: "Star",          // Rarity tier
  parallel: "Chrome",        // Parallel type
  serialNumber: 42,          // Serial number (null for non-numbered)
  maxSupply: 5000,           // Theoretical max print run for this parallel

  // Dynamic market properties (updated every market tick)
  currentPrice: 1.20,        // Actual market price
  supplyInMarket: 234,       // How many exist in collections/trading
  totalPulled: 1876,         // How many have been opened from packs
  demandScore: 0.75,         // 0-1 composite demand metric
  trendVelocity: 0.02,       // Rate of price change per tick (positive = rising)
  popScore: 0.5,             // Popularity / "meta" score (0-1)
  lastSoldPrice: 1.18,       // Most recent completed sale price
  salesVolume24h: 12,        // Sales in last 24 ticks
  avgSoldPrice7d: 1.10,      // 7-tick moving average sale price
  marketAge: 45,             // Ticks since release
  peakPrice: 2.50,           // All-time high
  floorPrice: 0.80,          // All-time low (after initial 30 ticks)
  graded: false,             // Whether this specific copy is graded
  grade: null,               // PSA grade if graded
}
```

### Market Tick (Runs Every N Minutes/Hours)

```javascript
function marketTick(card, marketContext) {
  const age = card.marketAge++;

  // 1. Supply enters the market (packs being opened by the "world")
  const newSupply = simulateWorldPulls(card, marketContext);
  card.totalPulled += newSupply;
  card.supplyInMarket += newSupply;

  // 2. Some supply leaves the market (cards in permanent collections)
  const permanentHoldRate = 0.002 + (card.popScore * 0.003);
  card.supplyInMarket -= Math.floor(card.supplyInMarket * permanentHoldRate);

  // 3. Calculate demand
  card.demandScore = calculateDemand(card, marketContext);
  card.popScore = updatePopularity(card, marketContext);

  // 4. Calculate fair value
  const fairValue = calculateFairValue(card);

  // 5. Apply market noise (volatility)
  const noise = (Math.random() - 0.5) * 2 * marketVolatility(card);
  const targetPrice = fairValue + noise;

  // 6. Smooth toward target (prices don't jump instantly)
  card.trendVelocity = (targetPrice - card.currentPrice) * 0.15;
  card.currentPrice = Math.max(card.basePrice * 0.2, card.currentPrice + card.trendVelocity);

  // 7. Track history
  card.floorPrice = Math.min(card.floorPrice, card.currentPrice);
  card.peakPrice = Math.max(card.peakPrice, card.currentPrice);
}
```

### Demand Calculation

```javascript
function calculateDemand(card, context) {
  // Base demand from card quality
  const tierDemand = {
    "Common": 0.05,
    "Uncommon": 0.15,
    "Star": 0.40,
    "Superstar": 0.70,
    "Legendary": 0.90
  };

  let demand = tierDemand[card.starTier] || 0.1;

  // Parallel scarcity boost
  const parallelScarcity = {
    "Base": 0.0,    // No scarcity bonus
    "Chrome": 0.10,
    "Purple Shimmer": 0.15,
    "Blue Crackle": 0.20,
    "Tie-Dye": 0.25,
    "Gold": 0.30,
    "Black Ice": 0.40,
    "Superfractor": 0.60
  };
  demand += parallelScarcity[card.parallel] || 0;

  // Serial number bonus (lower = more desirable)
  if (card.serialNumber) {
    if (card.serialNumber <= 10) demand += 0.25;
    else if (card.serialNumber <= 25) demand += 0.15;
    else if (card.serialNumber <= 50) demand += 0.08;
    else demand += 0.03;
  }

  // Age degradation (demand fades over time)
  const ageInYears = card.marketAge / 365; // if tick = 1 day
  const ageDecay = Math.max(0.15, 1 - (ageInYears * 0.08)); // ~8% decay per year
  demand *= ageDecay;

  // Popularity / meta factor
  demand *= (0.5 + card.popScore * 0.5);

  // Market-wide sentiment
  demand *= context.marketSentiment; // 0.5 = bear market, 1.0 = normal, 1.5 = boom

  // Nostalgia bump (for very old cards)
  if (ageInYears > 15) {
    const nostalgiaFactor = Math.min(1.3, 1 + (ageInYears - 15) * 0.02);
    demand *= nostalgiaFactor;
  }

  return Math.min(1.0, Math.max(0.01, demand));
}
```

### Fair Value Formula

```javascript
function calculateFairValue(card) {
  // Supply-demand equilibrium price
  const supplyFactor = card.supplyInMarket / card.maxSupply;
  const scarcityMultiplier = 1 / Math.max(0.01, supplyFactor);

  // Base: what the card is "worth" intrinsically
  const intrinsicValue = card.basePrice * (scarcityMultiplier * 0.3 + 0.7);

  // Demand premium
  const demandPremium = 1 + (card.demandScore - 0.5) * 2;

  // Recent sales influence (momentum)
  const momentumFactor = 1 + (card.avgSoldPrice7d - card.currentPrice) / card.currentPrice * 0.2;

  return intrinsicValue * demandPremium * momentumFactor;
}
```

### Market Volatility

Different card types have different volatility profiles:

| Card Type | Volatility (daily) | Why |
|-----------|-------------------|-----|
| Legendary Base | 0.01-0.03 | Stable. Everyone knows the value. |
| Legendary Superfractor | 0.05-0.12 | Few comps. Each sale sets the market. |
| Star Chrome | 0.03-0.06 | Moderate liquidity, decent demand |
| Uncommon Base | 0.02-0.04 | Low volume, but prices are stable at floor |
| Common anything | 0.01-0.02 | Nobody trades these. Price barely moves. |

```javascript
function marketVolatility(card) {
  const baseVol = 0.02;
  const tierVol = { "Common": 0.5, "Uncommon": 0.8, "Star": 1.2,
                     "Superstar": 1.5, "Legendary": 1.8 };
  const parVol = { "Base": 0.7, "Chrome": 0.9, "Purple Shimmer": 1.0,
                   "Blue Crackle": 1.1, "Tie-Dye": 1.2, "Gold": 1.4,
                   "Black Ice": 1.6, "Superfractor": 2.0 };
  // Lower supply = higher volatility
  const liquidityFactor = Math.max(0.5, 1 - card.supplyInMarket / card.maxSupply);
  return baseVol * (tierVol[card.starTier] || 1) * (parVol[card.parallel] || 1) * liquidityFactor;
}
```

---

## Part 4: Popularity / "Meta" Simulation

### What Drives Card Popularity

In real sports cards, popularity comes from:

1. **Player performance** — Stats, awards, clutch moments
2. **Cultural relevance** — Social media presence, crossover appeal
3. **Aesthetic appeal** — The card looks cool (parallels, design)
4. **Scarcity narrative** — "Only 99 made" creates perceived value even if demand is low
5. **Community adoption** — If the "meta" (popular deck in Stat Clash, popular PC targets) includes this card

### Popularity Model

```javascript
function updatePopularity(card, context) {
  // Each card gets a "buzz" score that fluctuates
  // Buzz is driven by random events (simulated player performance)

  // Random event check (5% chance per tick of a "moment")
  if (Math.random() < 0.05) {
    const eventType = weightedRandom([
      { type: "hot_streak", weight: 3 },    // Player performing well
      { type: "viral_moment", weight: 1 },   // Social media viral
      { type: "injury", weight: 1 },         // Negative
      { type: "milestone", weight: 0.5 },    // Career milestone
      { type: "trade", weight: 0.5 },        // Team change
      { type: "retirement", weight: 0.2 },   // Career ending
    ]);

    switch (eventType) {
      case "hot_streak":
        card.popScore = Math.min(1.0, card.popScore + 0.05 + Math.random() * 0.1);
        break;
      case "viral_moment":
        card.popScore = Math.min(1.0, card.popScore + 0.15 + Math.random() * 0.15);
        break;
      case "injury":
        card.popScore = Math.max(0.05, card.popScore - 0.1 - Math.random() * 0.1);
        break;
      case "milestone":
        card.popScore = Math.min(1.0, card.popScore + 0.08);
        break;
      case "retirement":
        card.popScore = Math.max(0.05, card.popScore * 0.5); // Immediate drop
        // Schedule nostalgia bump in 50 ticks
        scheduleNostalgiaBump(card, 50);
        break;
    }
  }

  // Natural decay toward mean (popularity fades without events)
  const meanPopularity = { "Common": 0.15, "Uncommon": 0.3, "Star": 0.5,
                            "Superstar": 0.65, "Legendary": 0.75 };
  const target = meanPopularity[card.starTier] || 0.3;
  card.popScore += (target - card.popScore) * 0.02; // Slow mean reversion

  return card.popScore;
}
```

### The "Popular Card Number" Effect

In real card sets, certain card numbers become the "chase" cards that everyone wants. This happens naturally:

- Card #1 (first in set) often has the top player
- Rookie card numbers become iconic
- The card with the best design or most dramatic photo
- Cards featured in advertising or promotional materials

For simulation, assign each card a **"pull priority"** at set creation that influences:
- How often it appears in pack openings (the "god pack" effect)
- How frequently it shows up in community showcases
- Its base popularity score

```javascript
// At set generation time, assign chase scores
function assignChaseScore(card) {
  let score = 0.3; // Base

  // Card #1 always has buzz
  if (card.num === "001") score = 0.8;

  // Legendary cards start popular
  if (card.starTier === "Legendary") score = Math.max(score, 0.7);
  if (card.starTier === "Superstar") score = Math.max(score, 0.55);

  // Top stats make a card desirable for gameplay
  const avgStat = (card.stats.power + card.stats.speed +
                   card.stats.technique + card.stats.endurance) / 4;
  if (avgStat > 85) score = Math.max(score, 0.6);
  else if (avgStat > 75) score = Math.max(score, 0.45);

  // Random element (some mediocre cards randomly become memes)
  if (Math.random() < 0.08) score = 0.5 + Math.random() * 0.3;

  card.popScore = score;
  card.chaseScore = score;
  return score;
}
```

---

## Part 5: Market Events System

The secondary market should have periodic events that create real price movement:

### Event Types

| Event | Trigger | Effect | Duration |
|-------|---------|--------|----------|
| **Hype Wave** | New set release | Existing popular cards dip 10-20% (attention shifts) | 2-4 weeks |
| **Break Flood** | Many packs opened globally | Supply spike, prices dip 5-15% | 1-2 weeks |
| **Player Milestone** | Random event | Specific card spikes 30-80% | 1-3 weeks |
| **Market Crash** | Rare global event | Everything drops 20-40% | 2-6 months |
| **Boom Cycle** | Rare global event | Everything rises 30-100% | 3-12 months |
| **Nostalgia Wave** | Old set triggers | Cards from old set rise 50-200% | 1-3 months |
| **Grading Reveal** | Many cards graded | Graded copies rise, raw copies dip | 2-4 weeks |
| **Buyout** | One player hoards a card | That card spikes 50-200% | Until supply returns |

### Event Implementation

```javascript
function generateMarketEvent(context) {
  const ageInMonths = context.currentTick / 30;

  // Monthly event roll
  const events = [];

  // Break flood (common, 15% per month)
  if (Math.random() < 0.15) {
    events.push({
      type: "break_flood",
      magnitude: 0.05 + Math.random() * 0.15,
      duration: 7 + Math.floor(Math.random() * 14),
      description: "Large case break floods the market with supply"
    });
  }

  // Player milestone (per card, 3% per month)
  const allCards = context.allCards;
  for (const card of allCards) {
    if (Math.random() < 0.03 * card.popScore) {
      events.push({
        type: "player_milestone",
        targetCard: card.cardNum,
        magnitude: 0.3 + Math.random() * 0.5,
        duration: 7 + Math.floor(Math.random() * 21),
        description: `${card.name} has a career-defining moment`
      });
    }
  }

  // Boom/Bust (very rare, 1% per month each)
  if (Math.random() < 0.01) {
    const isBoom = Math.random() < 0.5;
    events.push({
      type: isBoom ? "boom" : "crash",
      magnitude: isBoom ? 0.3 + Math.random() * 0.7 : 0.2 + Math.random() * 0.2,
      duration: 60 + Math.floor(Math.random() * 180),
      description: isBoom
        ? "A new wave of collectors enters the hobby"
        : "Market correction as investors liquidate positions"
    });
  }

  // Nostalgia trigger (for sets older than 12 months, 2% per month)
  if (ageInMonths > 12 && Math.random() < 0.02) {
    events.push({
      type: "nostalgia_wave",
      magnitude: 0.5 + Math.random() * 1.5,
      duration: 30 + Math.floor(Math.random() * 90),
      description: "Nostalgia content goes viral — collectors return for their childhood sets"
    });
  }

  return events;
}
```

---

## Part 6: Price Display & Market UI

### What Players Should See

A realistic secondary market interface shows:

```
═══════════════════════════════════════════════════════════
  📈 MARKET — BOC-039 The Node Pairer (⭐ Star)
═══════════════════════════════════════════════════════════

  Current Price:    $1.44
  24h Change:       ▲ +$0.08 (+5.9%)
  7d Average:       $1.35
  7d Trend:         ↗ Rising
  All-Time High:    $2.50 (45 ticks ago)
  All-Time Low:     $0.80 (120 ticks ago)

  Supply in Market: 234 / 5,000
  Popularity:       ████████░░ 78% (Hot)
  Demand:           ██████████ 94% (Very High)

  Recent Sales:
    2 ticks ago  — $1.42  Base PSA 8
    5 ticks ago  — $1.50  Chrome PSA 9
    12 ticks ago — $1.38  Base PSA 7
    18 ticks ago — $1.35  Base PSA 8
    25 ticks ago — $1.40  Purple Shimmer PSA 8

  ══════════════════════════════════════════
  Price Chart (last 30 ticks):
  $1.60 ┤                          ╭╮
  $1.50 ┤                     ╭───╯ ╰──╮
  $1.40 ┤              ╭──╮──╯        ╰──╮
  $1.30 ┤        ╭───╮╯                     ╰╮
  $1.20 ┤   ╭───╯                             ╰─
  $1.10 ┤╭──╯
  $1.00 ┼╯
       └─┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──→
        0  3  6  9  12 15 18 21 24 27 30
═══════════════════════════════════════════════════════════
```

### Market Aggregation

Top Movers (daily):
```
  📈 BIGGEST GAINERS           📉 BIGGEST LOSERS
  ──────────────────           ─────────────────
  +34% BOC-023 The Perm...     -12% BOC-088 Desktop Ic...
  +28% BOC-067 The "Reply...   -8%  BOC-134 The emoji...
  +22% BOC-142 The tab c...    -5%  BOC-079 The Sound...
  +18% BOC-039 The Node P...   -3%  BOC-085 Incognito...
```

---

## Part 7: Integration Points for Card Engine

### Changes Needed

1. **Card object** — Add `marketPrice`, `popScore`, `demandScore`, `supplyInMarket`, `totalPulled`, `marketAge`, `peakPrice`, `floorPrice`, `salesHistory[]`

2. **`market tick` command** — Runs the simulation forward by N ticks. Should run automatically at set intervals (daily?) or on demand

3. **`market` command** — Shows market dashboard: top movers, your portfolio value change, trending cards

4. **`market <card-num>`** — Individual card market page with chart, sales, supply info

5. **`sell` command update** — Sell price should use `marketPrice` instead of static `price`. Add a "sell order" option (list at asking price, wait for buyer)

6. **Pack pricing** — Base card prices should update based on market simulation, so the same card type from the same pack has different expected value over time

7. **Collection value** — Show both "book value" (current market price × quantity) and "purchase price" (what you paid)

### Market Tick Frequency

| Game Style | Tick Rate | Tick = | Notes |
|-----------|-----------|--------|-------|
| Casual | On demand | 1 day | Player runs `market tick` manually |
| Active | Every 6 hours | 1 day | Auto-tick via cron, prices move while you sleep |
| Hyper | Every hour | 1 day | Fast-paced market, but may feel artificial |

Recommended: **1 tick = 1 day, auto-run at midnight server time**. This gives:
- Noticeable weekly price movement (~3-7% swings)
- Monthly trends visible
- "Seasons" emerge naturally over 3-6 months
- Yearly nostalgia cycles possible

### Quick Start Implementation

Minimum viable market simulation in 3 steps:

1. **Add market fields to card schema** at pull time
2. **Write `marketTick()`** — runs for every card in the active set, updates prices
3. **Hook into `sell`** — sell price = `card.marketPrice`, not static `card.price`

Everything else (charts, events, buy orders) can be added incrementally.

---

## Sources & References

- Sports Card Investor: Price trend analysis methodology
- PSA Population Reports: Supply estimation from grading counts
- eBay Completed Listings: Real-world price discovery mechanics
- COMC / PWCC Marketplace: Professional market-making dynamics
- r/baseballcards, r/sportscards: Collector sentiment and market observation
- "The Card" by James D. Sutherland: History of sports card market
- PWCC Monthly Market Report: Price index tracking methodology
- Tokenized card platforms (CourtCards, etc.): Real-time pricing models
