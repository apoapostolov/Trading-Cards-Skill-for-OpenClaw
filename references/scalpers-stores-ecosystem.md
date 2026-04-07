# Scalpers, Online Sales & Hobby Store Ecosystem — Reference Document

> Research compiled 2026-03-30 for the trading card engine.
> Covers real-world distribution, economics, scalping, and implementation proposals.

---

# Part 1: The Purchase Ecosystem

## Distribution Chain

### The Chain

```
Manufacturer → Authorized Distributor → Hobby Store / Online Retailer → Consumer
```

Manufacturers (Topps, Panini, Upper Deck, Wizards of the Coast / Hasbro, The Pokémon Company) do not sell direct to hobby stores at meaningful volume. Instead they funnel product through a small number of authorized wholesale distributors who then resell to retail accounts.

### Major US Distributors

| Distributor | Notes |
|---|---|
| **GTS Distribution** | Formed from 2005 merger of Talkin' Sports + Gamus. Serves retail accounts only (no public sales). One of the two dominant distributors. |
| **Gold River Distributors** | Other dominant distributor. Publishes weekly inventory updates Monday; most new releases are allocated. |
| **ACD Distribution** | Known for competitive pricing on Pokémon product. Requires bank references on application. |
| **Southern Hobby Supply** | Regional strength in the Southeast US. |
| **Peach State Hobby Distribution** | Georgia-based, covers sports cards and TCGs. |
| **Magazine Exchange** | Long-standing distributor, strong in sports cards. |
| **AMES / Alliance Game Distributors** | More tabletop/RPG focused but carries TCG sealed product. |

### How Distributor Allocation Works

- **Relationship-based**: New accounts start with zero or minimal allocation on hot product. Distributors prioritize stores with years of purchase history and consistent order volume across their entire catalog (not just hot product).
- **Tiered accounts**: Distributors internally rank stores. A store ordering $50K/month across all categories gets better allocation than one ordering $20K that's 80% hot product.
- **Most new releases are allocated**: Gold River explicitly states this. Stores rarely get their full requested quantity of hot product.
- **Pricing fluctuates**: Distributors adjust prices weekly based on market demand. A hobby box at MSRP $120 might cost the store $95 from the distributor on a slow release, or $115+ on a hyped release (erasing the margin).
- **Application barriers**: Distributors require proof of retail presence (physical store, business license, tax ID, bank references). New stores get rejected because publishers want established retail channels, not pop-up flippers.

### Big Box vs Hobby Channel

- **Target, Walmart, Costco, Meijer** buy direct from manufacturers at massive scale. They negotiate bulk pricing that hobby stores can't touch. A $4.99 Pokémon ETB at Target was purchased at a volume discount far below what distributors charge LCS.
- **Hobby channel** gets product that is often identical SKU but through distributors, at higher cost. The trade-off: hobby stores get "hobby-exclusive" products (Hobby Boxes with different hit rates, exclusive parallels) that big box doesn't carry.
- **Manufacturers depend on both**: Big box provides volume/visibility; hobby stores provide the collector community, events, and long-term ecosystem health.

### Direct-to-Consumer

- **Topps.com** sells directly (MLB cards, Star Wars cards). Often has exclusive products or early access windows.
- **Panini Direct** sells NBA/NFL cards direct with exclusive parallels and memorabilia cards.
- **Pokémon Center** sells TCG directly with exclusive product (promo packs, special sets).
- **MTG Wizards Store** sells some product direct, though WotC's direct presence is smaller.
- DTC cuts out the middleman but inventory is limited and sells out fast — effectively another scalping battleground.

---

## Hobby Store (LCS) Economics

### Margins on Sealed Product

- **Typical margin at MSRP: ~30%**. A $120 hobby box costs ~$80-90 from the distributor.
- **Hot product destroys this margin**: On hyped releases, distributors raise wholesale prices. A $120 MSRP box might cost the store $105-115, leaving $5-15 margin (4-12%).
- **Cold product is where the margin lives**: Slower-selling product maintains the full ~30% spread.
- **Many stores sell above MSRP** for hot product to preserve margin, which angers collectors but is economically necessary.

### The Subsidization Model

Hot products subsidize everything else:

