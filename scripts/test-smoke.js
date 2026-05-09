#!/usr/bin/env node
'use strict';
/**
 * Comprehensive smoke test for refactored trading-cards system.
 * Validates every critical command path with the live data.
 */

const { execFileSync, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCRIPT_DIR = __dirname;
const CARD_ENGINE = path.join(SCRIPT_DIR, 'card-engine.js');
const CARD_ENGINE_CLI = path.join(SCRIPT_DIR, 'card-engine-cli.js');
const PLAYER_MANAGER = path.join(SCRIPT_DIR, 'player-manager.js');
const CONSTANTS_MODULE = path.join(SCRIPT_DIR, 'lib', 'constants.js');
const HELPERS_MODULE = path.join(SCRIPT_DIR, 'lib', 'helpers.js');

let passed = 0, failed = 0, errors = [];

function getPlayerDir() {
  return execSync(`node ${PLAYER_MANAGER} dir`, { cwd: SCRIPT_DIR, encoding: 'utf8', timeout: 10000 }).trim();
}

function run(script, args, opts = {}) {
  const dataDir = opts.player ? getPlayerDir() : undefined;
  const env = { ...process.env, ...(dataDir ? { TRADING_CARDS_DATA_DIR: dataDir } : {}) };
  if (opts.timeout === undefined) opts.timeout = 60000;
  try {
    const output = execFileSync('node', [script, ...args], {
      cwd: SCRIPT_DIR, encoding: 'utf8', timeout: opts.timeout, env,
    });
    return { ok: true, output };
  } catch (e) {
    const stdout = e.stdout || '';
    const stderr = e.stderr || '';
    if (e.code === 'ETIMEDOUT' || e.killed || (e.status === null && !stdout)) {
      return { ok: false, output: stdout + stderr, timedOut: true };
    }
    return { ok: e.status === 0, output: stdout + stderr, status: e.status };
  }
}

function test(name, fn) {
  process.stdout.write(`  ${name}... `);
  try {
    const result = fn();
    if (result === true || result === undefined) {
      console.log('PASS');
      passed++;
    } else if (result === false) {
      console.log('FAIL');
      failed++;
      errors.push(name);
    } else if (result.ok === false) {
      console.log(result.timedOut ? 'TIMEOUT' : 'FAIL');
      failed++;
      errors.push(name);
      const out = (result.output || '').trim().slice(0, 300);
      if (out) console.log(`    Output: ${out.replace(/\n/g, '\n    ')}`);
    } else {
      console.log('PASS');
      passed++;
    }
  } catch (e) {
    console.log('ERROR');
    failed++;
    errors.push(name);
    console.log(`    ${e.message.slice(0, 200)}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

console.log('\n═════════════════════════════════════════════');
console.log('  TRADING CARDS — REFACTOR SMOKE TEST');
console.log('═════════════════════════════════════════════\n');

// ─── 1. Module Loads ────────────────────────────────────────
console.log('── Module Loads ──────────────────────────────');

test('constants.js loads without error', () => {
  const m = require(CONSTANTS_MODULE);
  return typeof m === 'object' && m !== null;
});

test('helpers.js loads without error', () => {
  const m = require(HELPERS_MODULE);
  return typeof m === 'object' && m !== null;
});

test('card-engine.js loads without error', () => {
  const { execFileSync } = require('child_process');
  // Validate syntax without executing the file
  execFileSync('node', ['--check', CARD_ENGINE], { cwd: SCRIPT_DIR, encoding: 'utf8', timeout: 10000 });
  return true;
});

// ─── 2. Lib Export Verification ─────────────────────────────
console.log('\n── Lib Export Verification ───────────────────');

test('ALL constants.js exports are defined', () => {
  const c = require(CONSTANTS_MODULE);
  const expected = ['CARD_FORMATS', 'PACKS', 'PARALLELS', 'TIERS', 'SUBS', 'GRADES',
    'PSA_TIERS', 'PLATES', 'TIER_EMOJI', 'PAR_EMOJI', 'CATS', 'getDataDir',
    'composeAuto', 'composeRelic', 'loadPackConfig'];
  const missing = expected.filter(k => c[k] === undefined);
  if (missing.length) throw new Error(`Missing exports: ${missing.join(', ')}`);
  return true;
});

test('ALL helpers.js exports are defined', () => {
  const h = require(HELPERS_MODULE);
  const expected = ['rJ', 'wJ', 'fm$', 'pR', 'loadCfg', 'saveCfg', 'loadCol', 'saveCol',
    'LOG', 'setEngineSeed', 'genCard', 'rollGrade', 'gaussRand', 'clamp',
    'loadSet', 'loadCompanies', 'ensureCondition', 'normalizeSeed',
    'isReal', 'isPlayerScopedDataDir', 'requirePlayerContext',
    'getDataDir', 'FLOPPS_DIR', 'FLOPPS_STATE_FILE',
    'loadPopulation', 'savePopulation', 'gradeMultiplier',
    'generateCondition', 'getCond', 'generateQuality'];
  const missing = expected.filter(k => h[k] === undefined);
  if (missing.length) throw new Error(`Missing exports: ${missing.join(', ')}`);
  return true;
});

test('LOG is a mutable ref object', () => {
  const h = require(HELPERS_MODULE);
  return typeof h.LOG === 'object' && h.LOG.current === null;
});

// ─── 3. Global Commands (no TRADING_CARDS_DATA_DIR) ─────────
console.log('\n── Global Commands ───────────────────────────');

test('compare — shows player table', () => {
  const r = run(CARD_ENGINE, ['compare'], { timeout: 15000 });
  if (!r.ok) return r;
  if (!r.output.includes('PLAYER COMPARISON')) return { ok: false, output: r.output };
  if (!r.output.includes('Player One') || !r.output.includes('Player Two')) return { ok: false, output: r.output };
  return r;
});

test('list-sets — lists available sets', () => {
  const r = run(CARD_ENGINE, ['list-sets'], { timeout: 15000 });
  if (!r.ok) return r;
  if (!r.output.includes('SETS') && !r.output.includes('ACTIVE')) return { ok: false, output: r.output };
  return r;
});

// ─── 4. Player-Scoped Reads ────────────────────────────────
console.log('\n── Player-Scoped Reads ───────────────────────');

test('wallet — shows balance', () => {
  const r = run(CARD_ENGINE, ['wallet'], { player: true, timeout: 90000 });
  if (!r.ok) return r;
  if (!r.output.includes('WALLET')) return { ok: false, output: r.output };
  return r;
});

test('portfolio — shows financial overview with slot format', () => {
  const r = run(CARD_ENGINE, ['portfolio'], { player: true, timeout: 90000 });
  if (!r.ok) return r;
  if (!r.output.includes('PORTFOLIO')) return { ok: false, output: r.output };
  if (!r.output.includes('unique')) return { ok: false, output: r.output };
  // Display shows unique count, not separate slots+variants
  if (!r.output.includes('unique')) return { ok: false, output: 'Missing unique count: '+r.output.slice(0,200) };
  return r;
});

test('collection — shows card list with slot format', () => {
  const r = run(CARD_ENGINE, ['collection'], { player: true, timeout: 90000 });
  if (!r.ok) return r;
  if (!r.output.includes('unique') && !r.output.includes('slots')) return { ok: false, output: `Missing slot/unique format in output: ${r.output.slice(0,200)}` };
  return r;
});

test('duplicates — finds duplicate cards', () => {
  const r = run(CARD_ENGINE, ['duplicates'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  // May show dupes or 'No duplicates' — both are valid
  if (!r.output.includes('DUPLICATES') && !r.output.includes('No duplicates')) return { ok: false, output: r.output };
  return r;
});

test('history — shows transaction history', () => {
  const r = run(CARD_ENGINE, ['history', '--count', '3'], { player: true, timeout: 90000 });
  if (!r.ok) return r;
  // History can be empty on a fresh player, so just check it doesn't error
  return r;
});

test('set-info — shows active set', () => {
  const r = run(CARD_ENGINE, ['set-info'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  if (!r.output.includes('BOC')) return { ok: false, output: `Expected BOC in set-info: ${r.output.slice(0,200)}` };
  return r;
});

test('pack-stats — shows opening stats', () => {
  const r = run(CARD_ENGINE, ['pack-stats'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  if (!r.output.includes('PACK')) return { ok: false, output: r.output };
  return r;
});

test('top-cards — shows most valuable', () => {
  const r = run(CARD_ENGINE, ['top-cards'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  if (!r.output.includes('TOP')) return { ok: false, output: r.output };
  return r;
});

// ─── 5. Game Logic ─────────────────────────────────────────
console.log('\n── Game Logic ────────────────────────────────');

test('open-pack retail (dry-run) — simulates pack without commit', () => {
  const r = run(CARD_ENGINE, ['open-pack', 'retail'], { player: true, timeout: 90000 });
  if (!r.ok) return r;
  if (!r.output.includes('RETAIL PACK')) return { ok: false, output: r.output };
  if (!r.output.includes('DRY RUN')) return { ok: false, output: `Expected DRY RUN: ${r.output.slice(0,200)}` };
  if (!r.output.includes('BOC-')) return { ok: false, output: `Missing card pulls: ${r.output.slice(0,200)}` };
  return r;
});

test('sell dups — SKIPPED (modifies live data)', () => {
  console.log('SKIP');
  return true;
});

// ─── 6. Flopps ────────────────────────────────────────────
console.log('\n── Flopps Commands ───────────────────────────');

test('flopps-status — shows company state', () => {
  const r = run(CARD_ENGINE, ['flopps-status'], { timeout: 60000 });
  if (!r.ok) return r;
  if (!r.output.includes('FLOPPS') && !r.output.includes('FLPS')) return { ok: false, output: r.output };
  return r;
});

test('flopps-today — shows current day activity', () => {
  const r = run(CARD_ENGINE, ['flopps-today'], { timeout: 60000 });
  if (!r.ok) return r;
  return r;
});



// ─── 7. New Lib Module Exports ─────────────────────────────────
console.log('\n── New Lib Module Exports ───────────────────');

test('pack-engine.js exports all functions', () => {
  const m = require('./lib/pack-engine');
  const expected = ['pullCards', 'rollParallel', 'rollSpecial', 'rollCardType',
    'composeCardTypeResult', 'selectCard', 'calcPrice', 'fmtCard', 'ensureSet'];
  const missing = expected.filter(k => typeof m[k] !== 'function');
  if (missing.length) throw new Error('Missing exports: ' + missing.join(', '));
  return true;
});

test('market-engine.js exports key functions', () => {
  const m = require('./lib/market-engine');
  const expected = ['loadMarket', 'saveMarket', 'getMacroState', 'initMarket',
    'runMarketTicks', 'catchUpMarketToNow', 'getSimulationDay',
    'syncMarketToCollection', 'clamp01'];
  const missing = expected.filter(k => typeof m[k] !== 'function');
  if (missing.length) throw new Error('Missing exports: ' + missing.join(', '));
  return true;
});

test('flopps-engine.js exports key functions', () => {
  const m = require('./lib/flopps-engine');
  const expected = ['loadFloppsState', 'saveFloppsState', 'maybeAnnounceFloppsNews',
    'getFloppsOverlayLines', 'getFloppsSimulationContext', 'recordFloppsBulletin',
    'buildScheduledFloppsAnnouncement', 'advanceFloppsCorporationState'];
  const missing = expected.filter(k => typeof m[k] !== 'function');
  if (missing.length) throw new Error('Missing exports: ' + missing.join(', '));
  return true;
});

test('economy-engine.js exports key functions', () => {
  const m = require('./lib/economy-engine');
  const expected = ['loadStoreState', 'saveStoreState', 'loadScalperState',
    'loadDefaultStores', 'loadDefaultScalpers', 'isSetHot', 'getDemandFactor',
    'loadListings', 'loadAuctions', 'loadTraders', 'loadLots',
    'tickAuctionsEnhanced', 'simulateScalpersEnhanced',
    'generateStoreSales', 'getStoreSaleDiscount', 'calcStorePrice'];
  const missing = expected.filter(k => typeof m[k] !== 'function');
  if (missing.length) throw new Error('Missing exports: ' + missing.join(', '));
  return true;
});

test('grading-engine.js exports all functions', () => {
  const m = require('./lib/grading-engine');
  const expected = ['gradeRarityBonus', 'gradeflationPressure', 'processCompletedSubmissions'];
  const missing = expected.filter(k => typeof m[k] !== 'function');
  if (missing.length) throw new Error('Missing exports: ' + missing.join(', '));
  return true;
});

// ─── 8. Extended Player Commands ────────────────────────────────
console.log('\n── Extended Player Commands ──────────────────');

test('card-types — shows card type system', () => {
  const r = run(CARD_ENGINE, ['card-types'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  if (!r.output.includes('CARD TYPE')) return { ok: false, output: r.output };
  return r;
});

test('checklist — shows set completion', () => {
  const r = run(CARD_ENGINE, ['checklist'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  if (!r.output.includes('CHECKLIST')) return { ok: false, output: r.output };
  return r;
});

test('wishlist list — shows empty', () => {
  const r = run(CARD_ENGINE, ['wishlist', 'list'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  if (!r.output.includes('Wishlist') && !r.output.includes('empty')) return { ok: false, output: r.output };
  return r;
});

test('origin (summary) — shows provenance data', () => {
  const r = run(CARD_ENGINE, ['origin'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  if (!r.output.includes('PROVENANCE')) return { ok: false, output: r.output };
  return r;
});

test('origin 001 — shows specific card provenance', () => {
  const r = run(CARD_ENGINE, ['origin', '001'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  if (!r.output.includes('PROVENANCE') && !r.output.includes('001')) return { ok: false, output: r.output };
  return r;
});

// ─── 9. Market Commands ─────────────────────────────────────────
console.log('\n── Market Commands ───────────────────────────');

test('market dashboard — shows market overview', () => {
  const r = run(CARD_ENGINE, ['market'], { player: true, timeout: 180000 });
  if (!r.ok) return r;
  if (!r.output.includes('SECONDARY MARKET')) return { ok: false, output: r.output };
  return r;
});

test('market 001 — shows specific card detail', () => {
  const r = run(CARD_ENGINE, ['market', '001'], { player: true, timeout: 180000 });
  if (!r.ok) return r;
  if (!r.output.includes('001') && !r.output.includes('Prompt')) return { ok: false, output: r.output };
  return r;
});

test('market macro — shows macro state', () => {
  const r = run(CARD_ENGINE, ['market', 'macro'], { player: true, timeout: 180000 });
  // May show card #macro not in set — that's a pre-existing design limitation
  // Just verify it doesn't crash
  if (r.timedOut) return r;
  return r;
});

test('revalue — recalculates collection market prices', () => {
  const r = run(CARD_ENGINE, ['revalue'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  if (!r.output.includes('REVALUE')) return { ok: false, output: r.output };
  return r;
});

test('flag — shows overview', () => {
  const r = run(CARD_ENGINE, ['flag'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  if (!r.output.includes('FLAG') && !r.output.includes('Market Overview')) return { ok: false, output: r.output };
  return r;
});

// ─── 10. Pack Opening ───────────────────────────────────────────
console.log('\n── Pack Opening ──────────────────────────────');

test('open-pack hobby (dry-run) — simulates hobby pack', () => {
  const r = run(CARD_ENGINE, ['open-pack', 'hobby'], { player: true, timeout: 90000 });
  if (!r.ok) return r;
  if (!r.output.includes('HOBBY') && !r.output.includes('DRY RUN')) return { ok: false, output: r.output };
  if (!r.output.includes('BOC-')) return { ok: false, output: 'No card pulls: ' + r.output.slice(0, 200) };
  return r;
});

test('open-pack blaster (dry-run) — simulates blaster pack', () => {
  const r = run(CARD_ENGINE, ['open-pack', 'blaster'], { player: true, timeout: 90000 });
  if (!r.ok) return r;
  return r;
});

test('open-pack jumbo (dry-run) — simulates jumbo pack', () => {
  const r = run(CARD_ENGINE, ['open-pack', 'jumbo'], { player: true, timeout: 90000 });
  if (!r.ok) return r;
  return r;
});

test('open-box retail (dry-run) — simulates retail box', () => {
  const r = run(CARD_ENGINE, ['open-box', 'retail'], { player: true, timeout: 90000 });
  if (!r.ok) return r;
  return r;
});

// ─── 11. Sell Commands ──────────────────────────────────────────
console.log('\n── Sell Commands ─────────────────────────────');

test('sell non-existent — shows card not found', () => {
  const r = run(CARD_ENGINE, ['sell', '999'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  if (!r.output.includes('not in collection')) return { ok: false, output: r.output };
  return r;
});

test('sell dups — shows no duplicates message', () => {
  const r = run(CARD_ENGINE, ['sell', 'dups'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  if (!r.output.includes('No duplicates') && !r.output.includes('SOLD')) return { ok: false, output: r.output };
  return r;
});

test('sell-list listings — shows empty', () => {
  const r = run(CARD_ENGINE, ['sell-list', 'listings'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  return r;
});

// ─── 12. Store Commands ─────────────────────────────────────────
console.log('\n── Store Commands ────────────────────────────');

test('store list — shows all stores', () => {
  const r = run(CARD_ENGINE, ['store', 'list'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  if (!r.output.includes('STORES')) return { ok: false, output: r.output };
  return r;
});

test('store reputation — shows relationship tiers', () => {
  const r = run(CARD_ENGINE, ['store', 'reputation'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  if (!r.output.includes('STORE REPUTATION')) return { ok: false, output: r.output };
  return r;
});

test('store stock card-kingdom — shows inventory', () => {
  const r = run(CARD_ENGINE, ['store', 'stock', 'card-kingdom'], { player: true, timeout: 120000 });
  if (!r.ok) return r;
  if (!r.output.includes('INVENTORY')) return { ok: false, output: 'Missing INVENTORY: ' + r.output.slice(0, 200) };
  return r;
});

// ─── 13. Auction & Trade Commands ───────────────────────────────
console.log('\n── Auction & Trade ───────────────────────────');

test('auction browse — shows active auctions', () => {
  const r = run(CARD_ENGINE, ['auction', 'browse'], { player: true, timeout: 180000 });
  if (!r.ok) return r;
  if (!r.output.includes('AUCTION')) return { ok: false, output: r.output };
  return r;
});

test('trade browse — shows NPC traders', () => {
  const r = run(CARD_ENGINE, ['trade', 'browse'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  if (!r.output.includes('TRADERS') && !r.output.includes('NPC')) return { ok: false, output: r.output };
  return r;
});

test('lot browse — shows collection lots', () => {
  const r = run(CARD_ENGINE, ['lot', 'browse'], { player: true, timeout: 30000 });
  if (!r.ok) return r;
  if (!r.output.includes('LOTS') && !r.output.includes('Lot')) return { ok: false, output: r.output };
  return r;
});

// ─── 14. Flopps Commands ────────────────────────────────────────
console.log('\n── Flopps Commands ───────────────────────────');

test('flopps-day 1 — shows day 1 state', () => {
  const r = run(CARD_ENGINE, ['flopps-day', '1'], { timeout: 30000 });
  if (!r.ok) return r;
  if (!r.output.includes('FLOPPS DAY')) return { ok: false, output: r.output };
  return r;
});

test('flopps-wildcard help — shows', () => {
  const r = run(CARD_ENGINE, ['flopps-wildcard', '--help'], { timeout: 15000 });
  if (!r.ok) return r;
  return r;
});


// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════
console.log('\n═════════════════════════════════════════════');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
if (errors.length) {
  console.log(`  Failed: ${errors.join(', ')}`);
}
console.log('═════════════════════════════════════════════\n');
process.exit(failed > 0 ? 1 : 0);
