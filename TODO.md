# Trading Cards — TODO

## Completed

- [x] **`set-money`** — set wallet to exact amount (admin/debug). `set-money 50` or `set-money 0`
- [x] **Simulation audit** — review `scripts/card-engine.js` and category generators for optimization, bug fixes, deterministic RNG, duplicate detection, wallet/history correctness, collection file handling, and market tick performance.
- [x] **Duplicate summary** — show dupes sorted by quantity and value. Useful for sell decisions.
- [x] **`pack-stats`** — historical pull rate analysis. "You've opened 12 packs, hit rate: X%, best parallel ever: ..."
- [x] **`top-cards`** — show your most valuable cards ranked. `top-cards` (by value) / `top-cards --grade` (by grade)
- [x] **`history`** — log of all transactions (packs opened, cards sold, money added). Needs a transaction ledger.
- [x] **Bulk grading** — `grade-card --all` or `grade-card --dups` to grade multiple cards at once ($5 each).
- [x] **Configurable pocket money** — let the user set the daily amount in config.json instead of hardcoding $5 in the cron.
- [x] **`reset-collection`** — wipe collection for active set but keep the set definition (softer than `new-season`).

## Flopps Expansion Roadmap

### Pass 1: Brand Shell and Voice

- [x] Add a first-class Flopps trigger path to `SKILL.md` so the skill fires on fake blog, release-note, and corporate-parody prompts.
- [x] Define the Flopps voice as polished, self-aware corporate hype with a cynical edge.
- [x] Add a reusable article skeleton for headlines, release summary, feature bullets, "what changed" notes, and next-drop teases.
- [x] Document the safe fiction boundary: this is a satirical world sim, not real-world guidance or defamation.
- [x] Build the Flopps executive cast with public faces, private incentives, and an internal hierarchy of scarcity-minded roles.

### Pass 2: Set Launch Factory

- [x] Build a launch workflow for the "new set every 1.5 months" cadence.
- [x] Turn Flopps management briefs into set themes, chase cards, parallels, inserts, and packaging language.
- [x] Generate launch-day copy: announcement post, teaser post, patch notes, and collector FAQ.
- [x] Add a repeatable mapping from theme brief to card taxonomy so every set feels authored rather than random.

### Pass 3: Corporate World Simulation

- [x] Model Flopps as a living company sim with factories, print runs, warehouses, distributors, stores, collectors, resellers, and scalpers.
- [x] Track hype index, sell-through, allocation pressure, panic buying, and secondary-market velocity.
- [x] Add consumer obsession as a world variable so the sim can explain why the next set is already oversubscribed before release day.
- [x] Let simulated corporate copy react to shortages, failed restocks, and unexpected chase-card demand.
- [x] Give Flopps a public ticker (`FLPS`) whose valuation moves with proxy-company sentiment, hype, layoffs, and scandal.
- [x] Add corporate cruelty events: layoffs, price hikes, odds cuts, allocation squeezes, and generic dark-money lobbying framed as investor discipline.

### Pass 4: Article and Blog Automation

- [x] Add article modes for release notes, internal dev notes, investor-safe updates, "community" posts, and faux transparency statements.
- [x] Add recurring satirical columns such as market watch, print-run reassurance, packaging notes, and "what collectors are talking about."
- [x] Support tone presets for triumphant, apologetic, teasing, faux-honest, and breathlessly promotional posts.
- [x] Let article generation reuse previous launch events so the blog develops an internal history.
- [x] Add day-specific and today-specific Flopps summary commands for simulation-day reporting.
- [x] Add a low-frequency AI wildcard event path so Flopps can occasionally publish an unplanned corporate shock announcement affecting sealed demand or the secondary market.

### Pass 5: Persistence and Reuse

- [x] Store Flopps events, launches, and article outputs in a durable history log.
- [x] Feed Flopps state back into future set prompts and copy generation.
- [x] Feed Flopps state into market overlays and secondary-market commentary.
- [x] Create reusable prompt snippets for management briefs, launch summaries, and next-set breadcrumbs.
- [x] Lock the Flopps architecture: simulation-first system that produces structured state and metadata; AI writing is a secondary presentation layer that turns that state into press releases, blog posts, and corporate copy.

## Epic Expansion Directions

### 1. Full Hobby Civilization Sim

- [ ] **Collector class system** — model whales, dads, kids, grifters, breakers, sealed hoarders, grading purists, set-completion monks, and washed ex-fans as separate economic species.
- [ ] **Culture war over the hobby** — simulate factions arguing over junk wax, breakers, grading, kids in the hobby, artificial scarcity, and whether Flopps is ruining everything or saving it.
- [ ] **Convention circuit** — add card shows, hotel ballroom trade nights, national conventions, regional expos, and after-hours dealmaking that shift liquidity and hype.
- [ ] **Content creator ecosystem** — model YouTubers, streamers, rumor accounts, grading influencers, newsletter leakers, and “hobby thought leaders” as sentiment amplifiers.
- [ ] **Collector religion** — let certain product lines become quasi-sacred, with rituals, lore, pilgrimage events, and irrational devotion around flagship brands.

