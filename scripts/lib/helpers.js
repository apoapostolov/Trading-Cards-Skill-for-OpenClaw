'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  GRADES, PSA_TIERS, TIERS, SUBS, PLATES,
  HINT_CENTERING, HINT_CORNERS, HINT_EDGES, HINT_SURFACE, HINT_APPEAL,
  PACKS,
} = require('./constants.js');

// ─── Data Directory ────────────────────────────────────────────────
const getDataDir = () => process.env.TRADING_CARDS_DATA_DIR
  ? path.resolve(process.env.TRADING_CARDS_DATA_DIR)
  : path.join(__dirname, '..', '..', 'data');

const FLOPPS_DIR = () => path.join(getDataDir(), 'flopps');
const FLOPPS_STATE_FILE = () => path.join(FLOPPS_DIR(), 'state.json');
const FLOPPS_WILDCARD_DIR = () => path.join(FLOPPS_DIR(), 'wildcards');

// ─── Mutable LOG reference — the main module sets LOG.current ─────
const LOG = { current: null };

// ─── RNG / Seed Engine ─────────────────────────────────────────────
function mulberry32(a) {
  return function () {
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

function normalizeSeed(seed, fallback = Date.now()) {
  const n = Number(seed);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function setEngineSeed(seed) {
  if (seed === undefined || seed === null || seed === '') {
    ENGINE_BASE_SEED = null;
    GLOBAL_RNG = () => crypto.randomInt(0, 0x100000000) / 0x100000000;
    return;
  }
  ENGINE_BASE_SEED = normalizeSeed(seed);
  GLOBAL_RNG = mulberry32(ENGINE_BASE_SEED);
}

// ─── File I/O Utilities ────────────────────────────────────────────
function rJ(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function wJ(p, d) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(d, null, 2));
  LOG.current?.debug?.('write', { path: p });
}

function pwK(arr, k, rng) {
  const t = arr.reduce((s, x) => s + x[k], 0);
  let r = rng() * t;
  for (const x of arr) { r -= x[k]; if (r <= 0) return x; }
  return arr[arr.length - 1];
}

function ri(rng, a, b) {
  const r = rng || RNG;
  return Math.floor(r() * (b - a + 1)) + a;
}

function fm$(n) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function pR(s, w) {
  return s.length < w ? s + ' '.repeat(w - s.length) : s.slice(0, w);
}

// ─── Config ────────────────────────────────────────────────────────
function loadCfg() {
  return rJ(path.join(getDataDir(), 'config.json')) || { activeSet: null, archivedSets: [], mode: 'virtual', pocketMoney: 5 };
}

function saveCfg(c) {
  wJ(path.join(getDataDir(), 'config.json'), c);
}

// ─── Player Context ────────────────────────────────────────────────
function isPlayerScopedDataDir() {
  const abs = path.resolve(getDataDir());
  return path.basename(path.dirname(abs)) === 'players' && fs.existsSync(path.join(abs, 'config.json'));
}

function requirePlayerContext(command) {
  if (isPlayerScopedDataDir()) return true;
  console.log(`\n  ❌ "${command}" requires a player-scoped data directory.\n  Run: TRADING_CARDS_DATA_DIR=$(node scripts/player-manager.js dir) node scripts/card-engine.js ${command}\n`);
  return false;
}

// ─── Set / Collection Loaders ──────────────────────────────────────
function loadSet() {
  const c = loadCfg();
  if (!c.activeSet) return null;
  const p = path.join(getDataDir(), 'sets', c.activeSet + '.json');
  const s = rJ(p);
  if (!s) LOG.current?.warn?.('missing-set', { activeSet: c.activeSet, path: p });
  return s;
}

function createEmptyCollection(setKey, wallet) {
  return {
    setKey,
    cards: [],
    pulls: {},
    stats: { total: 0, value: 0, spent: 0, boxes: 0, packs: 0, hits: 0, oneOfOnes: 0 },
    bestPull: null,
    parallelCounts: {},
    wallet: wallet ?? 0,
    sealedInventory: {},
  };
}

function loadCol(sk) {
  const c = loadCfg();
  const k = sk || c.activeSet;
  if (!k) return null;
  const cp = path.join(getDataDir(), 'collections', k + '.json');
  const col = rJ(cp);
  if (!col) {
    LOG.current?.warn?.('missing-collection-auto-creating', { setKey: k, path: cp });
    const cfg2 = loadCfg();
    const empty = createEmptyCollection(k, cfg2.wallet);
    wJ(cp, empty);
    return empty;
  }
  if (!col.sealedInventory) col.sealedInventory = {};
  return col;
}

function saveCol(col) {
  LOG.current?.log?.('save-collection', {
    setKey: col?.setKey,
    wallet: col?.wallet,
    cardCount: col?.cards?.length || 0,
    packCount: col?.stats?.packs || 0,
  });
  wJ(path.join(getDataDir(), 'collections', col.setKey + '.json'), col);
}

function rebuildPulls(col) {
  col.pulls = {};
  col.cards.forEach(c => col.pulls[c.cardNum] = (col.pulls[c.cardNum] || 0) + 1);
}

// ─── Acquisition Tracking ──────────────────────────────────────────
function nextAcquisitionBatchId(col) {
  if (!col.acquisitionSeq) col.acquisitionSeq = 0;
  col.acquisitionSeq += 1;
  return `${Date.now()}-${col.acquisitionSeq}`;
}

function createAcquisitionTracker(col, { opType, packType, packIndex } = {}) {
  const batchId = nextAcquisitionBatchId(col);
  const tracker = {
    batchId, opType: opType || null, packType: packType || null,
    packIndex: packIndex ?? null, openedAt: new Date().toISOString(),
    pullsBefore: { ...(col?.pulls || {}) },          // unchanged: cardNum → count (backward compat)
    pullsBeforeByKey: {},                              // "cardNum:parallel" → count
    prevCardInfo: {},                                   // cardNum → {maxPrice, maxRarityIdx, parallels[]}
    openingSeen: {},                                    // unchanged: cardNum → count (within pack)
    openingSeenByKey: {},                               // "cardNum:parallel" → count (within pack)
  };
  if (col?.cards) {
    col.cards.forEach(c => {
      const key = `${c.cardNum}:${c.parallel}`;
      tracker.pullsBeforeByKey[key] = (tracker.pullsBeforeByKey[key] || 0) + 1;
      if (!tracker.prevCardInfo[c.cardNum]) {
        tracker.prevCardInfo[c.cardNum] = { maxPrice: 0, maxRarityIdx: -1, parallels: [] };
      }
      const info = tracker.prevCardInfo[c.cardNum];
      if (c.price > info.maxPrice) info.maxPrice = c.price;
      info.parallels.push(c.parallel);
    });
  }
  return tracker;
}

function annotateAcquiredCard(card, tracker) {
  if (!tracker) return card;
  card.acquiredBatchId = tracker.batchId;
  card.acquiredOpType = tracker.opType;
  card.acquiredPackType = tracker.packType;
  card.acquiredPackIndex = tracker.packIndex;
  card.acquiredAt = tracker.openedAt;

  // True duplicate check: same cardNum AND same parallel
  const key = `${card.cardNum}:${card.parallel}`;
  const prevDup = (tracker.pullsBeforeByKey?.[key] || 0) + (tracker.openingSeenByKey?.[key] || 0);
  const currentDup = prevDup + 1;
  card.acquiredCopyIndex = currentDup;
  card.acquiredIsDuplicate = currentDup > 1;

  // Variant detection: cardNum already owned, but with a DIFFERENT parallel
  const prevInfo = tracker.prevCardInfo?.[card.cardNum];
  const prevCardNumTotal = prevInfo ? prevInfo.parallels.length : 0;
  card.acquiredIsVariant = !card.acquiredIsDuplicate && prevCardNumTotal > 0;

  // Best variant: this variant has higher price than any existing variant of this cardNum
  card.acquiredIsBestVariant = card.acquiredIsVariant && prevInfo && card.price > prevInfo.maxPrice;

  tracker.openingSeen[card.cardNum] = (tracker.openingSeen[card.cardNum] || 0) + 1;
  tracker.openingSeenByKey[key] = (tracker.openingSeenByKey[key] || 0) + 1;
  return card;
}

function setLastAcquisitionBatch(col, tracker, summary = {}) {
  if (!col || !tracker) return;
  col.lastAcquisitionBatch = {
    id: tracker.batchId,
    opType: tracker.opType,
    packType: tracker.packType,
    packIndex: tracker.packIndex,
    openedAt: tracker.openedAt,
    duplicateCount: summary.duplicateCount || 0,
    newCount: summary.newCount || 0,
    cardCount: summary.cardCount || 0,
  };
}

function getLatestAcquisitionBatch(col) {
  return col?.lastAcquisitionBatch || null;
}

// ─── Sealed Inventory ──────────────────────────────────────────────
function ensureSealedInventory(col) {
  if (!col.sealedInventory) col.sealedInventory = {};
  return col.sealedInventory;
}

function getSealedInventoryEntry(col, product) {
  return col?.sealedInventory?.[product] || null;
}

function getSealedQty(col, product) {
  return getSealedInventoryEntry(col, product)?.qty || 0;
}

function addSealedProduct(col, product, qty, meta = {}) {
  const inv = ensureSealedInventory(col);
  const entry = inv[product] || { qty: 0, spent: 0, history: [] };
  entry.qty += qty;
  if (Number.isFinite(meta.spent)) entry.spent += (meta.spent || 0);
  entry.updatedAt = new Date().toISOString();
  if (meta.source || meta.storeName) {
    if (!Array.isArray(entry.history)) entry.history = [];
    entry.history.push({
      timestamp: new Date().toISOString(),
      source: meta.source || 'unknown',
      storeId: meta.storeId || null,
      storeName: meta.storeName || null,
      qty,
      spent: meta.spent || 0,
    });
    if (entry.history.length > 10) entry.history = entry.history.slice(-10);
  }
  inv[product] = entry;
}

function consumeSealedProduct(col, product, qty = 1) {
  const entry = getSealedInventoryEntry(col, product);
  if (!entry || entry.qty < qty) return false;
  entry.qty -= qty;
  entry.updatedAt = new Date().toISOString();
  if (entry.qty <= 0) delete col.sealedInventory[product];
  return true;
}

function getSealedInventoryValue(col) {
  if (!col?.sealedInventory) return 0;
  let total = 0;
  for (const [product, entry] of Object.entries(col.sealedInventory)) {
    const pt = PACKS[product];
    if (!pt) continue;
    total += (entry.qty || 0) * pt.price;
  }
  return total;
}

function formatSealedInventorySummary(col) {
  if (!col?.sealedInventory) return '';
  const bits = [];
  for (const [product, entry] of Object.entries(col.sealedInventory)) {
    const pt = PACKS[product];
    if (!pt || !(entry.qty > 0)) continue;
    bits.push(`${entry.qty}× ${pt.name}`);
  }
  return bits.join(' │ ');
}

// ─── Real / Virtual ────────────────────────────────────────────────
function isReal() { return process.argv.includes('--real'); }

// ─── Card Generation ───────────────────────────────────────────────
function genCard(num, cat, theme, rng) {
  const cr = mulberry32(num * 13 + cat.f.length * 7 + cat.l.length * 3);
  const tier = pwK(TIERS, 'w', cr);
  const sub = pwK(SUBS, 'w', cr);
  const name = cat.f[ri(cr, 0, cat.f.length - 1)] + ' ' + cat.l[ri(cr, 0, cat.l.length - 1)];
  const ds = [
    `${name} dominates the ${theme} circuit`,
    `A legend of ${theme}, ${name} never backs down`,
    `${name}'s legacy in ${theme} is unmatched`,
    `The ${theme} chronicles feature ${name}`,
    `${name} rose through ${theme} with unmatched skill`,
  ];
  const stats = {};
  for (const k of ['power', 'speed', 'technique', 'endurance', 'charisma']) {
    stats[k] = ri(cr, tier.st[0], tier.st[1]);
  }
  return {
    num: String(num).padStart(3, '0'),
    name,
    subset: sub.name,
    starTier: tier.name,
    stats,
    desc: ds[ri(cr, 0, 4)],
    basePrice: tier.pr[0] + cr() * (tier.pr[1] - tier.pr[0]),
  };
}

function genSetCode(rng) {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 3; i++) s += c[ri(rng, 0, 25)];
  return s;
}

// ─── Grading Helpers ───────────────────────────────────────────────
const GRADING_DIR = path.join(getDataDir(), 'grading');
const COMPANIES_FILE = path.join(GRADING_DIR, 'companies.json');
const GRADING_STATE_FILE = path.join(GRADING_DIR, 'state.json');
const POP_FILE = path.join(GRADING_DIR, 'population.json');

function loadCompanies() { return rJ(COMPANIES_FILE) || {}; }
function loadGradingState() {
  let s = rJ(GRADING_STATE_FILE);
  if (!s) s = { submissions: [], history: [] };
  return s;
}
function saveGradingState(s) { wJ(GRADING_STATE_FILE, s); }
function loadPopulation() { return rJ(POP_FILE) || {}; }
function savePopulation(p) { wJ(POP_FILE, p); }

// ─── Math / Statistics ─────────────────────────────────────────────
function gaussRand(mean, std) {
  let u = 0, v = 0;
  while (!u) u = RNG();
  while (!v) v = RNG();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * std + mean;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ─── Condition ─────────────────────────────────────────────────────
function generateCondition(tier) {
  const tierBoost = (tier === 'Legendary') ? 1.2 : (tier === 'Superstar') ? 0.8 : (tier === 'Star') ? 0.4 : 0;
  return {
    centering: Math.round(clamp(gaussRand(85 + tierBoost, 8), 50, 100)),
    corners: Math.round(clamp(gaussRand(8 + tierBoost * 0.1, 1.2), 1, 100)) / 10,
    edges: Math.round(clamp(gaussRand(8.5 + tierBoost * 0.05, 1.0), 1, 100)) / 10,
    surface: Math.round(clamp(gaussRand(8 + tierBoost * 0.08, 1.5), 1, 100)) / 10,
  };
}

function ensureCondition(card) {
  if (card.condition) return card.condition;
  const cond = generateCondition(card.starTier || 'Common');
  card.condition = cond;
  return cond;
}

// ─── Grading Logic ─────────────────────────────────────────────────
function psaTierForValue(v) {
  return PSA_TIERS.find(t => v <= t.maxVal) || PSA_TIERS[PSA_TIERS.length - 1];
}

function conditionToGrade(cond, company) {
  const comp = loadCompanies()[company];
  if (!comp) return conditionToGrade(cond, 'PSA');
  const strict = comp.strictness || 0;
  const cCentering = cond.centering / 10;
  const cCorners = cond.corners;
  const cEdges = cond.edges;
  const cSurface = cond.surface;
  const avg = (cCentering * 0.25 + cCorners * 0.25 + cEdges * 0.25 + cSurface * 0.25);
  const variance = (RNG() - 0.5) * 0.5;
  let score = avg + variance + strict * 0.15;
  score = clamp(score, 1, 10);
  if (score >= 9.5) return 10;
  if (score >= 8.75) return 9;
  if (score >= 8.0) return 8.5;
  if (score >= 7.0) return 8;
  if (score >= 6.0) return 7;
  if (score >= 5.0) return 6;
  if (score >= 4.0) return 5;
  if (score >= 3.0) return 4;
  if (score >= 2.0) return 3;
  if (score >= 1.0) return 2;
  return 1;
}

function isBlackLabel(cond) {
  return cond.centering >= 95 && cond.corners >= 9.8 && cond.edges >= 9.8 && cond.surface >= 9.8;
}

function gradeMultiplier(grade, company, cond) {
  const base = { 10: 3, 9: 2.5, 8.5: 1.8, 8: 1.3, 7: 1.0, 6: 0.85, 5: 0.7, 4: 0.5, 3: 0.35, 2: 0.2, 1: 0.1 }[grade] || 1;
  let mult = base;
  if (company === 'BGS' && grade === 10 && isBlackLabel(cond)) mult *= 2.5;
  if (company === 'PSA') mult *= 1.1;
  if (company === 'SGC') mult *= 0.9;
  return mult;
}

function estimateGradeProbability(cond, company, targetGrade) {
  let hits = 0;
  const trials = 200;
  for (let i = 0; i < trials; i++) {
    if (conditionToGrade(cond, company) >= targetGrade) hits++;
  }
  return hits / trials;
}

function gradeLabel(grade, company, cond) {
  if (company === 'BGS' && grade === 10 && isBlackLabel(cond)) return 'BGS 10 Black Label 💎';
  return `${company} ${grade}`;
}

function progressStr(elapsed, total) {
  const pct = Math.min(elapsed / total, 1);
  const filled = Math.round(pct * 15);
  return '█'.repeat(filled) + '░'.repeat(15 - filled);
}

// ─── Population ────────────────────────────────────────────────────
function bumpPopulation(setKey, cardNum, company, grade) {
  const pop = loadPopulation();
  if (!pop[setKey]) pop[setKey] = {};
  if (!pop[setKey][cardNum]) pop[setKey][cardNum] = { totalGraded: 0 };
  const card = pop[setKey][cardNum];
  if (!card[company]) card[company] = {};
  card[company][grade] = (card[company][grade] || 0) + 1;
  card.totalGraded++;
  const npcChance = RNG();
  if (npcChance < 0.3) {
    const npcCompanies = ['PSA', 'BGS', 'SGC'];
    const npcCompany = npcCompanies[Math.floor(RNG() * npcCompanies.length)];
    const npcGrades = [10, 9, 8.5, 8, 7];
    const npcGrade = npcGrades[Math.floor(RNG() * npcGrades.length)];
    if (!card[npcCompany]) card[npcCompany] = {};
    card[npcCompany][npcGrade] = (card[npcCompany][npcGrade] || 0) + 1;
    card.totalGraded++;
  }
  savePopulation(pop);
}

function simNpcPopulationGrowth(setKey, cardNum) {
  const pop = loadPopulation();
  if (!pop[setKey] || !pop[setKey][cardNum]) return;
  const card = pop[setKey][cardNum];
  const currentTotal = card.totalGraded;
  const growth = Math.floor(RNG() * Math.min(3, Math.max(1, currentTotal * 0.05)));
  for (let i = 0; i < growth; i++) {
    const npcCompanies = ['PSA', 'BGS', 'SGC'];
    const weights = [0.5, 0.3, 0.2];
    let r = RNG();
    let npcCompany = 'PSA';
    let acc = 0;
    for (let j = 0; j < npcCompanies.length; j++) {
      acc += weights[j];
      if (r <= acc) { npcCompany = npcCompanies[j]; break; }
    }
    const npcGrades = [10, 9, 8.5, 8, 7];
    const npcWeights = [0.08, 0.3, 0.25, 0.22, 0.15];
    let r2 = RNG();
    let npcGrade = 9;
    let acc2 = 0;
    for (let j = 0; j < npcGrades.length; j++) {
      acc2 += npcWeights[j];
      if (r2 <= acc2) { npcGrade = npcGrades[j]; break; }
    }
    if (!card[npcCompany]) card[npcCompany] = {};
    card[npcCompany][npcGrade] = (card[npcCompany][npcGrade] || 0) + 1;
    card.totalGraded++;
  }
  savePopulation(pop);
}

// ─── Grade Rolls ───────────────────────────────────────────────────
function rollGrade() {
  const t = GRADES.reduce((s, g) => s + g.w, 0);
  let r = RNG() * t;
  for (const g of GRADES) { r -= g.w; if (r <= 0) return g; }
  return GRADES[2];
}

function generateQuality(gradeInput) {
  const grade = typeof gradeInput === 'object' ? gradeInput.grade : gradeInput;
  const hintCount = grade >= 9 ? 1 : grade >= 7 ? 2 : grade >= 5 ? 3 : 4;
  const pick = (pool) => pool[Math.floor(RNG() * pool.length)];
  const gradeHints = HINT_CENTERING[grade] || HINT_CENTERING[8];
  const cornerHints = HINT_CORNERS[grade] || HINT_CORNERS[8];
  const edgeHints = HINT_EDGES[grade] || HINT_EDGES[8];
  const surfaceHints = HINT_SURFACE[grade] || HINT_SURFACE[8];
  const appealHints = HINT_APPEAL[grade] || HINT_APPEAL[8];
  const hints = [];
  hints.push(pick(appealHints));
  const cats = [
    { pool: gradeHints, cat: 'centering' },
    { pool: cornerHints, cat: 'corners' },
    { pool: edgeHints, cat: 'edges' },
    { pool: surfaceHints, cat: 'surface' },
  ];
  const shuffled = cats.sort(() => RNG() - 0.5);
  for (let i = 0; i < Math.min(hintCount, shuffled.length); i++) {
    hints.push(pick(shuffled[i].pool));
  }
  if (grade <= 4) hints.push(pick(cornerHints));
  return { grade, hints, graded: false };
}

function getCond() {
  const g = rollGrade();
  return { name: g.name, m: g.mult, grade: g.grade };
}

// ─── Exports ───────────────────────────────────────────────────────
module.exports = {
  // RNG
  mulberry32,
  ENGINE_BASE_SEED,
  GLOBAL_RNG,
  LOG,
  RNG,
  setEngineSeed,
  // File I/O
  rJ,
  wJ,
  pwK,
  ri,
  fm$,
  pR,
  // Config
  loadCfg,
  saveCfg,
  // Player context
  isPlayerScopedDataDir,
  requirePlayerContext,
  // Set / Collection
  loadSet,
  createEmptyCollection,
  loadCol,
  saveCol,
  rebuildPulls,
  // Acquisition tracking
  nextAcquisitionBatchId,
  createAcquisitionTracker,
  annotateAcquiredCard,
  setLastAcquisitionBatch,
  getLatestAcquisitionBatch,
  // Sealed inventory
  ensureSealedInventory,
  getSealedInventoryEntry,
  getSealedQty,
  addSealedProduct,
  consumeSealedProduct,
  getSealedInventoryValue,
  formatSealedInventorySummary,
  // Modes
  isReal,
  // Seed
  normalizeSeed,
  // Card generation
  genCard,
  genSetCode,
  // Math
  gaussRand,
  clamp,
  // Condition
  generateCondition,
  ensureCondition,
  // Data dir
  getDataDir,
  FLOPPS_DIR,
  FLOPPS_STATE_FILE,
  FLOPPS_WILDCARD_DIR,
  // Companies / Grading state
  loadCompanies,
  loadGradingState,
  saveGradingState,
  loadPopulation,
  savePopulation,
  // Grading
  psaTierForValue,
  conditionToGrade,
  isBlackLabel,
  gradeMultiplier,
  estimateGradeProbability,
  gradeLabel,
  progressStr,
  // Population
  bumpPopulation,
  simNpcPopulationGrowth,
  // Grade rolls
  rollGrade,
  generateQuality,
  getCond,
};
