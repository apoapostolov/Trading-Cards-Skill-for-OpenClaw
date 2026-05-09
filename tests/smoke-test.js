#!/usr/bin/env node
'use strict';

/**
 * Smoke Test Suite for Trading Cards Skill
 * Quick validation that core functionality works after migration
 * Focuses on fast operations only
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync} = require('child_process');

const SCRIPT_DIR = path.join(__dirname, '..', 'scripts');
const CARD_ENGINE = path.join(SCRIPT_DIR, 'card-engine.js');
const PLAYER_MANAGER = path.join(SCRIPT_DIR, 'player-manager.js');

// Test configuration
const TEST_TIMEOUT = 30000;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function makeTempDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'trading-cards-smoke-'));
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
// TESTS
// ═══════════════════════════════════════════════════════════════

function testPlayerRegistration() {
  console.log('TEST: Player registration...');
  const dataDir = makeTempDataDir();

  const output = runPlayerManager(dataDir, ['register', 'testuser', 'Test User']);
  assert(output.includes('PLAYER REGISTERED') || output.includes('registered'));

  const playersJson = readJson(path.join(dataDir, 'players.json'));
  assert(playersJson.players.testuser, 'Player should exist in players.json');

  console.log('  ✓ Player registration works');
}

function testPlayerSwitching() {
  console.log('TEST: Player switching...');
  const dataDir = makeTempDataDir();

  runPlayerManager(dataDir, ['register', 'user1', 'User One']);
  runPlayerManager(dataDir, ['register', 'user2', 'User Two']);

  const output1 = runPlayerManager(dataDir, ['player', 'user1']);
  assert(output1.includes('user1') || output1.includes('User One'));

  const output2 = runPlayerManager(dataDir, ['player', 'user2']);
  assert(output2.includes('user2') || output2.includes('User Two'));

  console.log('  ✓ Player switching works');
}

function testWalletOperations() {
  console.log('TEST: Wallet operations...');
  const dataDir = makeTempDataDir();

  // Generate set first so new player will copy the activeSet
  runCardEngine(dataDir, ['generate-set', '--category', 'character', '--cards', '10', '--seed', '12345']);
  
  runPlayerManager(dataDir, ['register', 'walletuser', 'Wallet User']);
  runPlayerManager(dataDir, ['player', 'walletuser']);

  const playerDir = path.join(dataDir, 'players', 'walletuser');
  
  const walletOutput = runCardEngine(playerDir, ['wallet']);
  assert.match(walletOutput, /WALLET|Wallet|Cash/i);
  assert.match(walletOutput, /\$5\.00/);

  runCardEngine(playerDir, ['add-money', '50']);
  const walletAfterAdd = runCardEngine(playerDir, ['wallet']);
  assert.match(walletAfterAdd, /\$55\.00/);

  console.log('  ✓ Wallet operations work');
}

function testSetGeneration() {
  console.log('TEST: Procedural set generation...');
  const dataDir = makeTempDataDir();

  const output = runCardEngine(dataDir, ['generate-set', '--category', 'character', '--cards', '10', '--seed', '12345']);

  assert.match(output, /NEW SET GENERATED/);
  assert.match(output, /Cards:\s*10|10 cards/i);

  const rootConfig = readJson(path.join(dataDir, 'config.json'));
  assert(rootConfig.activeSet, 'Root config should have active set');

  const setFile = path.join(dataDir, 'sets', `${rootConfig.activeSet}.json`);
  assert(fs.existsSync(setFile), `Set file should exist: ${setFile}`);

  const set = readJson(setFile);
  assert.strictEqual(set.cards.length, 10, 'Set should have 10 cards');

  console.log('  ✓ Set generation works');
}

function testPackOpeningDryRun() {
  console.log('TEST: Pack opening (dry-run)...');
  const dataDir = makeTempDataDir();

  // Generate set first
  runCardEngine(dataDir, ['generate-set', '--category', 'character', '--cards', '10', '--seed', '12345']);
  
  runPlayerManager(dataDir, ['register', 'packuser', 'Pack User']);
  runPlayerManager(dataDir, ['player', 'packuser']);
  
  const playerDir = path.join(dataDir, 'players', 'packuser');

  const output = runCardEngine(playerDir, ['open-pack', 'retail']);

  assert.match(output, /PACK|RETAIL PACK|📦/i);
  assert.match(output, /1\.|2\.|3\./);

  console.log('  ✓ Pack opening (dry-run) works');
}

function testFloppsCommands() {
  console.log('TEST: Flopps commands...');
  const dataDir = makeTempDataDir();

  runCardEngine(dataDir, ['generate-set', '--category', 'character', '--cards', '10', '--seed', '12345']);

  const statusOutput = runCardEngine(dataDir, ['flopps-status']);
  assert.match(statusOutput, /Flopps|FLPS|day|status/i);

  console.log('  ✓ Flopps commands work');
}

function testHelpCommand() {
  console.log('TEST: Help command...');
  const dataDir = makeTempDataDir();

  // Generate set and create player for player-scoped help
  runCardEngine(dataDir, ['generate-set', '--category', 'character', '--cards', '10', '--seed', '12345']);
  runPlayerManager(dataDir, ['register', 'helpuser', 'Help User']);
  runPlayerManager(dataDir, ['player', 'helpuser']);
  
  const playerDir = path.join(dataDir, 'players', 'helpuser');
  const output = runCardEngine(playerDir, ['help']);
  assert(output.includes('Commands:') || output.includes('Usage:') || output.includes('generate-set'));

  console.log('  ✓ Help command works');
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║   Trading Cards Skill - Smoke Tests                       ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const tests = [
  testPlayerRegistration,
  testPlayerSwitching,
  testWalletOperations,
  testSetGeneration,
  testPackOpeningDryRun,
  testFloppsCommands,
  testHelpCommand,
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    test();
    passed++;
  } catch (err) {
    failed++;
    console.error(`\n✗ ${test.name} FAILED:`, err.message);
  }
}

console.log('\n╔════════════════════════════════════════════════════════════╗');
if (failed === 0) {
  console.log('║   ✓ ALL SMOKE TESTS PASSED                                 ║');
} else {
  console.log(`║   ✗ ${failed} TEST(S) FAILED                              ║`);
}
console.log('╚════════════════════════════════════════════════════════════╝\n');

process.exit(failed > 0 ? 1 : 0);
