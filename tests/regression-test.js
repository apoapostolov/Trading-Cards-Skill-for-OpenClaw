#!/usr/bin/env node
'use strict';

/**
 * Regression Test Suite for Trading Cards Skill
 * Tests critical paths and edge cases to ensure migration didn't break anything
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync} = require('child_process');

const SCRIPT_DIR = path.join(__dirname, '..', 'scripts');
const CARD_ENGINE = path.join(SCRIPT_DIR, 'card-engine.js');
const PLAYER_MANAGER = path.join(SCRIPT_DIR, 'player-manager.js');
const AI_SET_GENERATOR = path.join(SCRIPT_DIR, 'ai-set-generator.js');

const TEST_TIMEOUT = 60000;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function makeTempDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'trading-cards-regression-'));
}

function runNode(script, args, dataDir, extraEnv = {}) {
  return execFileSync('node', [script, ...args], {
    cwd: path.dirname(script),
    encoding: 'utf8',
    timeout: TEST_TIMEOUT,
    env: {
      ...process.env,
      TRADING_CARDS_DATA_DIR: dataDir,
      ...extraEnv,
    },
  });
}

function runCardEngine(dataDir, args, extraEnv = {}) {
  return runNode(CARD_ENGINE, args, dataDir, extraEnv);
}

function runPlayerManager(dataDir, args, extraEnv = {}) {
  return runNode(PLAYER_MANAGER, args, dataDir, extraEnv);
}

// ═══════════════════════════════════════════════════════════════
// REGRESSION TESTS
// ═══════════════════════════════════════════════════════════════

function seedFloppsFixture(dataDir, {daysAgo = 14} = {}) {
  const setKey = 'TST-2026';
  const set = {
    code: 'TST',
    name: 'Test Flagship',
    year: 2026,
    category: 'character',
    cards: [
      {num: '001', name: 'Alpha Prime', starTier: 'Legendary', subset: 'Legend', basePrice: 5, currentPrice: 6},
      {num: '002', name: 'Beta Flux', starTier: 'Superstar', subset: 'AllStar', basePrice: 2, currentPrice: 2.4},
      {num: '003', name: 'Gamma Echo', starTier: 'Star', subset: 'Base', basePrice: 1, currentPrice: 1.1},
    ],
  };
  const cardMap = Object.fromEntries(set.cards.map((card) => [card.num, {
    ...card,
    currentPrice: card.currentPrice,
    avgSold7d: card.currentPrice,
    popScore: 0.3,
    demandScore: 0.4,
    salesHistory: [],
  }]));

  const isoDaysAgo = (days) => Date.now() - ((days * 24 + 3) * 60 * 60 * 1000);

  const market = {
    setKey,
    tick: 28,
    sentiment: 1.08,
    createdAt: isoDaysAgo(daysAgo),
    lastTickAt: new Date().toISOString(),
    events: [],
    history: {},
    cards: cardMap,
    cardList: Object.values(cardMap),
    eventLog: [],
    setAggregates: {
      totalChangePct: 3.2,
      priceIndex: [{tick: 28, value: 1.03}],
    },
  };

  const config = {
    wallet: 250,
    activeSet: setKey,
    archivedSets: [],
    mode: 'real',
    pocketMoney: 5,
  };

  const collection = {
    setKey,
    cards: [],
    pulls: {},
    stats: {total: 0, value: 0, spent: 0, boxes: 0, packs: 0, hits: 0, oneOfOnes: 0},
    bestPull: null,
    parallelCounts: {},
    wallet: 250,
    sealedInventory: {},
  };

  const macro = {
    lastFetch: Date.now(),
    source: 'fixture',
    label: 'neutral',
    signal: 0,
    weekPct: 0,
    monthPct: 0,
    compositePct: 0,
    latest: {date: '2026-04-07', value: 5000},
  };

  const wildcardFixture = {
    title: 'Warehouse Curiosity Program',
    summary: 'Flopps announced a Warehouse Curiosity Program that lets select breakers bid on mystery pallets linked to overprint and damaged-pack inventory.',
    paraphrase: 'They found a way to monetize leftovers, confusion, and gambling chemistry at the same time.',
    category: 'marketplace',
    executive: 'Lillian Mercer',
    executiveRole: 'CFO',
    stockDelta: 0.027,
    marketImpact: 'Sealed product prices wobble as collectors speculate about hidden chase cards entering circulation through gray channels.',
    collectorImpact: 'Breakers sprint toward the pallets while singles buyers panic about surprise supply and weird provenance.',
  };

  writeJson(path.join(dataDir, 'config.json'), config);
  writeJson(path.join(dataDir, 'collections', `${setKey}.json`), collection);
  writeJson(path.join(dataDir, 'sets', `${setKey}.json`), set);
  writeJson(path.join(dataDir, 'sets', setKey, 'market.json'), market);
  writeJson(path.join(dataDir, 'market-macro.json'), macro);
  writeJson(path.join(dataDir, 'stores', 'default-stores.json'), []);
  writeJson(path.join(dataDir, 'scalpers', 'default-scalpers.json'), []);
  writeJson(path.join(dataDir, 'fixtures', 'wildcard-event.json'), wildcardFixture);

  return {setKey, wildcardFixture};
}

function testMissingActiveSetDoesNotCreateState() {
  console.log('TEST: Missing active set should not create state...');
  const dataDir = makeTempDataDir();

  runPlayerManager(dataDir, ['register', 'testuser', 'Test User']);

  const cfgPath = path.join(dataDir, 'players', 'testuser', 'config.json');
  const cfg = readJson(cfgPath);
  cfg.activeSet = 'ZZZ-2099'; // Non-existent set
  writeJson(cfgPath, cfg);

  const setPath = path.join(dataDir, 'sets', 'ZZZ-2099.json');
  const colPath = path.join(dataDir, 'players', 'testuser', 'collections', 'ZZZ-2099.json');

  const output = runCardEngine(dataDir, ['open-pack', 'retail']);

  assert.match(output, /No active set/i);
  assert.strictEqual(fs.existsSync(setPath), false, 'open-pack should not create a missing set');
  assert.strictEqual(fs.existsSync(colPath), false, 'open-pack should not create a missing collection');

  console.log('  ✓ Missing set handling correct');
}

function testExplicitGenerationCreatesCollection() {
  console.log('TEST: Explicit set generation should create collection...');
  const dataDir = makeTempDataDir();

  runPlayerManager(dataDir, ['register', 'genuser', 'Gen User']);
  const output = runCardEngine(dataDir, ['generate-set', '--category', 'character', '--seed', '12345']);

  assert.match(output, /NEW SET GENERATED/i);

  const cfgPath = path.join(dataDir, 'players', 'genuser', 'config.json');
  const cfg = readJson(cfgPath);
  assert(cfg.activeSet, 'generate-set should activate a set');

  const setPath = path.join(dataDir, 'sets', `${cfg.activeSet}.json`);
  const colPath = path.join(dataDir, 'players', 'genuser', 'collections', `${cfg.activeSet}.json`);

  assert.strictEqual(fs.existsSync(setPath), true, 'generate-set should create the set file');
  assert.strictEqual(fs.existsSync(colPath), true, 'generate-set should create the collection file');

  const col = readJson(colPath);
  assert.strictEqual(col.setKey, cfg.activeSet);
  assert.deepStrictEqual(col.cards, []);

  console.log('  ✓ Set generation creates collection');
}

function testStipendSweep() {
  console.log('TEST: Stipend sweep for missed days...');
  const dataDir = makeTempDataDir();

  runPlayerManager(dataDir, ['register', 'stipenduser', 'Stipend User']);

  // Manually set last stipend to 3 days ago
  const playersPath = path.join(dataDir, 'players.json');
  const players = readJson(playersPath);
  const today = new Date();
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(today.getDate() - 3);
  players.players.stipenduser.lastStipend = threeDaysAgo.toISOString().split('T')[0];
  writeJson(playersPath, players);

  // Run stipend check
  const output = runPlayerManager(dataDir, ['stipend', 'stipenduser']);

  assert.match(output, /Daily stipend/);
  assert.match(output, /3 days/);
  assert.match(output, /\$15\.00/);

  // Verify wallet updated
  const cfgPath = path.join(dataDir, 'players', 'stipenduser', 'config.json');
  const cfg = readJson(cfgPath);
  assert(cfg.wallet >= 20, `Wallet should be at least $20 (was $${cfg.wallet})`);

  console.log('  ✓ Stipend sweep works');
}

function testStipendAllPlayers() {
  console.log('TEST: Stipend sweep for all players...');
  const dataDir = makeTempDataDir();

  runPlayerManager(dataDir, ['register', 'user1', 'User One']);
  runPlayerManager(dataDir, ['register', 'user2', 'User Two']);

  // Set both to 2 days ago
  const playersPath = path.join(dataDir, 'players.json');
  const players = readJson(playersPath);
  const today = new Date();
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);
  const dateStr = twoDaysAgo.toISOString().split('T')[0];
  players.players.user1.lastStipend = dateStr;
  players.players.user2.lastStipend = dateStr;
  writeJson(playersPath, players);

  const output = runPlayerManager(dataDir, ['stipend', 'all']);

  assert.match(output, /User One/);
  assert.match(output, /User Two/);
  assert.match(output, /Total stipends given: \$20\.00/);

  console.log('  ✓ Stipend all players works');
}

function testFloppsWildcardWithFixture() {
  console.log('TEST: Flopps wildcard with fixture...');
  const dataDir = makeTempDataDir();

  runPlayerManager(dataDir, ['register', 'floppsuser', 'Flopps User']);
  const {wildcardFixture} = seedFloppsFixture(dataDir, {daysAgo: 14});
  const fixturePath = path.join(dataDir, 'fixtures', 'wildcard-event.json');

  // First advance the day
  runCardEngine(dataDir, ['wallet']);

  // Then trigger wildcard
  const wildcardOutput = runCardEngine(dataDir, ['flopps-wildcard'], {
    FLOPPS_WILDCARD_FIXTURE: fixturePath,
  });

  assert.match(wildcardOutput, new RegExp(wildcardFixture.title));
  assert.match(wildcardOutput, /Flopps/);

  // Check state was recorded
  const statePath = path.join(dataDir, 'flopps', 'state.json');
  const state = readJson(statePath);
  assert(state, 'Flopps state should exist');
  assert.strictEqual(state.latestNews.kind, 'wildcard');

  console.log('  ✓ Flopps wildcard works');
}

function testFloppsStatusAndDay() {
  console.log('TEST: Flopps status and day commands...');
  const dataDir = makeTempDataDir();

  runPlayerManager(dataDir, ['register', 'statususer', 'Status User']);
  seedFloppsFixture(dataDir, {daysAgo: 14});

  runCardEngine(dataDir, ['wallet']); // Advance day

  const statusOutput = runCardEngine(dataDir, ['flopps-status']);
  assert.match(statusOutput, /Flopps|FLPS/i);

  const dayOutput = runCardEngine(dataDir, ['flopps-day', 'today']);
  assert.match(dayOutput, /day/i);

  console.log('  ✓ Flopps status/day commands work');
}

function testCategoryGeneration() {
  console.log('TEST: Different category generations...');
  const dataDir = makeTempDataDir();

  runPlayerManager(dataDir, ['register', 'catuser', 'Cat User']);

  // Test sports category
  const sportsOutput = runCardEngine(dataDir, ['generate-set', '--category', 'sports', '--sport', 'basketball', '--cards', '30']);
  assert.match(sportsOutput, /NEW SET GENERATED/);

  const cfg = readJson(path.join(dataDir, 'players', 'catuser', 'config.json'));
  const setFile = path.join(dataDir, 'sets', `${cfg.activeSet}.json`);
  const set = readJson(setFile);
  assert.strictEqual(set.category, 'sports');
  assert.strictEqual(set.sport, 'basketball');

  console.log('  ✓ Category generation works');
}

function testWalletChecks() {
  console.log('TEST: Wallet insufficient funds handling...');
  const dataDir = makeTempDataDir();

  runPlayerManager(dataDir, ['register', 'pooruser', 'Poor User']);
  runCardEngine(dataDir, ['generate-set', '--category', 'character', '--cards', '30']);

  // Set wallet to $3
  runCardEngine(dataDir, ['set-money', '3']);

  // Try to buy a retail pack ($5)
  const output = runCardEngine(dataDir, ['open-pack', 'retail', '--real']);

  // Should refuse or indicate insufficient funds
  assert(output.includes('insufficient') || output.includes('Not enough') || output.includes('short') || output.includes('$3'));

  console.log('  ✓ Wallet checks work');
}

function testGrading() {
  console.log('TEST: Card grading...');
  const dataDir = makeTempDataDir();

  runPlayerManager(dataDir, ['register', 'gradeuser', 'Grade User']);
  runCardEngine(dataDir, ['generate-set', '--category', 'character', '--cards', '30']);
  runCardEngine(dataDir, ['add-money', '100']);
  runCardEngine(dataDir, ['open-pack', 'retail', '--real']);

  const config = readJson(path.join(dataDir, 'players', 'gradeuser', 'config.json'));
  const collection = readJson(path.join(dataDir, 'players', 'gradeuser', 'collections', `${config.activeSet}.json`));

  if (collection.cards.length === 0) {
    console.log('  ⚠ Skipping grading test - no cards pulled');
    return;
  }

  const cardNum = collection.cards[0].cardNum;
  const gradingOutput = runCardEngine(dataDir, ['grade-card', String(cardNum)]);

  assert.match(gradingOutput, /PSA|graded|Grade/i);

  console.log('  ✓ Card grading works');
}

function testHistoryLogging() {
  console.log('TEST: History logging...');
  const dataDir = makeTempDataDir();

  runPlayerManager(dataDir, ['register', 'historyuser', 'History User']);
  runCardEngine(dataDir, ['generate-set', '--category', 'character', '--cards', '30']);
  runCardEngine(dataDir, ['add-money', '100']);
  runCardEngine(dataDir, ['open-pack', 'retail', '--real']);

  const historyOutput = runCardEngine(dataDir, ['history']);
  assert.match(historyOutput, /History|history/i);

  // History file should exist with content
  const historyPath = path.join(dataDir, 'players', 'historyuser', 'history.jsonl');
  if (fs.existsSync(historyPath)) {
    const historyContent = fs.readFileSync(historyPath, 'utf8');
    assert(historyContent.length > 0, 'History file should have content');
  }

  console.log('  ✓ History logging works');
}

function testSelling() {
  console.log('TEST: Card selling...');
  const dataDir = makeTempDataDir();

  runPlayerManager(dataDir, ['register', 'selluser', 'Sell User']);
  runCardEngine(dataDir, ['generate-set', '--category', 'character', '--cards', '30']);
  runCardEngine(dataDir, ['add-money', '100']);
  runCardEngine(dataDir, ['open-pack', 'retail', '--real']);

  const config = readJson(path.join(dataDir, 'players', 'selluser', 'config.json'));
  const collection = readJson(path.join(dataDir, 'players', 'selluser', 'collections', `${config.activeSet}.json`));

  if (collection.cards.length === 0) {
    console.log('  ⚠ Skipping selling test - no cards pulled');
    return;
  }

  const walletBefore = config.wallet;
  const cardNum = collection.cards[0].cardNum;

  const sellOutput = runCardEngine(dataDir, ['sell', String(cardNum)]);
  assert.match(sellOutput, /Sold|sold|\$/);

  // Wallet should increase
  const configAfter = readJson(path.join(dataDir, 'players', 'selluser', 'config.json'));
  assert(configAfter.wallet > walletBefore, 'Wallet should increase after selling');

  console.log('  ✓ Card selling works');
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║   Trading Cards Skill - Regression Tests                   ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

try {
  testMissingActiveSetDoesNotCreateState();
  testExplicitGenerationCreatesCollection();
  testStipendSweep();
  testStipendAllPlayers();
  testFloppsWildcardWithFixture();
  testFloppsStatusAndDay();
  testCategoryGeneration();
  testWalletChecks();
  testGrading();
  testHistoryLogging();
  testSelling();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   ✓ ALL REGRESSION TESTS PASSED                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  process.exit(0);
} catch (err) {
  console.error('\n╔════════════════════════════════════════════════════════════╗');
  console.error('║   ✗ REGRESSION TEST FAILED                                 ║');
  console.error('╚════════════════════════════════════════════════════════════╝');
  console.error('\nError:', err.message);
  console.error('\nStack:', err.stack);
  process.exit(1);
}
