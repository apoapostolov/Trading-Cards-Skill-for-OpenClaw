# Trading Cards Skill — Testing Patterns

## Smoke Test Structure

Fast CLI smoke tests for Node.js trading card engine:

```javascript
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync} = require('child_process');

const SCRIPT_DIR = path.join(__dirname, '..', 'scripts');
const CARD_ENGINE = path.join(SCRIPT_DIR, 'card-engine.js');
const PLAYER_MANAGER = path.join(SCRIPT_DIR, 'player-manager.js');

function runNode(script, args, dataDir) {
  return execFileSync('node', [script, ...args], {
    cwd: path.dirname(script),
    encoding: 'utf8',
    timeout: 30000,
    env: {...process.env, TRADING_CARDS_DATA_DIR: dataDir},
  });
}

function makeTempDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'trading-cards-smoke-'));
}
```

## Key Testing Insights

### Collection File Auto-Creation Bug
**Issue**: `loadCol()` returns `null` if collection file doesn't exist, causing crashes on first pack open.
**Workaround**: Pre-create collection with full schema:

```javascript
writeJson(path.join(collectionsDir, `${setKey}.json`), {
  setKey: setKey,  // REQUIRED - saveCol() needs this
  cards: [],
  wallet: 105,
  stats: {total: 0, value: 0, spent: 0, boxes: 0, packs: 0, hits: 0, oneOfOnes: 0},
  pulls: {},       // REQUIRED - pullCards() indexes into this
  parallelCounts: {},
  bestPull: null,
  sealedInventory: {}
});
```

### Test Isolation Pattern
Always use fresh temp directories:
```javascript
const dataDir = makeTempDataDir();
// Run all operations within this dir
// Tests clean up automatically via OS temp cleanup
```

### Player-Scoped vs Root-Scoped Commands
| Command Type | DataDir Context | Examples |
|--------------|-----------------|----------|
| Root-scoped | `dataDir` (root) | `generate-set`, `flopps-status`, `market` |
| Player-scoped | `dataDir/players/<name>` | `wallet`, `open-pack`, `portfolio` |

**Critical**: Generate set BEFORE registering player so player config copies the `activeSet`.

## Fast Test Selection

Avoid slow commands in smoke tests:
- ❌ `market` - rebuilds full market state
- ❌ `duplicates` - scans entire collection (unless selling changed data)
- ❌ `flag` - analyzes all cards
- ✅ `wallet`, `portfolio`, `generate-set`, `open-pack --dry-run`, `compare`, `list-sets`

## Comprehensive Smoke Test (scripts/test-smoke.js)

The canonical smoke test is at `scripts/test-smoke.js`. It tests 20 paths against live data:

1. Module loads — validates constants.js, helpers.js, card-engine.js syntax
2. Export verification — all 50 constants + 62 helpers resolve correctly
3. Global commands — compare, list-sets, flopps-status, flopps-today
4. Player-scoped reads — wallet, portfolio, collection, duplicates, history, set-info, pack-stats, top-cards
5. Game logic — open-pack retail dry-run

Run: `node scripts/test-smoke.js` (expected: 20 passed, 0 failed)

**Limitations:** Tests run against live data, so commands that modify state (sell dups, open-pack --real) are skipped or run in dry-run mode.

## Timeout Guidelines

| Command | Typical Time | Safe Timeout |
|---------|--------------|--------------|
| `generate-set --cards 10` | 100ms | 5s |
| `open-pack retail` | 200ms-30s (flopps catch-up) | 60s |
| `market` | 5-30s | 60s |
| `portfolio` / `wallet` | 5-60s (flopps init) | 90s |
| `flopps-wildcard` | 10-60s | 120s |
| `compare` (global) | 1-2s | 15s |

Flopps catch-up increases first-command latency on any day gap. Most commands take 200ms after flopps is initialized.

## Deprecated Tests (Player-Scoped Breaks)

The following test scripts create fixture directories at the root data level and fail because card-engine.js now enforces the `isPlayerScopedDataDir()` check:

- `test-missing-set-regression.js` — would need player-scoped temp dirs
- `test-sell-dupes-regression.js` — same issue
- `test-flopps-simulation.sh` — creates root-level fixture, fails on wallet/open-pack

These tests worked before the multi-user player system was added. The new `test-smoke.js` replaces them as the canonical test.
