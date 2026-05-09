# Module Architecture (Post-Second-Refactor, May 2026)

## File Layout

```
scripts/
├── lib/
│   ├── constants.js       466 lines — all static data (packs, parallels, grades, flopps data, emojis)
│   ├── helpers.js          598 lines — all utility functions (I/O, grading math, RNG, card gen)
│   ├── pack-engine.js      177 lines — card pulling logic (rollParallel, pullCards, fmtCard, etc.)
│   ├── market-engine.js    505 lines — secondary market simulation (ticks, events, price simulation)
│   ├── flopps-engine.js    447 lines — flopps corporate simulation (stock, bulletins, calendar)
│   ├── economy-engine.js   662 lines — stores, scalpers, auctions, listings, provenance
│   └── grading-engine.js    85 lines — grading rarity, gradeflation, pop analysis
├── card-engine.js         ~2,100 lines — command handlers (96+ cmd* functions) + Commander CLI
├── card-engine-cli.js       324 lines — Commander.js wrapper
├── player-manager.js        460 lines — player registry and multi-user system
├── test-smoke.js             340 lines — comprehensive smoke test
└── ...
```

## What's in lib/constants.js

All pure data declarations (no game logic). Nothing requires `TRADING_CARDS_DATA_DIR`.

**Pack & Config:** PACKS, DEFAULT_PARALLELS, PARALLELS, PACK_CONFIG_PATH, loadPackConfig(), getDefaultParallels(), resolveParallels(set), resolveCardTypes(set), resolveInserts(set)

**Card Types & Tiers:** CARD_FORMATS, DEFAULT_CARD_TYPES, SPECIALS, AUTO_TYPES, AUTO_VARIANTS, RELIC_TYPES, RELIC_QUALITY, composeAuto(), composeRelic()

**Tiers & Grades:** TIERS, SUBS, GRADES, PSA_TIERS, PLATES

**Flopps:** FLOPPS_BULLETINS (83 templates), FLOPPS_EXECUTIVES (9 execs), FLOPPS_PRODUCT_LINES, FLOPPS_PARTNERS, FLOPPS_PHASES, FLOPPS_TREND_CANDIDATES

**Display & Grading Paths:** TIER_EMOJI, TIER_COLOR, PAR_EMOJI, SUB_EMOJI, SP_EMOJI, HINT_CENTERING, HINT_CORNERS, HINT_EDGES, HINT_SURFACE, HINT_APPEAL, CATS, GRADING_DIR, COMPANIES_FILE, GRADING_STATE_FILE, POP_FILE

**Not in constants:** CAT is standalone in card-engine.js as `require('./categories.js')`.

## What's in lib/helpers.js

All utility functions. Most accept TRADING_CARDS_DATA_DIR via closures.

- **File I/O:** rJ(p), wJ(p, d)
- **Formatting:** fm$(n), pR(s, w)
- **Weighted Random:** pwK(arr, k, rng), ri(rng, a, b)
- **Config & Collections:** loadCfg(), saveCfg(c), loadSet(), loadCol(sk), saveCol(col), rebuildPulls(col), createEmptyCollection(sk, wallet)
- **Acquisition Tracking:** nextAcquisitionBatchId(col), createAcquisitionTracker(), annotateAcquiredCard(), setLastAcquisitionBatch(), getLatestAcquisitionBatch(col)
- **Sealed Inventory:** ensureSealedInventory(col), getSealedInventoryEntry(col, product), getSealedQty(col, product), addSealedProduct(), consumeSealedProduct(), getSealedInventoryValue(col), formatSealedInventorySummary(col)
- **Card Generation:** genCard(num, cat, theme, rng), genSetCode(rng), normalizeSeed(seed, fallback)
- **Grading:** loadCompanies(), loadGradingState(), saveGradingState(), loadPopulation(), savePopulation(), psaTierForValue(v), conditionToGrade(cond, company), isBlackLabel(cond), gradeMultiplier(), estimateGradeProbability(), gradeLabel(), progressStr(), bumpPopulation(), simNpcPopulationGrowth()
- **Condition:** generateCondition(tier), ensureCondition(card), gaussRand(mean, std), clamp(v, lo, hi), rollGrade(), generateQuality(gradeInput), getCond()
- **Mode/Context:** isReal(), isPlayerScopedDataDir(), requirePlayerContext(command), getDataDir(), FLOPPS_DIR(), FLOPPS_STATE_FILE(), FLOPPS_WILDCARD_DIR(), LOG, setEngineSeed(seed), ENGINE_BASE_SEED, GLOBAL_RNG, mulberry32, RNG

## What's in lib/pack-engine.js

Card pulling logic. Doesn't know about the rest of the game.

- `rollParallel(maxT, set)` — roll parallel tier, handles serial numbers and plates
- `rollSpecial(set)` — roll card type (auto, relic, base) weighted by rarity
- `rollCardType(set, card)` — per-card or global type roll, composes auto/relic modifiers
- `composeCardTypeResult(type, globalTypes)` — build auto/relic/format into type result
- `selectCard(set, forHit)` — weighted card selection by star tier
- `calcPrice(card, par, sp, cond, sn)` — basePrice x subsetMod x parallelMod x specialMult x gradeMult x serialBonus
- `fmtCard(c, idx, set, dupCount)` — multi-line card display with emoji/stats/condition/price
- `pullCards(set, col, packType, openCtx)` — generate a pack of N cards
- `ensureSet()` — guard, prints error if no active set

**Deps:** constants.js, helpers.js, categories.js

## What's in lib/market-engine.js

Secondary market simulation — the most complex module.

**Market I/O:** loadMarket, saveMarket, getMarketCardList, normalizeMarketEvents