- Hot product: low margin per unit, high velocity, drives foot traffic
- Cold product: good margin, sits on shelf, ties up capital
- Singles: high margin (50-200% markup), labor-intensive, requires market knowledge
- The store needs hot product to exist (brings people in), but the real profit comes from singles, supplies, and events

### Revenue Streams

| Stream | Typical Margin | Notes |
|---|---|---|
| Sealed product (hobby boxes) | 10-30% | Volume driver, not the profit center |
| Singles sales | 50-200% | High labor, high margin |
| Events/tournaments | Entry fees + in-store sales | Builds community, drives singles sales |
| Supplies (sleeves, binders, toploaders) | 40-60% | Reliable, reorder business |
| Buying/selling collections | Variable (often 40-60% of resale) | Requires cash reserves and grading knowledge |
| Group breaks / break room | 15-25% of box value as "host fee" | Growing revenue stream |
| Online sales (eBay, TCPlayer, website) | 20-40% | After shipping, fees, and labor |

### Break Room Culture

Group breaks have become a major revenue stream for many stores:

- A store buys a case (6-12 boxes), charges per team/spot
- A 12-box NFL hobby case might cost the store ~$900; spots sell for $80-120 each, earning $960-1440
- The host keeps the "commons" (non-hit cards) which they can sell as bulk or list individually
- Live-streamed breaks on YouTube/Twitch drive additional audience and can build a following
- Major break hosts (like Layton Sports Cards) generate significant revenue from YouTube alone

### The Costco/Target Arbitrage

