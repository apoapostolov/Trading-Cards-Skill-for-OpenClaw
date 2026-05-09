# Module Extraction Pattern — Trading Cards Monolith Split

## Approach: Multi-Pass Extraction with Test Gates

Splitting a 7,500+ line monolith into 7 focused modules required a disciplined **four-pass approach**, with full test passes between each extraction to catch breakage immediately.

## The Four Passes

### Pass 1: Pure Data → `constants.js`
**What moved:** Pack configs, parallel definitions, grades, tiers, emojis, flopps data constants, category data, format definitions — everything static with zero runtime logic.

**How:** Pure copy-paste. Constants require no runtime dependencies within themselves. Each constant was verified individually after extraction.

**Test gate:** Module loads, all exports resolve to defined values.

### Pass 2: Pure Utilities → `helpers.js`
**What moved:** File I/O (`rJ`, `wJ`), config/collection loaders, RNG wrappers, grading math, card generation functions, sealed inventory helpers — functions that take inputs and return outputs with no side effects on game state.

**Key detail:** The `LOG` object stayed as a mutable reference (`{ current: null }`) since the main module initializes it at runtime but helpers need to reference it. Keep this pattern when extracting shared logging.

**Pitfall avoided:** Some utility functions call game-logic functions (e.g. `generateCondition` calls `gaussRand` which calls `RNG`). Check the dependency tree before extracting to avoid circular require().

### Pass 3: Domain Logic → 5 Domain Modules
**What moved:** Each game subsystem extracted to its own module:

| Module | Domain | Key Functions |
|--------|--------|--------------|
| `pack-engine.js` | Card pulling | `pullCards`, `rollParallel`, `calcPrice`, `fmtCard`, `selectCard` |
| `market-engine.js` | Secondary market | `initMarket`, `runMarketTicks`, `MARKET_EVENT_PROFILES`, `catchUpMarketToNow` |
| `flopps-engine.js` | Corporate sim | `floppsDefaultCorporation`, `advanceFloppsCorporationState`, `maybeAnnounceFloppsNews` |
| `economy-engine.js` | Stores/scalpers/auctions | `simulateScalpersEnhanced`, `tickAuctionsEnhanced`, `loadStoreState`, `ensureFullInventory` |
| `grading-engine.js` | Grading analysis | `gradeRarityBonus`, `gradeflationPressure`, `processCompletedSubmissions` |

**Key detail:** Domain modules had to import from constants.js and helpers.js (the already-extracted base layers). Some had cross-domain dependencies (flopps-engine imports market-engine for `getSimulationDay`, economy-engine imports flopps-engine for `loadFloppsState`). These were handled with standard require() — the import graph is directional, not circular.

### Pass 4: Main File Reconstruction
**What happened:** The original file went from 7,500+ lines to ~2,100 lines containing only:
- Updated imports from all 7 lib modules
- Command handler functions (`cmd*` — 97 of them)
- Display helpers (`sparkline`, `trendTag`, `updateChecklist`, `logHistory`)
- Commander CLI setup + `program.parse()`

**Critical fix needed:** The original file had inline definitions of helper functions (`fm$`, `rJ`, `wJ`, `LOG`, `generateSet`, etc.) that now live in the lib modules. These MUST be removed after adding the imports, or Node throws `Identifier has already been declared`.

**When inline definitions remain after import insertion:** Run a targeted removal pass by scanning for every function name that's now in a lib module and deleting its inline definition block.

## Tooling Approach

### What Worked
- **New file creation:** Write each lib module cleanly with `write_file` — zero issues
- **Targeted patches** for small changes to the main file
- **Test suite** after each extraction pass — caught breakage immediately
- **Node.js scripts** (`/tmp/*.js`) for complex transformations on large files