**Event System:** 20 MARKET_EVENT_PROFILES (hobby_boom, correction, nostalgia_wave, etc.), pickMarketEventType, buildMarketEvent, applyMarketEvent, addMarketEvent, isBullishMarketEvent, isBearishMarketEvent, activeMarketEvents

**Macro State:** loadMacroState, saveMacroState, fetchMacroState (FRED SP500 API), getMacroState (48h cache)

**Tick Simulation:** MARKET_TICK_MS = 12h, MAX_MARKET_CATCHUP_TICKS = 365, calcPendingTicks, runMarketTicks, resimulateMarketSnapshot, catchUpMarketToNow, getSimulationDay, computeSetAggregates

**Collection Sync:** enforceTierOrdering, syncMarketToCollection, tickMarketOnChange

**Init:** assignChaseScore, initMarket

**Utils for flopps:** weightedPick, getSpeculationWeight, clamp01, hashStringSeed

## What's in lib/flopps-engine.js

Flopps corporate simulation — the parody layer.

**State:** floppsDefaultCorporation, ensureFloppsStateShape, loadFloppsState, saveFloppsState, slugifyFloppsText, getFloppsPriceForDay, getSimulationDate

**Calendar:** buildFloppsReleaseCalendar, ensureFloppsReleaseCalendar, getFloppsReleaseWindow

**Trend desk:** scoreFloppsTrendCandidate, ensureFloppsTrendDesk

**Ecosystem:** getFloppsEcosystemSnapshot (lazy-requires from economy-engine)

**Corporation:** pickFloppsExecutive, advanceFloppsCorporationState, getFloppsSimulationContext

**Bulletins:** pickFloppsBulletin, pickFloppsBulletinByCategory, buildAnnouncementFromBulletin, buildQuarterlyFloppsAnnouncement, buildScheduledFloppsAnnouncement (milestones -21, -7, 0, +14), buildExceptionalFloppsAnnouncement (stress-threshold)

**Stock:** updateFloppsStockPrice, getFloppsWildcardChance, normalizeFloppsWildcardEvent, saveFloppsWildcardArtifact, maybeGenerateFloppsWildcardBulletin (calls ai-set-generator.js)

**Recording:** recordFloppsBulletin, formatFloppsNewsBlast, formatFloppsNewsSuffix, maybeAnnounceFloppsNews, getFloppsOverlayLines

## What's in lib/economy-engine.js

Stores, scalpers, auctions, listings, provenance.

**Store system:** loadDefaultStores, loadStoreState, saveStoreState, isSetHot, getDemandFactor, getRelationshipTier/Discount, getRecentScalperBuyQty, getStoreInventoryProfile, calcStoreInventoryQty, ensureStoreInventory, calcStorePrice, restockIfNeeded, ensureFullInventory

**Sales:** SUPPLIES (6 items), SALE_TYPES (5), loadStoreSales, saveStoreSales, generateStoreSales, getStoreSaleDiscount

**Scalpers:** simulateScalpersEnhanced (full), simulateScalpers (legacy)

**Marketplace I/O:** loadListings/saveListings, loadLots/saveLots, loadAuctions/saveAuctions, loadTraders/loadTradeHistory/saveTradeHistory

**Listings/Auctions:** tickListings, tickAuctions, tickAuctionsEnhanced (shill bidders, sniping, BIN), ensureNpcAuctions, NPC_BIDDERS (7 profiles)

**Provenance:** ORIGIN_PRESETS (11 types), assignOrigin(card, source)

## What's in lib/grading-engine.js

Small module for grading analysis.

- `gradeRarityBonus(cardNum, starTier, grade, set)` — rarity premium from pop count
- `gradeflationPressure(cardNum, company, grade, set)` — grade compression analysis
- `processCompletedSubmissions(state, col, set)` — move submitted cards to completed

## Player-Free vs Player-Scoped Commands

```js
const PLAYER_FREE_COMMANDS = new Set([
  'generate-set', 'gen-set', 'generate-set-ai', 'gen-ai',
  'flopps', 'flopps-launch', 'flopps-status', 'flopps-day',
  'flopps-today', 'flopps-wildcard',
  'compare', 'list-sets'
]);
```

Add to BOTH: PLAYER_FREE_COMMANDS + Commander .command().

## Circular Dependencies (Critical)

**economy-engine.js <-> flopps-engine.js** — both use lazy require() inside function bodies:

- flopps-engine lazy-requires `isSetHot`, `getDemandFactor` from economy-engine
- economy-engine lazy-requires `loadFloppsState`, `floppsDefaultCorporation`, `getFloppsReleaseWindow` from flopps-engine

New cross-module functions between these two must use lazy require(). market-engine.js has no circular deps.

## LOG Handling

```js
LOG.current = createTradingLogger({...});   // assign
LOG.current?.log('process.start', {...});   // always .current?.
```

Never `LOG.log()` or `LOG?.log()`.

## Pitfalls

### Missing game functions after refactor
Check lib/pack-engine.js (card pulling) or lib/market-engine.js (market) first. Functions formerly between genSetCode and pullCards are in pack-engine.js.

### Missing requires
`const CAT = require('./categories.js');` and `const { buildRichSetMetadata } = require('./set-metadata.js');` are standalone in card-engine.js, NOT in any lib module.

### Commander argument handling
Optional subcommands need `.argument('[target]')` not `<target>`. Required syntax rejects subcommand strings.

### Terminal truncated reading large files
`cat` caps at ~50KB. For >1,000 lines, write a Node.js script with fs.readFileSync.

### Shared-skills backup is the pre-refactor monolith
8,353-line monolith predates ALL 7 lib modules. Restoring produces duplicates. See SKILL.md for rebuild sequence.