Some store owners buy product at big-box retail (Costco, Target, Sam's Club) when it's priced below distributor cost, then resell at or near MSRP in their store. This is especially common with Pokémon product where big-box exclusive ETBs or tins have lower pricing than equivalent hobby-channel products.

### Overhead Costs

Typical monthly costs for a small-to-medium LCS (1,000-2,000 sq ft):

| Expense | Monthly Range |
|---|---|
| Rent | $1,500 - $5,000+ (varies hugely by location) |
| Utilities | $300 - $800 |
| Employee wages (1-3 part-time) | $2,000 - $6,000 |
| Insurance | $200 - $500 |
| Credit card processing (2.5-3%) | $500 - $2,000 |
| Inventory/COGS | $10,000 - $40,000 |
| Marketing/events | $200 - $1,000 |

### Typical Store Financials

- **Monthly revenue**: $15,000 - $60,000 for a healthy small LCS
- **Net profit margin**: 5-15% after all expenses
- **Inventory investment**: Often $50K-200K tied up in sealed product and singles
- **Cash flow challenge**: Stores must pre-order product months in advance, pay upfront or Net-30, and hope the product sells before the next invoice

### Store Types

1. **Hobby-focused**: Emphasis on community, events, play space. Lower revenue but loyal customer base.
2. **Retail-forward**: High inventory turnover, online presence, break rooms. Higher revenue, more transactional.
3. **Hybrid**: Sells sports cards, TCGs, comics, tabletop, memorabilia. Diversified but requires broader expertise.
4. **Online-only**: No physical store. Operates via website, eBay, COMC, social media. Lower overhead but higher competition.

### Why LCS Owners Are NOT the Enemy

The narrative that "stores are scalpers" misses the reality:

- Stores pay above MSRP to distributors for hot product just to get it
- They're forced to sell above MSRP or break even
- They're competing with Target/Walmart who get better wholesale pricing
- They provide the community space, events, and marketplace for singles
- A store going out of business hurts collectors more than slightly above-MSRP pricing
- Most store owners are collectors themselves operating on thin margins

---

## Scalpers (Detailed)

### Types of Scalpers

1. **Individual Opportunists**: Buy 2-3 boxes of hot product at retail to flip. Low volume, casual approach. Probably the largest group by count.
2. **Organized Groups**: Teams of 3-10 people coordinating buying across multiple stores, regions, and online platforms. Share information via Discord/Telegram.
3. **Bot Operators**: Use automated software to buy online inventory the instant it drops. Can clean out entire online allocations in seconds.
4. **Case Breakers for Profit**: Buy cases wholesale (some have distributor accounts or buy from stores), break on stream, sell singles/high-value hits. Often legitimate businesses, but the economics overlap with scalping.
5. **Store-Connected Scalpers**: Have relationships with store employees who hold product for them or tip them off about restocks.

### Bot Technology

- **Browser automation**: Selenium, Puppeteer, Playwright scripts that monitor product pages and auto-checkout.
- **Checkout bots**: Dedicated tools (like Phantom, Kodama) optimized for specific platforms (Topps.com, Panini Direct, Target.com).
- **Inventory monitoring**: Scripts that ping store APIs to detect when out-of-stock items become available.
- **Account farms**: Hundreds of burner accounts to bypass purchase limits.
- **Proxy networks**: Rotate IPs to avoid detection and rate limiting.
- **Speed advantage**: A bot can complete a checkout in 1-3 seconds versus 15-30 seconds for a human.

### Physical Strategies

- **Midnight runs**: Show up at Target/Walmart at midnight or 6 AM when truck deliveries arrive and product hits shelves.
- **Mule networks**: Pay friends/family to buy product at their local stores, each within purchase limits.
- **Store relationships**: Tip store employees, buy other product regularly to build goodwill.
- **Geographic spread**: Drive across a metro area hitting 5-10 stores in one trip.
- **Line sitting**: Physically wait in line for exclusive product drops.

### Platforms for Resale

| Platform | Fee Structure | Best For |
|---|---|---|
| **eBay** | 12.9% + $0.30 | Everything. Largest audience. |
| **COMC** | Commission-based, seller sets price | Singles, set building. No listing effort. |
| **StockX** | Transaction fee ~10-12% + shipping | Graded cards, verified authenticity. |
| **PWCC** | 20% buyer premium (seller pays from sale price) | High-end vintage and modern. |
| **Cardmarket** | 5% + €0.10 per sale | EU market. Dominant in Europe. |
| **Mercari** | 10% selling fee | Low-cost singles, bulk. |
| **Facebook Marketplace** | Free (but risky) | Local deals, bulk lots. |
| **TCGPlayer** | 10.25% + $0.30 | TCG singles. Direct competition for stores. |

### The Scalper Math: Expected Value of Case Breaking

A typical sports card hobby box (e.g., Bowman Chrome Baseball, Panini Prizm Basketball):

**Box EV Example (Panini Prizm Basketball Hobby, ~$300 MSRP):**

| Content | Frequency | Approximate Value |
|---|---|---|
| Base/inserts (bulk) | ~95% of cards | $10-30 (bulk resale) |
| Silver Prizms | 1-2 per box | $5-15 each |
| Color Prizms (non-numbered) | 2-4 per box | $10-50 each |
| Numbered parallels | 1 per 2-3 boxes | $30-200 |
| Autographs | 1 per 2-3 boxes | $50-500+ |
| Silver Prizm PSA 10 candidates | 5-10 per box | Grading +$20-50 value each |
| **Total realistic EV** | | **$150-400** |

- At $300 box cost, EV is roughly $150-400 → **negative to breakeven on average**
- The variance is massive: a box with a Trout/Suka auto can return $1,000+, while most boxes return $150-200
- **This is why case breaking exists**: breaking a full case smooths variance. A case hit (1 per case) might be worth $500-5,000+, subsidizing the weak boxes.

### How Grading Amplifies Profits

A raw card worth $20 can be worth:
- PSA 9: $30-50
- PSA 10: $80-200 (4-10x multiplier for the right card)

For high-end cards, the multiplier is even more extreme:
- A $500 raw modern rookie card → PSA 10 could be $2,000-5,000
- Grading cost: ~$20-30 (bulk) to $150+ (express)
- **Grading ROI on the right card is enormous**, which drives mass submissions

The strategy:
1. Buy boxes/cases or raw singles
2. Identify PSA 10 candidates (centering, edges, corners)
3. Submit bulk (cheapest per card)
4. Grade 10s sell for 3-10x raw value
5. Grade 9s sell for modest premium
6. Grade 8 and below: sell at/near raw value or crack and resubmit

### Social Media Scalping

- **Twitter/X**: "Card Twitter" has accounts that post instant alerts when product drops online. Followers race to buy.
- **Discord groups**: Paid and free groups with bot-integrated alerts, buying coordination, and market analysis. Some have 10,000+ members.
- **Telegram**: Signal groups for specific platforms (Target drops, Topps.com drops).
- **YouTube/Twitch**: Break hosts drive hype and demand, indirectly inflating prices.
- **Reddit**: r/sportscards, r/PokemonTCG, r/BaseballCards — communities that both discuss and enable flipping.

### The Group Break Host as Scalper/Entrepreneur

Group break hosts occupy a gray zone:

- They buy product at wholesale (sometimes distributor-direct with a legit account)
- They charge per spot (team, player, division, number)
- They keep all unsold spots + all non-hit cards
- They generate additional revenue from YouTube/Twitch monetization
- **Legitimate business model** — but the host's retained cards (commons, unsold spots) are essentially free inventory they can resell
- Top hosts (Layton Sports Cards, Jaspy's, Chesapeake Sports Cards) generate millions in annual revenue

---

## The Economics of a Break

### Detailed EV Calculation

**Example: 2024 Bowman Chrome Baseball Hobby Case (12 boxes, ~$1,800 case cost)**

| Outcome | Probability | Value |
|---|---|---|
| Case hit (1st Bowman Auto of top prospect) | ~30% | $500-5,000 |
| Multiple numbered autographs | ~60% | $200-800 total |
| Chrome refractor parallels | ~90% | $50-300 total |
| Base/insert bulk | 100% | $50-150 |
| PSA 10-worthy cards (if graded) | ~50 cards | $100-400 (grading cost deducted) |

**Expected case value: ~$1,200-2,500**
**Case cost: ~$1,800**
**Expected profit: -$600 to +$700**

The distribution is heavily right-skewed: most cases lose money or break even, but a case with a top-tier case hit (e.g., a Wander Franco 1st Bowman Auto superfractor) can return $10,000-100,000.

### Variance and the "Lottery" Feel

- A single box is essentially a lottery ticket
- A case smooths variance but still has significant swings
- Only with 10+ cases does the law of large numbers start to stabilize
- This variance is what makes breaks exciting to watch and participate in
- **The house edge exists**: manufacturers design print runs and hit rates to ensure expected value is below cost on average

### When Breaking Is Profitable vs Gambling

**Profitable when:**
- You're a host collecting fees (host takes a cut regardless of outcomes)
- You have bulk grading costs ($15-20/card) and identify many PSA 10 candidates
- You sell singles at market price efficiently (through established channels)
- You buy cases at or below distributor cost

**Gambling when:**
- You buy boxes at MSRP or above and keep everything (no host fees, no singles channel)
- You don't grade or grade inefficiently
- You chase hyped product after prices have already spiked
- You break for "fun" without tracking EV

### Case Hits and Master Case Hits

- **Case hit**: The best hit in a standard case (1 case = manufacturer-defined number of boxes). In Bowman Chrome, this is typically a 1st Bowman Auto. Value: $100-5,000+.
- **Master case hit**: The best hit across an even larger unit (e.g., 6 cases = a master case). These are rarer and more valuable: $500-50,000+.
- **Short prints / super short prints**: Cards inserted at 1:100+ pack odds. Can be worth more than autographs.

### Grading Strategy

**Which cards to grade:**

1. **High-value rookies / 1st Bowmans**: Always grade. PSA 10 multiplier justifies the cost.
2. **Chrome / refractor parallels**: Worth grading if raw value > $30.
3. **Base cards**: Only grade if you have bulk submission and the card has a meaningful PSA 10 premium.
4. **Vintage**: Almost always worth grading (condition-sensitive, huge multipliers).
5. **Damaged cards**: Don't grade. Obvious but people do it anyway.

**Cost-benefit:**
- Grading cost: $20-30/card (bulk/standard), $50-150/card (express)
- Card must have raw value > ~$30-50 to justify standard grading
- Card must have raw value > ~$100 to justify express grading
- Expected PSA 10 rate for fresh-from-pack modern cards: ~15-25% (varies by product)

### Tax Implications (US)

- **Hobby income**: If the IRS considers you a hobbyist, you can deduct expenses up to income but can't claim a loss. No self-employment tax.
- **Business income**: If you're "engaged in a trade or business" (regular, continuous activity with profit motive), you report on Schedule C. You can deduct all ordinary and necessary expenses. Subject to self-employment tax (15.3%).
- **The line is blurry**: The IRS looks at frequency, profit motive, expertise, and time invested.
- **Capital gains**: Cards held as collectibles for >1 year are taxed at 28% max rate (not the standard 15/20% LTCG rate).
- **State sales tax**: Applies to most in-state sales; online sales nexus rules vary by state post-Wayfair decision.
- **1099-K reporting**: Payment processors (PayPal, eBay Managed Payments) report transactions over $600/year (threshold changed from $20K).

---

# Part 2: Implementation Proposals

> These proposals target the trading card engine at `~/.openclaw/workspace/skills/trading-cards/`.

---

## Proposal 1: Store System

### Description
Virtual hobby stores where the player can purchase sealed product, singles, and supplies. Each store has its own inventory, pricing strategy, allocation rules, and relationship system with the player.

### Store Types
| Type | Characteristics |
|---|---|
| **LCS (Local Hobby Store)** | Limited inventory, relationship-based allocation, hosts events. Sells above/below MSRP depending on demand. |
| **Big Box (Target/Walmart/Costco)** | Large inventory of mainstream product, strict purchase limits, no hobby exclusives, lower prices. |
| **Online Retailer** | Large catalog, competitive pricing, shipping delays, purchase limits, stock-out events. |

### Key Mechanics
- **Inventory**: Each store has finite stock per product. Stock refreshes on schedules (weekly, biweekly).
- **Pricing**: Base price + markup. Hot product markup increases with demand. Stores track sell-through rates.
- **Allocation**: On hyped releases, stores receive limited stock. Player relationship tier determines if they get allocated stock.
- **Purchase limits**: Per-customer limits per release (1-5 boxes). Store-dependent.
- **Relationship system**: Player builds loyalty by buying regularly, attending events, not reselling (tracked implicitly). Higher tier = better allocation, early access, better pricing.
- **Sell-out events**: Hot product can sell out within hours (simulated). Creates urgency.

### Suggested Commands
```
/store list                    — List available stores
/store visit <store_id>        — Browse a store's inventory
/store buy <product> [qty]     — Buy sealed product
/store singles [player|set]    — Browse available singles
/store singles buy <card_id>   — Buy a specific single
/store reputation              — Check your relationship status
/store events                  — View upcoming events
```

### Data Model Changes
```typescript
interface Store {
  id: string;
  name: string;
  type: 'lcs' | 'bigbox' | 'online';
  location: string;
  inventory: StoreInventory[];  // product_id → quantity, restock_date
  pricing: PricingStrategy;     // markup_percent, dynamic_pricing
  purchaseLimits: Record<string, number>; // product_id → max per customer
  relationshipTiers: { minPurchases: number; minSpent: number };
  restockSchedule: 'weekly' | 'biweekly' | 'monthly' | 'event';
  eventSchedule: Event[];
}

interface PlayerStoreRelation {
  storeId: string;
  totalPurchases: number;
  totalSpent: number;
  tier: number;  // 1-5
  purchaseHistory: PurchaseRecord[];
  lastVisit: Date;
}
```

### Complexity: **Medium**
The store system is straightforward to model but needs careful balance of inventory, pricing, and relationship progression.

### Priority: **High** — Core to making the purchase ecosystem feel real.

---

## Proposal 2: Scalper NPC System

### Description
AI scalper NPCs that exist in the same market as the player. They compete for hot product, drive up prices, and create realistic market dynamics. The player interacts with scalpers indirectly (seeing their impact) and sometimes directly (buying from them, competing for product).

### Scalper Tiers
| Tier | Behavior | Impact |
|---|---|---|
| **Casual Flipper** | Buys 1-2 boxes of hot product. Lists on marketplace at 20-40% markup. | Mild competition. |
| **Store Scout** | Monitors multiple stores, buys within limits across stores. Medium markup. | Noticeable stock reduction. |
| **Organized Group** | Coordinated buying, multiple store relationships. Aggressive pricing. | Significant stock competition. |
| **Bot Network** | Instantaneous online purchases. Can clean out online stores. Maximum markup. | Dominates online drops. |

### Key Mechanics
- **Competition**: When the player and a scalper both try to buy from the same store, the scalper may get the last copies.
- **Price signals**: After scalpers buy product, marketplace prices increase. Player sees "sold out" items.
- **Scalper inventory**: Scalpers list cards on the secondary market at markup. Player can buy from them (expensive) or find product elsewhere.
- **Anti-scalper systems**: Stores implement purchase limits, lottery draws, queue systems. Player benefits from these just like real collectors do.
- **Scalper detection**: Player can "report" suspicious behavior, influencing how stores handle scalping.

### Suggested Commands
```
/market scalpers               — See current scalper activity and price impact
/market scalper <name>         — View a specific scalper's listings
/market buy <card_id>          — Buy from secondary market (may be scalper-priced)
/alert scalper                 — Set alert for when scalper buys out a product
```

### Data Model Changes
```typescript
interface ScalperNPC {
  id: string;
  name: string;
  tier: 'casual' | 'scout' | 'organized' | 'bot';
  strategy: ScalperStrategy;   // target_products, markup_range, aggressiveness
  cash: number;
  inventory: CardInstance[];    // cards they hold
  listings: MarketplaceListing[]; // cards they've listed for sale
  storePreferences: string[];  // which stores they target
  activityLog: ScalperAction[];
}

interface ScalperStrategy {
  targetValueRange: [number, number]; // raw card value they chase
  markupRange: [number, number];       // 1.2x - 3.0x
  purchaseFrequency: 'daily' | 'weekly' | 'event-driven';
  botSpeed: number;                    // 0-1, reaction speed for online drops
  networkSize: number;                 // number of "mules" (purchase limit multiplier)
}
```

### Complexity: **Medium**
Scalper behavior is a simulation layer on top of the store/market system. Not complex in isolation but needs tuning.

### Priority: **Medium** — Adds realism but can ship without it. Implement after Store and Market systems.

---

## Proposal 3: Advanced Market Simulation

### Description
A full supply-chain-to-shelf simulation model. Product is "printed" by manufacturers, allocated to distributors, sent to stores, and purchased by players/scalpers. The secondary market tracks real-time price discovery.

### Supply Chain Flow
```
Manufacturer Print Run → Distributor Allocation → Store Inventory → Consumer Purchase → Secondary Market
```

### Key Mechanics

1. **Print Run Simulation**: Each product release has a print run size (casual: 500K boxes, hyped: 100K boxes, limited: 20K boxes). This determines total market supply.

2. **Distributor Allocation**: Stores receive allocation based on their relationship tier and distributor rank. Larger/older stores get more.

3. **Store Inventory**: Stores stock based on allocation. Hot product sells out fast; cold product lingers.

4. **Demand Modeling**:
   - Player popularity: High-popularity player cards are worth more
   - Set hype: New releases have hype curves (pre-release → launch → 2-week peak → decline → stabilization)
   - Market sentiment: Influenced by real-world events (player performance, retirement, scandal)
   - Speculation: Demand spikes when price is rising (momentum trading)

5. **Price Discovery**:
   - eBay-style auction house for high-end cards
   - COMC-style fixed-price marketplace for singles
   - Completed listing data feeds price guides
   - Bid/ask spread based on supply/demand

6. **Events**:
   - **Flash sales**: Stores discount cold product to clear inventory
   - **Restock events**: Unexpected restocks of sold-out product (small quantities)
   - **Sell-out events**: Hot product depletes, prices spike on secondary market
   - **Price crashes**: When print runs are larger than expected or hype fades

### Suggested Commands
```
/market prices [card|set|player] — View current market prices
/market history <card_id>        — Price history chart (data)
/market auction                  — List/browse auctions
/market auction bid <id> <price> — Place a bid
/market search <query>           — Search fixed-price marketplace
/market sell <card_id> <price>   — List a card for sale
/market demand                   — View market sentiment indicators
/market supply <product>         — View supply chain status
```

### Data Model Changes
```typescript
interface ProductRelease {
  id: string;
  printRun: number;             // total boxes printed
  releaseDate: Date;
  hypeLevel: number;            // 0-1
  boxConfig: BoxConfig;         // hit rates, card distribution
  currentPhase: 'prerelease' | 'launch' | 'peak' | 'decline' | 'stable';
}

interface MarketPrice {
  cardId: string;
  rawPrice: number;             // ungraded
  pricesByGrade: Record<number, number>; // grade → price
  priceHistory: { date: Date; price: number }[];
  supply: number;               // cards on market
  demand: number;               // abstract demand index
  bidAskSpread: { bid: number; ask: number };
}

interface Auction {
  id: string;
  cardId: string;
  seller: string;               // player or NPC
  currentBid: number;
  minBid: number;
  buyItNow?: number;
  endTime: Date;
  bids: { bidder: string; amount: number; time: Date }[];
}
```

### Complexity: **Hard**
Full market simulation requires careful tuning of supply/demand models, price discovery algorithms, and event triggers. This is the most ambitious proposal.

### Priority: **High** — But implement incrementally. Start with basic price tracking, add supply chain and auction later.

---

## Proposal 4: Collection Acquisition Methods

### Description
Multiple paths to acquire cards beyond "open a pack from the void." Players navigate the full ecosystem of buying, trading, winning, and discovering.

### Acquisition Methods

1. **Buy Sealed Product from Stores** (Proposal 1)
   - Standard hobby boxes, blasters, HTA boxes, retail exclusives
   - Each store has different inventory and pricing
   - Player must manage budget vs expected value

2. **Buy Singles at Market Price** (Proposal 3)
   - From other collectors, store display cases, online marketplace
   - Pay market rate but guaranteed specific card
   - Best strategy for completing sets

3. **Trade Cards**
   - Trade with NPC collectors (each has wants/needs)
   - Trade with other players (if multiplayer)
   - Trade value tracking (fairness indicator)
   - Trade up: multiple lower-value cards for one higher-value card

4. **Win Cards in Tournaments/Events**
   - Prize packs for participating
   - Guaranteed prize cards for winning
   - Store credit / gift cards as prizes
   - Builds collection while building skills

5. **Collection Lots**
   - Buy a random collection from an NPC who's "getting out of the hobby"
   - Random assortment of cards, some hidden gems
   - Cheaper per card but unpredictable
   - Requires sorting/evaluating skills

6. **Consignment**
   - List cards at your price on the marketplace
   - Wait for buyers (may take days/weeks in-game)
   - Marketplace takes a cut
   - Compare to instant-sell (lower price but immediate)

### Suggested Commands
```
/collection                      — View your collection
/collection wantlist add <card>  — Add to wantlist
/collection wantlist             — View wantlist
/trade offer <npc> <give> <get>  — Propose a trade
/trade counter <id>              — Counter a trade offer
/collection lot buy <npc>        — Buy a collection lot
/collection sell <card> <price>  — List card for consignment sale
/collection sell instant <card>  — Instant sell at market price (lower)
/event register <event_id>       — Register for a tournament/event
```

### Data Model Changes
```typescript
interface CollectionLot {
  id: string;
  seller: string;              // NPC name
  price: number;
  description: string;
  estimatedCards: number;
  estimatedValue: number;      // rough estimate (may be inaccurate)
  hiddenGems: boolean;         // chance of high-value cards
  contents?: CardInstance[];   // revealed after purchase
}

interface TradeOffer {
  id: string;
  from: string;                // player or NPC
  to: string;
  offered: CardInstance[];
  requested: CardInstance[];
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  fairnessScore: number;       // 0-1, based on market values
}

interface ConsignmentListing {
  id: string;
  cardId: string;
  seller: string;
  askingPrice: number;
  listedDate: Date;
  marketplaceFee: number;      // percentage
  views: number;
  offers: { buyer: string; amount: number; date: Date }[];
}
```

### Complexity: **Medium**
Each method is individually simple. The challenge is integrating them all into a cohesive experience.

### Priority: **High** — Essential for player agency and variety. Implement alongside Store and Market systems.

---

## Proposal 5: Grading Economy

### Description
A card grading system modeled after PSA/BGS/SGC. Players submit cards for grading, receive grades, and see market prices adjust accordingly. Grading adds a strategic layer: which cards are worth the cost?

### Grading Companies (In-Game)
| Company | Speed | Cost | Reputation | Notes |
|---|---|---|---|---|
| **PSA** | Standard (14 days) / Express (3 days) | $20-150 | Highest | Largest population reports. |
| **BGS** | Standard (10 days) / Express (2 days) | $18-130 | High | Subgrades (centering, corners, edges, surface). |
| **SGC** | Standard (7 days) | $15-100 | Growing | Vintage-friendly, cleaner slabs. |

### Grade Distribution (for fresh-from-pack modern cards)
| Grade | Approximate Rate |
|---|---|
| PSA 10 (Gem Mint) | 15-25% |
| PSA 9 (Mint) | 35-45% |
| PSA 8 (NM-MT) | 15-25% |
| PSA 7 or below | 5-15% |

### Market Price Multiplier
| Grade | Multiplier (vs raw) |
|---|---|
| Raw | 1.0x |
| PSA 8 | 1.1-1.3x |
| PSA 9 | 1.5-2.5x |
| PSA 10 | 3-10x (depends on card rarity/demand) |
| BGS 9.5 | 2-5x |
| BGS 10 (Black Label) | 8-20x |

### Key Mechanics

1. **Submission**: Player selects cards to submit, chooses service level (speed vs cost), sends them off.
2. **Turnaround**: Cards are gone for the service period. Player cannot sell/trade them during grading.
3. **Grade Determination**: Cards have hidden condition stats (centering, corners, edges, surface). These are assigned when the card is pulled from a pack. Grading reveals them.
4. **Population Reports**: Each graded card updates the population report. Rare grade + rare card = higher price due to scarcity.
5. **Pop Price Effect**: If a card has 10 PSA 10s, the 11th adds supply and might slightly reduce price. The first PSA 10 is worth more than the 100th.
6. **Slab Cracking**: Player can crack a slab to remove the card (for resale raw, regrading with another company, or use in deck). Risk: card condition may degrade during cracking.
7. **Cross-Grading**: Submit a card already graded by one company to another. Useful if you think PSA undergraded it. Cost of regrading + time.

### Strategic Decisions
- **Is this card worth grading?** Compare grading cost to expected grade × price multiplier.
- **Which tier to use?** Standard grading is cheap but slow. If market price might drop before you get the card back, express is worth it.
- **Which company?** PSA has the largest audience but slower turnaround. BGS is faster and has subgrades. SGC is cheapest.
- **Crack and resubmit?** If you get a PSA 8 but think it could be a 10, cracking and resubmitting costs another $20 but could yield $200+ more in value.

### Suggested Commands
```
/grade submit <card_id> [company] [tier] — Submit card(s) for grading
/grade status                            — View cards currently being graded
/grade history                           — View past grading results
/grade pop <card_id>                     — View population report for a card
/grade pop top <card_id>                 — Highest graded examples
/grade crack <card_id>                   — Crack a slab
/grade resubmit <card_id> <company>      — Cross-grade to another company
/grade cost [card_id]                    — Estimate grading cost and ROI
```

### Data Model Changes
```typescript
interface CardCondition {
  centering: number;    // 0-100 (100 = perfect 50/50)
  corners: number;      // 0-10
  edges: number;        // 0-10
  surface: number;      // 0-10
  // Determined at pull time, revealed at grading
}

interface GradingSubmission {
  id: string;
  cardId: string;
  company: 'PSA' | 'BGS' | 'SGC';
  tier: 'economy' | 'standard' | 'express';
  cost: number;
  submittedDate: Date;
  expectedReturnDate: Date;
  status: 'submitted' | 'in_progress' | 'graded' | 'returned';
  grade?: number;       // 1-10
  subgrades?: { centering: number; corners: number; edges: number; surface: number };
}

interface PopulationReport {
  cardId: string;
  totalGraded: number;
  byGrade: Record<number, number>;  // grade → count
  byCompany: Record<string, { byGrade: Record<number, number> }>;
  highestGrade: number;
  psa10Count: number;
  priceImpact: number;  // how population affects price
}
```

### Complexity: **Medium**
Grading is a self-contained system. The challenge is integrating condition stats (assigned at pull time) and making the ROI calculation feel meaningful.

### Priority: **Medium** — Adds depth but not core to the base experience. Implement after Store and Market systems are stable.

---

# Implementation Priority Summary

| Priority | Proposal | Complexity | Rationale |
|---|---|---|---|
| **1st** | Store System | Medium | Foundation for everything else. |
| **2nd** | Collection Acquisition | Medium | Gives players meaningful choices from day one. |
| **3rd** | Advanced Market Simulation | Hard | Creates the economic engine. Start simple, expand. |
| **4th** | Scalper NPC System | Medium | Adds realism and dynamic pressure. |
| **5th** | Grading Economy | Medium | Strategic depth layer for advanced play. |

**Recommended implementation order**: Store → Acquisition → Market (basic) → Scalper → Market (advanced) → Grading

---

*End of reference document. Last updated: 2026-03-30.*