### What Did NOT Work
- **`read_file` → `write_file` cycle:** `read_file` prefixes every line with line numbers (`     N|content`). Writing that content back corrupts the file permanently unless the prefixes are stripped first.
- **Python `terminal()` for large files:** `terminal` with `cat` truncates stdout at ~50KB. Only use `terminal` for small file reads or targeted `grep`.
- **Brace-counting to find function boundaries:** Inline code with deeply nested braces, template literals containing braces, and arrow functions make brace-counting unreliable. Use function-definition-line matching instead: mark the start of a function to remove, then skip lines until the next top-level function definition.
- **`module.exports` regex parsing:** Export declarations spanning multiple lines are unreliably parsed by single-line regex. Read the actual export arrays programmatically.
- **Subagent(s) for extraction work:** Subagents lack the cross-file awareness to correctly split a monolith. They either truncate the source file, drop function bodies, or create incorrect imports. **Do not delegate large refactoring.**

### Recommended: Recovery Backup
Before any refactoring pass, copy the original to a `.orig` file:
```bash
cp card-engine.js card-engine.js.orig.XXXX  # XXXX = line count of original
```

If anything goes wrong, you have the original to restart from. After restoration, re-verify by loading the module:
```bash
node -e "require('./card-engine.js'); console.log('OK')"
```

## Post-Refactoring Performance: Network Timeouts

### The Silent Cache Bug

During the second refactor (splitting 7 domain modules from the main file), every command took **16 seconds** before doing any work — even simple `wallet` reads. Two network timeouts were the culprits:

1. **FRED SP500 fetch** (`getMacroState()` → `fetchMacroState()`): Makes an HTTPS GET to `fred.stlouisfed.org`. When the fetch fails (timeout), the fallback cache was **never written to disk** — so every single command retried the full 9-second timeout.

2. **OpenRouter AI wildcard** (`maybeGenerateFloppsWildcardBulletin()`): Spawns a child process calling `ai-set-generator.js` with a disabled API key. The HTTP call hangs until the default timeout.

**The cache bug:** `getMacroState()` had:
```js
const fresh = fetchMacroState();
if (fresh) { saveMacroState(fresh); return fresh; }
return cached;
```
When `fetchMacroState()` timed-out and returned `null`, `fresh` was `null`, so the fallback was returned but cached state was **never updated**. Next call, same 9s timeout.

**Fix: write the fallback:**
```js
if (fresh) { saveMacroState(fresh); return fresh; }
cached.lastFetch = Date.now();
saveMacroState(cached);
return cached;
```

**Result:** First call ~2.3s (timeout + write), subsequent calls **0.09s** (instant cache hit).

### Other Network Timeout Fixes

- **Reduce FRED request timeout** from 8s→2s, execFileSync timeout from 9s→3s
- **Skip OpenRouter wildcard** if `OPENROUTER_API_KEY` is not set (fast-fail check)
- **Add 5s timeout** to the wildcard child process when key IS set

### Tracing Slow Commands

When a command takes unexpectedly long, instrument the init chain:

```js
console.time("init");
// ... individual steps with console.time("step")...
console.timeEnd("init");
```

Common bottlenecks (in order of likelihood):
1. External network requests (`fetchMacroState`, `maybeGenerateFloppsWildcardBulletin`)
2. Large file reads (34KB+ flopps state with accumulated history)
3. Circular dependency causing Node module resolution delays
4. Flopps day-catch-up iterating many missed days

## Post-Refactoring: Circular Dependencies

### Detected: flopps-engine ↔ economy-engine

Both modules needed functions from each other:
- `flopps-engine` needs `isSetHot`, `getDemandFactor`, `loadStoreState`, `loadScalperState`
- `economy-engine` needs `loadFloppsState`, `floppsDefaultCorporation`, `getFloppsReleaseWindow`

**First attempt:** Lazy requires inside function bodies. This works but is fragile — if both modules' lazy requires fire during the same call chain, the second one may get `undefined` for imported symbols.

