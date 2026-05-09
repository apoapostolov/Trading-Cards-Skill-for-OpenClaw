# Variant vs Duplicate Detection

Added May 9 2026. Fixes the problem where the `[x2]` badge in pack output
was based on cardNum only (ignoring parallel), causing misleading display
when a card existed in a different parallel.

## Detection Pipeline

```
createAcquisitionTracker(col) → builds pullsBeforeByKey + prevCardInfo
         │
         ▼
pullCards() → for each card: annotateAcquiredCard(card, tracker)
         │
         ▼
annotateAcquiredCard() sets:
  • acquiredIsDuplicate   — same cardNum + same parallel
  • acquiredIsVariant     — cardNum exists, but different parallel
  • acquiredIsBestVariant — variant AND price > existing max for that cardNum
         │
         ▼
fmtCard() displays:
  • [xN]          if acquiredIsDuplicate && copyIndex > 1
  • ✨ New Variant!   if acquiredIsVariant (and not best)
  • 🌟 New Best Variant!!  if acquiredIsBestVariant
         │
         ▼
cmdOpenPack/cmdOpenBox → summary line:
  New: X (Y variants) | Dupes: Z
```

## Key Data Structures

### `tracker.pullsBeforeByKey`
```
{ "117:Base": 1, "117:Purple Shimmer": 1, "035:Chrome": 2, ... }
```
Built from `col.cards` at tracker creation time. Key = `cardNum:parallel`.

### `tracker.prevCardInfo`
```
{
  "117": { maxPrice: 0.44, parallels: ["Purple Shimmer", "Base"] },
  "035": { maxPrice: 2.17, parallels: ["Purple Shimmer", "Base"] },
  ...
}
```
Also built from `col.cards` at tracker creation. `maxPrice` is the highest
price among all existing copies of that cardNum.

### Card fields (set by `annotateAcquiredCard`)
```
card.acquiredIsDuplicate  — boolean, true if copyIndex > 1 for this key
card.acquiredCopyIndex    — number, count of this exact key (incl. this pull)
card.acquiredIsVariant    — boolean, true if not duplicate but cardNum exists
card.acquiredIsBestVariant — boolean, true if variant AND price > prevCardInfo[n].maxPrice
```

## Files Modified

### `lib/helpers.js`

**`createAcquisitionTracker`** — extended to scan `col.cards` and build:
- `pullsBeforeByKey`: `"cardNum:parallel"` → count (for true-duplicate detection)
- `prevCardInfo`: `cardNum` → `{ maxPrice, parallels[] }` (for variant/best detection)

**`annotateAcquiredCard`** — changed duplicate key from `card.cardNum` to
`${card.cardNum}:${card.parallel}`. Added variant and best-variant checks.

### `lib/pack-engine.js`

**`fmtCard`** — reads `c.acquiredIsVariant` and `c.acquiredIsBestVariant`
from the card object to display appropriate badges.

### `card-engine.js`

**`cmdOpenPack`** (line ~169) — tracks `variantCount` separately from
`newCount` and `dupCount`. Summary shows `New: X (Y variants) | Dupes: Z`.

**`cmdOpenBox`** (line ~213, ~232, ~263) — same tracking for box openings.
Initializes `totalVariant=0`, increments per-card, shows in summary.

## Test Scenarios

Use `node -e "require('./scripts/lib/helpers.js')"` to verify load.
Use a test script like the one below to verify detection logic:

```js
const { loadCol, createAcquisitionTracker, annotateAcquiredCard } = require('./scripts/lib/helpers.js');
const col = loadCol();
const tracker = createAcquisitionTracker(col, { opType: 'open-pack', packType: 'retail', packIndex: 0 });

// True duplicate (same num + same parallel)
const card1 = { cardNum: '117', name: 'Test', parallel: 'Base', price: 0.18 };
annotateAcquiredCard(card1, tracker);
console.log('isDuplicate:', card1.acquiredIsDuplicate, 'isVariant:', card1.acquiredIsVariant);

// New variant (same num, different parallel)
const card2 = { cardNum: '100', name: 'Test', parallel: 'Base', price: 0.25 };
annotateAcquiredCard(card2, tracker);
console.log('isDuplicate:', card2.acquiredIsDuplicate, 'isVariant:', card2.acquiredIsVariant, 'isBestVariant:', card2.acquiredIsBestVariant);

// Brand new card
const card3 = { cardNum: '999', name: 'New', parallel: 'Base', price: 0.50 };
annotateAcquiredCard(card3, tracker);
console.log('isDuplicate:', card3.acquiredIsDuplicate, 'isVariant:', card3.acquiredIsVariant);
```

## Pitfalls

- **`col.pulls` is NOT changed** — it still uses `cardNum` key. The parallel-aware
  tracking lives only in the per-pack tracker. If you change `col.pulls` to use
  `cardNum:parallel` keys, you'll break sell/auction/economy logic that references
  `col.pulls[listing.cardNum]`.
- **Dry runs** have `col = null`, so no badges appear. You need a real collection
  context for variant detection. This is correct — dry runs don't have a collection
  to compare against.
- **Best variant = strictly higher price.** Parallel rarity hierarchy is implicit
  through market pricing. If two chase parallels are priced identically, neither wins.
- **Within-pack detection:** `openingSeenByKey` tracks cards seen within the same
  pack, so pulling the same card+parallel twice in one pack correctly shows `[x3]`
  on the second instance.
