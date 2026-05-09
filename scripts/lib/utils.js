#!/usr/bin/env node
'use strict';

/**
 * Shared utilities for trading-cards skill
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ═════════════════════════════════════════════════════════════════════════════
// PATHS & DIRECTORIES
// ═════════════════════════════════════════════════════════════════════════════

const getDataDir = () => process.env.TRADING_CARDS_DATA_DIR 
  ? path.resolve(process.env.TRADING_CARDS_DATA_DIR) 
  : path.join(__dirname, '..', '..', 'data');

const getPaths = () => {
  const dataDir = getDataDir();
  return {
    dataDir,
    sets: path.join(dataDir, 'sets'),
    collections: path.join(dataDir, 'collections'),
    market: path.join(dataDir, 'market'),
    flopps: path.join(dataDir, 'flopps'),
    grading: path.join(dataDir, 'grading'),
  };
};

// ═════════════════════════════════════════════════════════════════════════════
// FILE I/O
// ═════════════════════════════════════════════════════════════════════════════

function rJ(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function wJ(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

// ═════════════════════════════════════════════════════════════════════════════
// RNG & MATH
// ═════════════════════════════════════════════════════════════════════════════

function mulberry32(a) {
  return function() {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let ENGINE_BASE_SEED = null;
let GLOBAL_RNG = () => crypto.randomInt(0, 0x100000000) / 0x100000000;

function RNG() { return GLOBAL_RNG(); }

function setEngineSeed(seed) {
  if (seed === undefined || seed === null || seed === '') {
    ENGINE_BASE_SEED = null;
    GLOBAL_RNG = () => crypto.randomInt(0, 0x100000000) / 0x100000000;
    return;
  }
  ENGINE_BASE_SEED = normalizeSeed(seed);
  GLOBAL_RNG = mulberry32(ENGINE_BASE_SEED);
}

function normalizeSeed(seed) {
  if (typeof seed === 'number') return seed >>> 0;
  if (typeof seed === 'string') {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    return hash >>> 0;
  }
  return Date.now() >>> 0;
}

function gaussRand(mean, std) {
  let u = 0, v = 0;
  while (!u) u = RNG();
  while (!v) v = RNG();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * std + mean;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ═════════════════════════════════════════════════════════════════════════════
// FORMATTING
// ═════════════════════════════════════════════════════════════════════════════

const fm$ = (n) => '$' + (typeof n === 'number' ? n.toFixed(2) : '0.00');

function progressStr(elapsed, total) {
  const pct = Math.min(elapsed / total, 1);
  const filled = Math.round(pct * 15);
  return '█'.repeat(filled) + '░'.repeat(15 - filled);
}

function pR(name, len) {
  return (name || '').padEnd(len || 18);
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═════════════════════════════════════════════════════════════════════════════

module.exports = {
  getDataDir,
  getPaths,
  rJ,
  wJ,
  RNG,
  setEngineSeed,
  normalizeSeed,
  gaussRand,
  clamp,
  fm$,
  progressStr,
  pR,
};