**Clean fix:** Move shared functions into a **neutral third module**. `isSetHot` and `getDemandFactor` use purely market-related APIs (`loadMarket`, `getMacroState`, `getMarketCardList`). Moving them from `economy-engine` into `market-engine` breaks the cycle:

```
flopps-engine → market-engine (static require, safe)
economy-engine → market-engine (static require, safe)
flopps-engine ──→ economy-engine (lazy require inside function)
economy-engine ──→ flopps-engine (lazy require inside function)
```

`market-engine.js` has no dependencies on either flopps-engine or economy-engine, making it safe for both to import from at module scope.

**Rule:** When two modules A and B need functions from each other, look for a module C that both can import from without creating a cycle. If no C exists, create one.

## Post-Refactoring: Commander Argument Declaration

### The Subcommand Pattern

Many trading-cards commands parse subcommands from `process.argv` inside their handler (e.g., `wishlist add 001` parsed manually by `cmdWishlist`). Without explicit `.argument()` declarations, Commander's strict mode rejects extra positional arguments:

```
error: too many arguments for 'wishlist'. Expected 0 arguments but got 1.
```

**Fix:** Declare each subcommand-using command with `.argument()`:

```js
// Before (broken)
program.command('wishlist')
  .description('...')
  .action(cmdWishlist);

// After (fixed)
program.command('wishlist')
  .argument('[action]', 'add, remove, or list')
  .argument('[card-num]', 'Card number')
  .description('...')
  .action(cmdWishlist);
```

**Commands needing this fix:** `wishlist`, `market`, `flag`, `sell`, `grade`, `origin`, `trade`, `lot`, `sell-list`, `auction`, `store`, `buy`

Use `.argument('[args...]')` (variadic) for commands with variable sub-argument counts.

## Post-Refactoring: File Corruption Recovery

### The shared-skills trap

The backup at `~/git/hermes-shared-skills/.../card-engine.js` is the **8,353-line pre-refactor monolith** — it predates ALL 7 lib modules. Restoring it produces `Identifier has already been declared` errors because function bodies exist inline AND as imports.

### The `read_file` line-number corruption

The `read_file` tool prefixes every output line with `     N|` (e.g., `   91|function fm$(n){...}`). Writing this content via `write_file` embeds those prefixes into the file as **silent corruption** — the file works but every line has a garbage prefix.

**Fix:** Never pass `read_file` output directly to `write_file`. Use terminal + Node.js for read-then-write workflows:
```js
const content = fs.readFileSync('/path/to/file', 'utf8');
// modify content...
fs.writeFileSync('/path/to/file', modifiedContent);
```

### Cat truncation

Piping files through `terminal()` with `cat` truncates stdout at ~50KB. For files >1,000 lines, write a `/tmp/*.js` script using `fs.readFileSync`. The truncation is silent — no warning is shown.

## Verification

After each extraction pass, run:
1. **Syntax check:** `node --check card-engine.js`
2. **Module load:** `node -e "require('./card-engine.js')"`
3. **Smoke test:** `node test-smoke.js` — must be 20/20 passing
4. **Real command test:** Run 3-5 actual commands (wallet, portfolio, open-pack dry-run, flopps-status, compare)

## The LOG Pitfall

The `LOG` object is defined in `helpers.js` as:
```js
const LOG = { current: null };
```
It's meant to be imported and its `.current` property set at runtime:
```js
LOG.current = createTradingLogger({...});
LOG.current?.log('process.start', {...});
```

If the original code reassigns `LOG` directly (`LOG = createTradingLogger(...)`), that will fail when `LOG` is a `const` import. The fix is to `s/LOG\b/LOG.current/g` on the assignment and all subsequent LOG references in the main file. Specifically change:
- `LOG = ...` → `LOG.current = ...`
- `LOG.log(...)` → `LOG.current?.log(...)`
- `LOG?.error(...)` → `LOG.current?.error(...)`
- `LOG?.debug(...)` → `LOG.current?.debug(...)`