### 2. Flopps as a State-Level Corporate Organism

- [ ] **Corporate departments as actors** — make Product, Finance, Licensing, Legal, Community, Marketplace, and Investor Relations operate as semi-independent power centers with conflicting incentives.
- [ ] **Board politics** — simulate quarterly board pressure, activist shareholders, succession rumors, executive backstabbing, and strategic pivots driven by stock pain.
- [ ] **Corporate doctrine engine** — generate recurring management slogans, five-year visions, annual themes, and euphemistic policy language that mutates over time.
- [ ] **Scandal metabolism** — model how Flopps absorbs scandal through PR, legal settlements, sacrificial executives, charity gestures, and rebrands.
- [ ] **Regulatory capture mode** — add antitrust whispers, gambling scrutiny, child-protection hearings, odds-transparency pressure, and corporate lobbying responses.

### 3. Trading Cards as a Media Universe

- [ ] **Card-lore continuity** — let fictional sets build recurring universes, characters, rivalries, rookie arcs, and legendary pulls with continuity across seasons.
- [ ] **Fake documentary mode** — generate hobby-magazine retrospectives, investigative podcasts, shareholder leaks, timeline explainers, and “oral histories” of major card booms.
- [ ] **Alternative history releases** — build sets around impossible timelines such as “if Topps owned history,” “dinosaurs in MLB,” or “failed streaming shows resurrected as chrome hits.”
- [ ] **Meta-products** — create documentary insert sets, apology-tour sets, union-busting commemorative parallels, and bizarre crossover products that comment on prior Flopps behavior.
- [ ] **Mythic chase cards** — add legendary rumor-tier cards whose existence is uncertain until enough market lore accumulates around them.

### 4. Dark Market and Criminality Layer

- [ ] **Shill bidding and wash trading** — simulate fake bids, circular sales, pump groups, influencer-owned inventory, and price manipulation rings on the secondary market.
- [ ] **Counterfeit economy** — add fake slabs, fake patches, trimmed cards, resealed wax, and black-market authentication panic.
- [ ] **Inside-information leaks** — let warehouse staff, printers, licensors, and creators leak checklist details or parallel odds before launch.
- [ ] **Organized arbitrage crews** — model retail raiders, distributor insiders, breaker syndicates, and inventory bots competing for sealed product.
- [ ] **Corporate complicity ambiguity** — build events where Flopps publicly condemns a market abuse while privately benefiting from the volatility.

### 5. Human Misery / Addiction Simulation

- [ ] **Collector burnout arc** — track fatigue, sunk-cost spirals, nostalgia relapses, shame buying, and temporary exits from the hobby.
- [ ] **Family and life consequences** — model rent money breaks, marriage arguments, “this is my last box” behavior, and financial ruin disguised as collector optimism.
- [ ] **Recovery mode** — create anti-hype periods where players try to quit, downsize, or become disciplined, while Flopps and the market try to pull them back in.
- [ ] **Compulsion triggers** — let teaser posts, influencer hits, grading returns, or near-miss openings affect a hidden urge-to-buy variable.
- [ ] **Player biography** — evolve the player from casual buyer to obsessed hobby citizen with a narrative identity, habits, and scars.

### 6. World Systems Beyond Flopps

- [ ] **Competing companies** — add rival card empires with different philosophies: heritage purists, tech-first lootbox freaks, sports monopolists, indie art weirdos.
- [ ] **Licensor politics** — model studios, leagues, estates, publishers, and athletes negotiating rights, squeezing margins, and sabotaging competitors.
- [ ] **Retail hierarchy** — represent Walmart, LCS owners, breakers, marketplace sharks, and direct-to-consumer channels as a layered supply caste system.
- [ ] **Grading empire wars** — let grading companies fight over standards, slabs, turnaround times, black labels, and market trust.
- [ ] **International hobby zones** — build different market behavior by region: US breaker mania, Japanese precision, European football collector culture, speculative cross-border arbitrage.

### 7. Experimental Gameplay / Command Surface

- [ ] **`career` mode** — let the player live through multiple hobby years with financial progression, reputation, and irreversible market-era changes.
- [ ] **`become-flopps` mode** — allow the user to act as management, make cruel corporate decisions, and watch how collectors and markets react.
- [ ] **`newsroom` mode** — turn Flopps and the hobby into a playable media feed with generated headlines, rumors, leaks, analyst notes, and forum panic.
- [ ] **`hobby-forensics`** — inspect a card/set/company event as if doing a deep investigative report with causality, beneficiaries, and hidden incentives.
- [ ] **`timeline` mode** — replay the entire history of a set or the company through launches, scandals, booms, crashes, and collector mood changes.

### 8. Endgame Weirdness

- [ ] **Post-collapse hobby** — simulate what happens if the bubble bursts, collectors flee, sealed wax floods the market, and Flopps pivots into survival mode.
- [ ] **AI-generated junk wax era** — let Flopps over-automate creation until the market is buried under infinite sets and authenticity itself becomes valuable.
- [ ] **Corporate feudalism** — evolve Flopps into a total lifestyle platform where breaking, grading, selling, financing, and fandom are all owned by one machine.
- [ ] **Museum / archive mode** — preserve retired sets, infamous scandals, and legendary collector stories as a cultural memory layer.
- [ ] **Apocalypse crossover** — create absurd terminal states where cards outlive normal society and the hobby becomes a social operating system.
- [ ] **Card-backed debt economy** — let collectors borrow against slabs, sealed wax, and portfolio hype, creating margin calls, forced liquidations, and hobby credit crises.
- [ ] **Shadow canon layer** — add rumor-only checklists, whispered warehouse sheets, fake leaks, and collector folklore that sometimes turns out to be more powerful than official Flopps truth.

## High Priority

- [ ] **`transfer`** — trade cards between collections (multiplayer prep). `transfer <card-num> <from-set> <to-set>`
- [ ] **`trade`** — swap cards with another user's collection. Needs collection-per-user support first.
- [ ] **`wishlist`** — mark cards you need for set completion. `wishlist add/remove/list <card-num>`
- [ ] **Completion percentage per parallel tier** — current set completion is flat; show progress per parallel (e.g. "Base: 45/100, Chrome: 8/100, Gold: 0/2026")
- [ ] **`market leaderboard`** — expose the existing most-valuable-cards helper as a routed command.
- [ ] **`command docs sync`** — compare `SKILL.md` against the CLI dispatcher so new commands do not drift undocumented.

## Medium Priority

- [ ] **`remove-money`** — deduct from wallet (for selling cards to the shop or penalties). Mirror of `add-money`.
- [ ] **Collection index cache** — persist per-card lookup indexes for large collections so report commands avoid rebuilding them repeatedly.

## Low Priority / Nice to Have

- [ ] **Multi-user collections** — support multiple wallets/collections keyed by Discord user ID. Foundation for trading.
- [ ] **`shop`** — buy specific singles from a virtual shop at market price. `shop buy <card-num>`
- [ ] **`export`** — export collection as JSON/CSV for external tools or backup.
- [ ] **`import`** — import a collection from JSON (restore from backup).
- [ ] **Leaderboard** — weekly/monthly net worth rankings across users (needs multi-user).
- [ ] **Pack animations / ASCII art** — make pack breaks more visually exciting in terminal output.
- [ ] **Rarity-based pack types** — premium packs with better odds (e.g. "Hot Box" with 3x hit rate, $200).
- [ ] **Achievement system** — milestones like "First 1/1", "Complete a set", "10 boxes opened", etc.
- [ ] **Card images** — AI-generated card art using image generation, saved per card.

## Authenticity / Real-World Link Ideas

- [ ] **Macro signal history** — keep a 7/30/90 day macro log so the market can show why prices moved, not just the latest SP500 snapshot.
- [x] **Release-cycle supply shocks** — add simulated “fresh release”, “mid-cycle drought”, and “clearance season” phases so sealed stock feels more like real hobby retail.
- [x] **Distributor lag** — let some stores restock with delay or partial fulfillment, especially during hot-set spikes, to mimic allocation and backorder behavior.
- [ ] **Regional store personality** — vary inventory depth and restock cadence by store archetype and region so big-box, LCS, and online stores feel meaningfully different.
- [ ] **Demand transparency** — expose a `market pressure` / `store pressure` readout that shows whether macro, hype, and scalper activity are pushing a set up or down.
- [ ] **Real-world event hooks** — allow optional sports season, playoffs, draft week, movie release, or internet trend windows to nudge demand without dominating pricing.
- [ ] **Price comp snapshots** — store a small history of “comparable sale” references so market cards can explain valuation in plain language.
- [ ] **Scarcity decay** — make some products easier to find after they cool off, while hot products become harder to source, instead of using static restock ranges.
- [ ] **Confidence labels** — annotate market signals with freshness / confidence so the sim can distinguish “live”, “cached”, and “stale fallback” states.
- [ ] **Macro disclosure in commands** — add a small note to price-sensitive outputs when a command is using cached macro data older than 24h.
