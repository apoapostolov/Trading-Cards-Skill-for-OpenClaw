// ─── ECONOMY ENGINE — Stores, Scalpers, Auctions, Marketplace ─────
'use strict';
const fs = require('fs'), path = require('path');

const {
  getDataDir, PACKS, PARALLELS, GRADES, TIER_EMOJI, PAR_EMOJI,
  FLOPPS_BULLETINS, RNG, mulberry32,
} = require('./constants');
const {
  rJ, wJ, fm$, pR, ri, loadCfg, saveCfg, loadSet, loadCol, saveCol, rebuildPulls,
  getSealedQty, addSealedProduct, getSealedInventoryValue, formatSealedInventorySummary,
  getLatestAcquisitionBatch, LOG,
} = require('./helpers');
const {
  getMacroState, loadMarket, getMarketCardList, getSimulationDay, getMarketEventProfile,
  isBullishMarketEvent, isBearishMarketEvent, clamp01, initMarket,
  syncMarketToCollection, runMarketTicks, catchUpMarketToNow, saveMarket,
  isSetHot, getDemandFactor,
} = require('./market-engine');

// ─── Store System ──────────────────────────────────────────────────
const STORES_DIR = path.join(getDataDir(), 'stores');
const SCALPERS_DIR = path.join(getDataDir(), 'scalpers');

function loadDefaultStores() { return rJ(path.join(STORES_DIR, 'default-stores.json')) || []; }
function loadStoreState() {
  const s = rJ(path.join(STORES_DIR, 'state.json'));
  if (s) return s;
  const defaults = loadDefaultStores();
  const now = Date.now();
  const state = { lastSimulation: now, stores: {}, relationships: {}, purchaseHistory: [] };
  for (const d of defaults) { state.stores[d.id] = { lastRestock: now, inventory: {}, lastVisited: 0 }; state.relationships[d.id] = { totalSpent: 0, purchaseCount: 0, tier: 0 }; }
  wJ(path.join(STORES_DIR, 'state.json'), state);
  return state;
}
function saveStoreState(s) { wJ(path.join(STORES_DIR, 'state.json'), s); }
function loadDefaultScalpers() { return rJ(path.join(SCALPERS_DIR, 'default-scalpers.json')) || []; }
function loadScalperState() {
  const s = rJ(path.join(SCALPERS_DIR, 'state.json'));
  if (s) { s.scalpers = s.scalpers || {}; s.activityLog = Array.isArray(s.activityLog) ? s.activityLog : []; for (const d of loadDefaultScalpers()) { const scalper = s.scalpers[d.id] || {}; s.scalpers[d.id] = { ...d, ...scalper, cash: Number.isFinite(scalper.cash) ? scalper.cash : d.cash, inventory: Array.isArray(scalper.inventory) ? scalper.inventory : [], listings: Array.isArray(scalper.listings) ? scalper.listings : [], lastAction: Number.isFinite(scalper.lastAction) ? scalper.lastAction : Date.now() }; } return s; }
  const defaults = loadDefaultScalpers();
  const now = Date.now();
  const state = { lastSimulation: now, scalpers: {}, activityLog: [] };
  for (const d of defaults) state.scalpers[d.id] = { ...d, cash: d.cash, inventory: [], listings: [], lastAction: now };
  wJ(path.join(SCALPERS_DIR, 'state.json'), state);
  return state;
}
function saveScalperState(s){wJ(path.join(SCALPERS_DIR,'state.json'),s)}

// ─── Relationship ──────────────────────────────────────────────────
function getRelationshipTier(store, rel) {
  const thresholds = store.relationshipThresholds || [100, 500, 2000, 5000, 15000];
  let tier = 0;
  for (let i = 0; i < thresholds.length; i++) { if (rel.totalSpent >= thresholds[i]) tier = i + 1; }
  return tier;
}
function getRelationshipDiscount(store, rel) {
  const tier = getRelationshipTier(store, rel);
  const discounts = [0, 0.02, 0.05, 0.08, 0.12];
  return discounts[tier] || 0;
}
function getRecentScalperBuyQty(storeId, days = 7) {
  const scalperState = loadScalperState();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let qty = 0;
  for (const e of scalperState.activityLog || []) { if (e.storeId === storeId && e.action === 'buy' && e.timestamp >= cutoff) qty += (e.qty || 1); }
  return qty;
}

// ─── Store Inventory Profile ───────────────────────────────────────
function getStoreInventoryProfile(store, setKey) {
  const market = loadMarket(setKey);
  const hot = isSetHot(setKey);
  const { loadFloppsState, floppsDefaultCorporation, getFloppsReleaseWindow } = require('./flopps-engine');
  const flopps = loadFloppsState();
  const currentDay = market ? getSimulationDay(market) : (flopps.lastSeenDay >= 0 ? flopps.lastSeenDay : 0);
  const release = getFloppsReleaseWindow(flopps, currentDay);
  const corp = flopps.corporation || floppsDefaultCorporation();
  const recentScalperQty = getRecentScalperBuyQty(store.id);
  const scalperPressure = Math.min(1.5, recentScalperQty / 12);
  const sentiment = market?.sentiment || 1;
  const typeBase = store.type === 'bigbox' ? 1.35 : store.type === 'online' ? 0.9 : 1.0;
  const typeProductScale = { hobby: store.type === 'bigbox' ? 0.8 : store.type === 'online' ? 1.05 : 1.1, blaster: store.type === 'bigbox' ? 1.2 : store.type === 'online' ? 0.9 : 1.0, retail: store.type === 'bigbox' ? 1.35 : store.type === 'online' ? 0.65 : 0.95, jumbo: store.type === 'bigbox' ? 1.1 : store.type === 'online' ? 0.85 : 1.0 };
  const hotPenalty = hot ? { hobby: 0.55, blaster: 0.72, retail: 0.82, jumbo: 0.76 } : { hobby: 1, blaster: 1, retail: 1, jumbo: 1 };
  const scalperPenalty = Math.max(0.58, 1 - scalperPressure * 0.18);
  const sentimentBias = Math.max(0.85, Math.min(1.15, 0.9 + sentiment * 0.1));
  const allocationMultiplier = Math.max(0.48, 1 - corp.allocationTightness * 0.22 - (release.phase.id === 'launch' ? 0.14 : 0) - (release.phase.id === 'sellthrough' ? 0.08 : 0));
  const distributorLagRisk = clamp01(0.05 + corp.retailerStress * 0.28 + (release.phase.id === 'launch' ? 0.14 : 0) + (scalperPressure * 0.08));
  const releasePhase = release.phase.id;
  return { hot, recentScalperQty, scalperPressure, typeBase, typeProductScale, hotPenalty, scalperPenalty, sentimentBias, allocationMultiplier, distributorLagRisk, releasePhase, corporation: corp };
}

function calcStoreInventoryQty(store, setKey, type, rng, range) {
  const profile = getStoreInventoryProfile(store, setKey);
  const base = ri(rng, range[0], range[1]);
  const scale = profile.typeBase * (profile.typeProductScale[type] || 1) * (profile.hotPenalty[type] || 1) * profile.scalperPenalty * profile.sentimentBias * profile.allocationMultiplier;
  return Math.max(1, Math.round(base * scale));
}

function ensureStoreInventory(state, store, setKey) {
  const inv = state.stores[store.id].inventory;
  if (!inv[setKey]) {
    const range = store.stockRange || [5, 10];
    const rng = mulberry32(Date.now() + store.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
    inv[setKey] = {};
    for (const [type, pt] of Object.entries(PACKS)) {
      if (store.sellsHobby === false && type === 'hobby') continue;
      if (store.type === 'online' && type === 'retail') continue;
      inv[setKey][type] = calcStoreInventoryQty(store, setKey, type, rng, range);
    }
  }
}

function calcStorePrice(store, packType, setKey, rel) {
  const pt = PACKS[packType];
  if (!pt) return 0;
  const base = pt.price;
  const hot = isSetHot(setKey);
  const profile = getStoreInventoryProfile(store, setKey);
  const markup = hot ? (store.markupHot || 0.2) : (store.markupBase || 0.15);
  const demandFactor = getDemandFactor(setKey);
  const discount = getRelationshipDiscount(store, rel);
  const corpPremium = 1 + (profile.corporation.extractionIndex - 0.5) * 0.18 + (profile.releasePhase === 'launch' ? 0.06 : 0);
  return Math.max(1, Math.round(base * (1 + markup) * demandFactor * corpPremium * (1 - discount) * 100) / 100);
}

function restockIfNeeded(state, store, setKey) {
  const storeState = state.stores[store.id];
  const now = Date.now();
  const daysSinceRestock = (now - storeState.lastRestock) / (1000 * 60 * 60 * 24);
  if (daysSinceRestock >= store.restockDays) {
    const inv = storeState.inventory[setKey];
    if (!inv) return;
    const range = store.stockRange || [5, 10];
    const profile = getStoreInventoryProfile(store, setKey);
    for (const [type] of Object.entries(PACKS)) {
      if (store.sellsHobby === false && type === 'hobby') continue;
      if (store.type === 'online' && type === 'retail') continue;
      let restockQty = calcStoreInventoryQty(store, setKey, type, null, range);
      if (RNG() < profile.distributorLagRisk) restockQty = Math.max(0, Math.round(restockQty * (0.35 + RNG() * 0.4)));
      inv[type] = (inv[type] || 0) + restockQty;
    }
    storeState.lastRestock = now;
  }
}

// ─── Supplies ──────────────────────────────────────────────────────
const SUPPLIES = [
  { id: 'sleeves-pack', name: 'Card Sleeves (100ct)', basePrice: 8, category: 'supplies' },
  { id: 'toploaders', name: 'Top Loaders (25ct)', basePrice: 12, category: 'supplies' },
  { id: 'card-box', name: 'Card Storage Box', basePrice: 5, category: 'supplies' },
  { id: 'magnetic-case', name: 'Magnetic One-Touch (10ct)', basePrice: 25, category: 'supplies' },
  { id: 'grading-holder', name: 'Grading Card Holder', basePrice: 3, category: 'supplies' },
  { id: 'team-bag', name: 'Team Bag (500ct)', basePrice: 20, category: 'supplies' },
];

// ─── Sales ─────────────────────────────────────────────────────────
const SALE_TYPES = [
  { id: 'flash', name: '\u26A1 Flash Sale', desc: 'Limited time flash sale — everything discounted!', discount: 0.15, durationHrs: 2 },
  { id: 'clearance', name: '\u{1F3F7}\uFE0F Clearance Event', desc: 'Store is clearing old inventory — deep discounts!', discount: 0.25, durationHrs: 12 },
  { id: 'b2g1', name: '\u{1F381} Buy 2 Get 1 Free', desc: 'Buy any 2 products, get 1 free (lowest value).', discount: 0, durationHrs: 24, type: 'b2g1' },
  { id: 'loyalty', name: '\u{1F31F} Loyalty Bonus Day', desc: 'Extra loyalty discount for regular customers!', discount: 0.08, durationHrs: 48 },
  { id: 'restock', name: '\u{1F4E6} Fresh Restock Sale', desc: 'New stock just arrived — celebratory pricing!', discount: 0.10, durationHrs: 6 },
];

function loadStoreSales() { return rJ(path.join(STORES_DIR, 'sales.json')) || { active: [], history: [] }; }
function saveStoreSales(s) { wJ(path.join(STORES_DIR, 'sales.json'), s); }

function generateStoreSales(setKey) {
  const sales = loadStoreSales();
  const now = Date.now();
  sales.active = sales.active.filter(s => now - s.startedAt < s.durationHrs * 60 * 60 * 1000);
  if (RNG() < 0.15 && sales.active.length < 2) {
    const template = SALE_TYPES[Math.floor(RNG() * SALE_TYPES.length)];
    const sale = { ...template, setKey, startedAt: now, announced: false };
    sales.active.push(sale);
    const cfg = loadCfg();
    if (cfg.activeSet) {
      const market = loadMarket(cfg.activeSet);
      if (market) { market.eventLog = market.eventLog || []; market.eventLog.push({ tick: market.tick, type: 'store_sale', desc: `${sale.name} at all stores — ${sale.desc}` }); saveMarket(market.setKey, market); }
    }
  }
  saveStoreSales(sales);
  return sales;
}

function getStoreSaleDiscount(storeId) {
  const sales = loadStoreSales();
  const now = Date.now();
  let totalDiscount = 0, activeSale = null;
  const activeSales = [];
  for (const s of sales.active) { if (now - s.startedAt < s.durationHrs * 60 * 60 * 1000) { totalDiscount += s.discount; activeSales.push(s); if (!activeSale) activeSale = s; } }
  return { discount: totalDiscount, sale: activeSale, sales: activeSales };
}

// ─── Full Inventory ────────────────────────────────────────────────
function ensureFullInventory(state, store, setKey) {
  ensureStoreInventory(state, store, setKey);
  const inv = state.stores[store.id].inventory;
  if (!inv[setKey]) inv[setKey] = {};
  const si = inv[setKey];
  if (!si.supplies) {
    const rng = mulberry32(Date.now() + store.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 999);
    si.supplies = {};
    const supplyCount = store.type === 'lcs' ? 6 : store.type === 'bigbox' ? 4 : 3;
    for (let i = 0; i < supplyCount; i++) { const sup = SUPPLIES[Math.floor(RNG() * SUPPLIES.length)]; si.supplies[sup.id] = { ...sup, qty: ri(rng, 2, 8) }; }
  }
  if (!si.singles && (store.type === 'lcs' || store.type === 'online')) {
    const cfg = loadCfg();
    const set = loadSet();
    const market = set ? loadMarket(setKey) : null;
    if (set) {
      const rng = mulberry32(Date.now() + store.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 777);
      si.singles = [];
      const count = ri(rng, 3, 12);
      const cards = [...set.cards].sort(() => RNG() - 0.5).slice(0, count);
      for (const c of cards) { const mc = market?.cards?.[c.num]; const price = mc ? mc.currentPrice * (1 + (store.markupBase || 0.15)) : c.basePrice * 1.3; si.singles.push({ num: c.num, name: c.name, starTier: c.starTier, price: Math.round(price * 100) / 100, qty: ri(rng, 1, 3) }); }
    }
  }
  if (!si.sealed) {
    si.sealed = { hobby_box: { name: 'Hobby Box', price: PACKS.hobby.price * 2, qty: ri(null, 1, 3) }, jumbo_box: { name: 'Jumbo Box', price: PACKS.jumbo.price * 2, qty: ri(null, 1, 3) } };
    if (store.type !== 'bigbox' && store.sellsHobby !== false) si.sealed.hobby_case = { name: 'Hobby Case (12 boxes)', price: PACKS.hobby.price * 2 * 10, qty: ri(null, 0, 1) };
  }
}

// ─── Scalper Simulation ────────────────────────────────────────────
function simulateScalpersEnhanced(setKey) {
  const scalperState = loadScalperState();
  const storeState = loadStoreState();
  const defaults = loadDefaultStores();
  const defaultsScalpers = loadDefaultScalpers();
  const { loadFloppsState, floppsDefaultCorporation } = require('./flopps-engine');
  const flopps = loadFloppsState();
  const corp = flopps.corporation || floppsDefaultCorporation();
  const now = Date.now();
  const msSince = now - scalperState.lastSimulation;
  const daysSince = msSince / (1000 * 60 * 60 * 24);
  if (daysSince < 1) return;
  const storeMap = Object.fromEntries(defaults.map(s => [s.id, s]));
  const scalperMap = Object.fromEntries(defaultsScalpers.map(s => [s.id, s]));
  const hot = isSetHot(setKey);
  const demandFactor = getDemandFactor(setKey);
  const market = loadMarket(setKey);
  const log = scalperState.activityLog || [];
  const marketCards = market ? getMarketCardList(market) : [];
  const hotCards = marketCards.filter(c => c.starTier === 'Superstar' || c.starTier === 'Legendary').sort((a, b) => b.currentPrice - a.currentPrice).slice(0, 5);
  const recentListingsByCard = {};
  for (const e of log) { if (e.action !== 'list' || Date.now() - e.timestamp > 3 * 24 * 60 * 60 * 1000) continue; (recentListingsByCard[e.cardNum] || (recentListingsByCard[e.cardNum] = [])).push(e); }
  let marketDirection = 'neutral';
  if (market) {
    const recentEvents = market.events || [];
    const hasBullish = recentEvents.some(e => isBullishMarketEvent(e.type));
    const hasBearish = recentEvents.some(e => isBearishMarketEvent(e.type));
    if (hasBullish && !hasBearish) marketDirection = 'bullish';
    else if (hasBearish && !hasBullish) marketDirection = 'bearish';
    else if (hasBullish && hasBearish) marketDirection = market.sentiment >= 1 ? 'bullish' : 'bearish';
    else if (market.sentiment > 1.1) marketDirection = 'bullish';
    else if (market.sentiment < 0.9) marketDirection = 'bearish';
  }
  for (const [sid, scalper] of Object.entries(scalperState.scalpers)) {
    const def = scalperMap[sid];
    if (!def) continue;
    const cyclesPerDay = def.activityPattern === 'daily' ? 1 : (def.activityPattern === 'weekly' ? (1 / 7) : 1 / 14);
    const cycles = Math.floor(daysSince * cyclesPerDay);
    if (cycles <= 0) continue;
    const strategy = def.strategy || 'flip_quick';
    for (let c = 0; c < cycles; c++) {
      const preferred = def.targetStorePreference.filter(id => storeMap[id]);
      if (!preferred.length) continue;
      const targetId = preferred[Math.floor(RNG() * preferred.length)];
      const targetStore = storeMap[targetId];
      const recentStorePressure = getRecentScalperBuyQty(targetId, 7);
      const pressureBoost = Math.min(0.5, recentStorePressure / 24);
      let buyChance = def.aggressiveness * (hot ? 1.5 : 0.7) * demandFactor * (1 + pressureBoost);
      buyChance *= 1 + (corp.hypeIndex * 0.18) + (corp.scarcityIndex * 0.14);
      if (marketDirection === 'bearish' && strategy === 'hold') buyChance *= 2.0;
      if (marketDirection === 'bearish' && strategy === 'flip_quick') buyChance *= 0.3;
      if (marketDirection === 'bullish') buyChance *= 1.3;
      if (RNG() > buyChance) continue;
      ensureFullInventory(storeState, targetStore, setKey);
      const inv = storeState.stores[targetId]?.inventory?.[setKey];
      if (!inv) continue;
      const allowedTypes = Object.entries(PACKS).filter(([t]) => !(targetStore.sellsHobby === false && t === 'hobby') && !(targetStore.type === 'online' && t === 'retail'));
      const [type, pt] = allowedTypes[Math.floor(RNG() * allowedTypes.length)];
      const stock = inv[type] || 0;
      let buyQty = 1;
      if (def.aggressiveness > 0.7) buyQty = Math.min(3, Math.floor(RNG() * 4) + 1);
      if (def.aggressiveness > 0.9) buyQty = Math.min(5, buyQty + 2);
      if (def.tier === 'bot') buyQty = Math.min(stock, buyQty + 2);
      if (hot) buyQty = Math.min(stock, buyQty + 1);
      if (marketDirection === 'bullish') buyQty = Math.min(stock, buyQty + 1);
      buyQty = Math.min(buyQty, stock);
      if (buyQty <= 0 || stock <= 0) continue;
      const price = pt.price * (1 + (targetStore.markupBase || 0.1));
      const totalCost = price * buyQty;
      if (scalper.cash < totalCost) continue;
      scalper.cash -= totalCost;
      inv[type] -= buyQty;
      scalper.lastAction = now;
      log.push({ timestamp: now, scalperId: sid, scalperName: def.name, emoji: def.emoji, storeId: targetId, storeName: targetStore.name, action: 'buy', product: pt.name, productType: type, qty: buyQty, cost: totalCost, marketDirection, strategy });
      if (market && RNG() < 0.6 && hotCards.length > 0) {
        const card = hotCards[Math.floor(RNG() * hotCards.length)];
        const otherListings = (recentListingsByCard[card.num] || []).filter(e => e.scalperId !== sid);
        const undercut = otherListings.length > 0 ? 0.95 : 1.0;
        const markup = def.markupRange[0] + RNG() * (def.markupRange[1] - def.markupRange[0]);
        const listPrice = Math.round(card.currentPrice * markup * undercut * 100) / 100;
        log.push({ timestamp: now, scalperId: sid, scalperName: def.name, emoji: def.emoji, action: 'list', cardNum: card.num, cardName: card.name, cardTier: card.starTier, listPrice, markup: markup * undercut, undercut: undercut < 1, undercuttingWho: undercut < 1 ? otherListings[0]?.scalperName : null });
        const existingListings = Array.isArray(scalper.listings) ? scalper.listings : [];
        scalper.listings = existingListings.concat([{ cardNum: card.num, cardName: card.name, listPrice, markup: markup * undercut, listedAt: now, strategy }]);
        const recentForCard = Array.isArray(recentListingsByCard[card.num]) ? recentListingsByCard[card.num] : [];
        recentListingsByCard[card.num] = recentForCard.concat([{ scalperId: sid, action: 'list', timestamp: now }]);
      }
    }
    const oldListings = (scalper.listings || []).filter(l => Date.now() - l.listedAt > 7 * 24 * 60 * 60 * 1000);
    if (oldListings.length > 0 && marketDirection !== 'bullish' && RNG() < 0.4) {
      const stuck = oldListings[Math.floor(RNG() * oldListings.length)];
      const discount = 0.8 + RNG() * 0.1;
      const oldPrice = stuck.listPrice;
      stuck.listPrice = Math.round(stuck.listPrice * discount * 100) / 100;
      log.push({ timestamp: now, scalperId: sid, scalperName: def.name, emoji: def.emoji, action: 'discount', cardNum: stuck.cardNum, cardName: stuck.cardName, oldPrice, newPrice: stuck.listPrice, reason: marketDirection === 'bearish' ? 'market dip' : 'stuck inventory' });
    }
  }
  scalperState.activityLog = log.slice(-300);
  scalperState.lastSimulation = now;
  saveScalperState(scalperState);
  saveStoreState(storeState);
}

function simulateScalpers(setKey) {
  const scalperState = loadScalperState();
  const storeState = loadStoreState();
  const defaults = loadDefaultStores();
  const now = Date.now();
  const msSince = now - scalperState.lastSimulation;
  const daysSince = msSince / (1000 * 60 * 60 * 24);
  if (daysSince < 1) return;
  const storeMap = Object.fromEntries(defaults.map(s => [s.id, s]));
  const hot = isSetHot(setKey);
  const demandFactor = getDemandFactor(setKey);
  const log = scalperState.activityLog || [];
  for (const [sid, scalper] of Object.entries(scalperState.scalpers)) {
    const def = loadDefaultScalpers().find(s => s.id === sid);
    if (!def) continue;
    const cyclesPerDay = def.activityPattern === 'daily' ? 1 : (def.activityPattern === 'weekly' ? (1 / 7) : 1 / 14);
    const cycles = Math.floor(daysSince * cyclesPerDay);
    if (cycles <= 0) continue;
    for (let c = 0; c < cycles; c++) {
      const buyChance = def.aggressiveness * (hot ? 1.5 : 0.7) * demandFactor;
      if (RNG() > buyChance) continue;
      const preferred = def.targetStorePreference.filter(id => storeMap[id]);
      if (!preferred.length) continue;
      const targetId = preferred[Math.floor(RNG() * preferred.length)];
      const targetStore = storeMap[targetId];
      ensureStoreInventory(storeState, targetStore, setKey);
      const inv = storeState.stores[targetId]?.inventory?.[setKey];
      if (!inv) continue;
      const allowedTypes = Object.entries(PACKS).filter(([t]) => !(targetStore.sellsHobby === false && t === 'hobby') && !(targetStore.type === 'online' && t === 'retail'));
      const [type, pt] = allowedTypes[Math.floor(RNG() * allowedTypes.length)];
      const stock = inv[type] || 0;
      let buyQty = 1;
      if (def.aggressiveness > 0.7) buyQty = Math.min(3, Math.floor(RNG() * 4) + 1);
      if (def.aggressiveness > 0.9) buyQty = Math.min(5, buyQty + 2);
      if (def.tier === 'bot') buyQty = Math.min(stock, buyQty + 2);
      buyQty = Math.min(buyQty, stock);
      if (buyQty <= 0 || stock <= 0) continue;
      const price = pt.price * (1 + (targetStore.markupBase || 0.1));
      const totalCost = price * buyQty;
      if (scalper.cash < totalCost) continue;
      scalper.cash -= totalCost;
      inv[type] -= buyQty;
      scalper.lastAction = now;
      log.push({ timestamp: now, scalperId: sid, scalperName: def.name, emoji: def.emoji, storeId: targetId, storeName: targetStore.name, action: 'buy', product: pt.name, productType: type, qty: buyQty, cost: totalCost });
      const set = loadSet();
      if (set && RNG() < 0.6) {
        const hotCards = set.cards.filter(c => c.starTier === 'Superstar' || c.starTier === 'Legendary');
        if (hotCards.length > 0) {
          const card = hotCards[Math.floor(RNG() * hotCards.length)];
          const markup = def.markupRange[0] + RNG() * (def.markupRange[1] - def.markupRange[0]);
          const listPrice = Math.round(card.basePrice * markup * 100) / 100;
          log.push({ timestamp: now, scalperId: sid, scalperName: def.name, emoji: def.emoji, action: 'list', cardNum: card.num, cardName: card.name, cardTier: card.starTier, listPrice, markup });
          const existingListings = Array.isArray(scalper.listings) ? scalper.listings : [];
          scalper.listings = existingListings.concat([{ cardNum: card.num, cardName: card.name, listPrice, markup, listedAt: now }]);
        }
      }
    }
  }
  scalperState.activityLog = log.slice(-200);
  scalperState.lastSimulation = now;
  saveScalperState(scalperState);
  saveStoreState(storeState);
}

// ─── Marketplace / Listings ────────────────────────────────────────
const MARKETPLACE_DIR = path.join(getDataDir(), 'marketplace');
const NPCS_DIR = path.join(getDataDir(), 'npcs');

function loadListings() { return rJ(path.join(MARKETPLACE_DIR, 'listings.json')) || { listings: [], sold: [], nextId: 1, lastChecked: 0 }; }
function saveListings(d) { wJ(path.join(MARKETPLACE_DIR, 'listings.json'), d); }
function loadLots() { return rJ(path.join(MARKETPLACE_DIR, 'lots.json')) || { lots: [], soldLots: [], nextId: 1, lastRefreshed: 0 }; }
function saveLots(d) { wJ(path.join(MARKETPLACE_DIR, 'lots.json'), d); }
function loadAuctions() { return rJ(path.join(MARKETPLACE_DIR, 'auctions.json')) || { auctions: [], completed: [], nextId: 1, lastChecked: 0 }; }
function saveAuctions(d) { wJ(path.join(MARKETPLACE_DIR, 'auctions.json'), d); }
function loadTraders() { return rJ(path.join(NPCS_DIR, 'traders.json')) || []; }
function loadTradeHistory() { return rJ(path.join(NPCS_DIR, 'trade-history.json')) || []; }
function saveTradeHistory(d) { wJ(path.join(NPCS_DIR, 'trade-history.json'), d); }

// ─── Listings Tick ─────────────────────────────────────────────────
function tickListings(col, set, market) {
  const listings = loadListings();
  const now = Date.now();
  const hrsSinceCheck = (now - (listings.lastChecked || 0)) / (1000 * 60 * 60);
  if (hrsSinceCheck < 1 || !listings.listings.length) { listings.lastChecked = now; saveListings(listings); return; }
  const toRemove = [];
  for (const listing of listings.listings) {
    const mc = market.cards[listing.cardNum];
    if (!mc) continue;
    const marketPrice = mc.currentPrice;
    const priceRatio = listing.price / marketPrice;
    let sellChance = 0;
    if (priceRatio <= 0.8) sellChance = 0.15;
    else if (priceRatio <= 1.0) sellChance = 0.08;
    else if (priceRatio <= 1.2) sellChance = 0.04;
    else sellChance = 0.01;
    if (RNG() < sellChance) {
      const fee = listing.price * 0.10;
      const net = listing.price - fee;
      const cfg = loadCfg();
      cfg.wallet += net; saveCfg(cfg); col.wallet = cfg.wallet;
      const cardIdx = col.cards.findIndex(c => c.id === listing.cardId);
      if (cardIdx >= 0) {
        const card = col.cards[cardIdx];
        col.cards.splice(cardIdx, 1);
        col.stats.total--;
        col.stats.value -= (card.marketPrice || card.price);
        const pc = (col.pulls[listing.cardNum] || 0);
        if (pc <= 1) delete col.pulls[listing.cardNum]; else col.pulls[listing.cardNum] = pc - 1;
      }
      listing.soldAt = now; listing.soldPrice = listing.price; listing.fee = fee; listing.net = net;
      listings.sold.push(listing);
      toRemove.push(listing);
      mc.supplyInMarket++;
      mc.salesHistory.push({ tick: market.tick, price: listing.price, parallel: 'Base' });
    }
  }
  if (toRemove.length > 0) { listings.listings = listings.listings.filter(l => !toRemove.includes(l)); rebuildPulls(col); }
  listings.lastChecked = now; saveListings(listings);
}

// ─── NPC Bidders ───────────────────────────────────────────────────
const NPC_BIDDERS = [
  { name: 'CardKing_Mike', style: 'shill', aggression: 0.8, maxMult: 2.5, snipeChance: 0.4 },
  { name: 'VintageVault', style: 'genuine', aggression: 0.5, maxMult: 1.5, snipeChance: 0.1 },
  { name: 'SlabHunter99', style: 'genuine', aggression: 0.6, maxMult: 1.8, snipeChance: 0.2 },
  { name: 'MysteryBidder', style: 'shill', aggression: 0.9, maxMult: 3.0, snipeChance: 0.5 },
  { name: 'RookieCollector', style: 'genuine', aggression: 0.3, maxMult: 1.2, snipeChance: 0.05 },
  { name: 'WhaleAlert', style: 'genuine', aggression: 0.7, maxMult: 2.2, snipeChance: 0.15 },
  { name: 'TheGrader', style: 'shill', aggression: 0.6, maxMult: 2.0, snipeChance: 0.3 },
];

// ─── Auction Tick (Enhanced) ───────────────────────────────────────
function tickAuctionsEnhanced(col, set, market) {
  const auctions = loadAuctions();
  const now = Date.now();
  const toResolve = [];
  for (const auction of auctions.auctions) {
    if (auction.status && auction.status !== 'active') continue;
    const elapsedHrs = (now - auction.startedAt) / (1000 * 60 * 60);
    const durationHrs = (auction.durationDays || 3) * 24;
    const timeLeftPct = Math.max(0, 1 - elapsedHrs / durationHrs);
    const isLastHour = timeLeftPct < 0.05;
    if (elapsedHrs >= durationHrs) { toResolve.push(auction); continue; }
    const mc = market.cards[auction.cardNum];
    if (!mc) continue;
    const baseVal = mc.currentPrice;
    const highestBid = auction.bids.length > 0 ? Math.max(...auction.bids.map(b => b.amount)) : auction.startingBid;
    const bidderSet = new Set(auction.bids.map(b => b.bidder));
    for (const npc of NPC_BIDDERS) {
      if (bidderSet.has(npc.name)) continue;
      const npcMax = baseVal * npc.maxMult * (auction.isRare ? 1.3 : 1);
      if (highestBid >= npcMax) continue;
      let bidChance = npc.aggression * 0.12;
      if (isLastHour && RNG() < npc.snipeChance) bidChance = 0.8;
      if (bidChance < RNG()) continue;
      const increment = baseVal * 0.05 * (1 + RNG());
      const newBid = Math.round(Math.min(npcMax, highestBid + increment) * 100) / 100;
      auction.bids.push({ bidder: npc.name, amount: newBid, time: Date.now(), style: npc.style });
      auction.highestBid = Math.max(auction.highestBid || 0, newBid);
      auction.hot = auction.hot || npc.style === 'shill';
      bidderSet.add(npc.name);
      break;
    }
    if (isLastHour && auction.hot && RNG() < 0.3) {
      const shill = NPC_BIDDERS.filter(n => n.style === 'shill' && !bidderSet.has(n.name));
      if (shill.length) {
        const s = shill[0];
        const snipe = baseVal * 2.2 * (1 + RNG() * 0.3);
        if (snipe > auction.highestBid) { const amt = Math.round(snipe * 100) / 100; auction.bids.push({ bidder: s.name, amount: amt, time: Date.now(), style: 'shill' }); auction.highestBid = amt; bidderSet.add(s.name); }
      }
    }
    if (auction.buyItNow && highestBid >= auction.buyItNow) { toResolve.push(auction); auction.buyNowTriggered = true; }
  }
  for (const auction of toResolve) {
    if (auction.bids.length === 0) { auction.status = 'expired'; auction.resolvedAt = Date.now(); auctions.completed.push(auction); }
    else {
      const winningBid = auction.bids[auction.bids.length - 1];
      const reserveMet = !auction.reserve || winningBid.amount >= auction.reserve;
      const fee = winningBid.amount * 0.05;
      if (!reserveMet && auction.seller === 'player') { auction.status = 'reserve-not-met'; auction.resolvedAt = Date.now(); auctions.completed.push(auction); }
      else {
        auction.status = 'sold'; auction.winningBid = winningBid; auction.net = winningBid.amount - fee; auction.fee = fee; auction.resolvedAt = Date.now();
        auctions.completed.push(auction);
        if (auction.seller === 'player') {
          const cardIdx = col.cards.findIndex(c => c.id === auction.cardId);
          if (cardIdx >= 0) { const card = col.cards[cardIdx]; col.cards.splice(cardIdx, 1); col.stats.total--; col.stats.value -= (card.marketPrice || card.price); const pc = (col.pulls[auction.cardNum] || 0); if (pc <= 1) delete col.pulls[auction.cardNum]; else col.pulls[auction.cardNum] = pc - 1; }
          const cfg = loadCfg(); cfg.wallet += auction.net; saveCfg(cfg); col.wallet = cfg.wallet;
        } else if (winningBid.bidder === 'player') {
          const cfg = loadCfg();
          if (cfg.wallet >= winningBid.amount) {
            cfg.wallet -= winningBid.amount; saveCfg(cfg); col.wallet = cfg.wallet;
            const baseCard = set.cards.find(c => c.num === auction.cardNum);
            if (baseCard) {
              const { CAT } = require('./constants');
              const par = PARALLELS[0]; const grade = rollGrade(); const quality = generateQuality(grade);
              const price = winningBid.amount; const id = `${set.code}-${auction.cardNum}-Base-0-G${grade.grade}`;
              const newCard = { id, cardNum: auction.cardNum, name: baseCard.name, subset: baseCard.subset, starTier: baseCard.starTier, stats: baseCard.stats || {}, parallel: 'Base', sn: null, serStr: '', plate: null, special: 'None', specialDesc: '', quality, grade: grade.grade, gradeName: grade.name, price, isHit: false, marketPrice: price, popScore: 0, demandScore: 0, cardFormat: 'standard', cardTypeId: null, cardTypeName: null, source: 'auction', auctionId: auction.id, auctionPrice: winningBid.amount };
              col.cards.push(newCard); col.pulls[auction.cardNum] = (col.pulls[auction.cardNum] || 0) + 1;
              col.stats.total++; col.stats.value += price;
              if (!col.bestPull || price > col.bestPull.price) col.bestPull = newCard;
            }
          }
        }
        const mcResolve = market.cards[auction.cardNum];
        if (mcResolve) { mcResolve.salesHistory.push({ tick: market.tick, price: winningBid.amount, parallel: auction.parallel || 'Base' }); mcResolve.sales24h++; }
      }
    }
    auctions.auctions = auctions.auctions.filter(a => a.id !== auction.id);
  }
  if (toResolve.length) rebuildPulls(col);
  auctions.lastChecked = now; saveAuctions(auctions);
  return toResolve;
}

function tickAuctions(col, set, market) {
  const auctions = loadAuctions();
  const now = Date.now();
  const toResolve = [];
  for (const auction of auctions.auctions) {
    const elapsedHrs = (now - auction.startedAt) / (1000 * 60 * 60);
    const durationHrs = (auction.durationDays || 3) * 24;
    if (elapsedHrs >= durationHrs) { toResolve.push(auction); continue; }
    if (auction.bids.length > 0 && auction.bids[auction.bids.length - 1].bidder === 'player') continue;
    const mc = market.cards[auction.cardNum];
    if (!mc) continue;
    const marketVal = mc.currentPrice * 2;
    const highestBid = auction.bids.length > 0 ? Math.max(...auction.bids.map(b => b.amount)) : auction.minBid;
    const npcMaxBid = marketVal * 0.8;
    if (highestBid < npcMaxBid && RNG() < 0.15) {
      const npcBid = Math.min(npcMaxBid, highestBid + marketVal * 0.05 * (1 + RNG()));
      const rounded = Math.round(npcBid * 100) / 100;
      const npcs = loadTraders();
      const npc = npcs[Math.floor(RNG() * npcs.length)];
      auction.bids.push({ bidder: npc.name, amount: rounded, time: Date.now() });
      auction.highestBid = rounded;
    }
  }
  for (const auction of toResolve) {
    if (auction.bids.length === 0) { auction.status = 'expired'; auctions.completed.push(auction); }
    else {
      const winningBid = auction.bids[auction.bids.length - 1];
      const fee = auction.seller === 'player' ? winningBid.amount * 0.05 : 0;
      const net = winningBid.amount - fee;
      auction.status = 'sold'; auction.winningBid = winningBid; auction.net = net;
      if (auction.seller === 'player') {
        const cardIdx = col.cards.findIndex(c => c.id === auction.cardId);
        if (cardIdx >= 0) { col.cards.splice(cardIdx, 1); col.stats.total--; col.stats.value -= (col.cards[cardIdx]?.marketPrice || 0); const pc = (col.pulls[auction.cardNum] || 0); if (pc <= 1) delete col.pulls[auction.cardNum]; else col.pulls[auction.cardNum] = pc - 1; }
        const cfg = loadCfg(); cfg.wallet += net; saveCfg(cfg); col.wallet = cfg.wallet;
      }
      auctions.completed.push(auction);
    }
    auctions.auctions = auctions.auctions.filter(a => a.id !== auction.id);
  }
  if (toResolve.length) rebuildPulls(col);
  auctions.lastChecked = now; saveAuctions(auctions);
  return toResolve;
}

function ensureNpcAuctions(set, market) {
  const auctions = loadAuctions();
  const npcAuctions = auctions.auctions.filter(a => a.seller !== 'player');
  if (npcAuctions.length >= 3) return;
  const needed = 3 - npcAuctions.length;
  for (let i = 0; i < needed; i++) {
    const card = set.cards[Math.floor(RNG() * set.cards.length)];
    const mc = market.cards[card.num];
    if (!mc) continue;
    const isRare = card.starTier === 'Legendary' || card.starTier === 'Superstar';
    const startBid = Math.round(mc.currentPrice * (isRare ? 0.8 : 0.5) * 100) / 100;
    const reserve = isRare ? Math.round(startBid * 1.2 * 100) / 100 : null;
    const buyNow = isRare ? Math.round(mc.currentPrice * 2.5 * 100) / 100 : null;
    const npc = NPC_BIDDERS[Math.floor(RNG() * NPC_BIDDERS.length)];
    const id = String(auctions.nextId++);
    auctions.auctions.push({ id, cardId: `npc-${id}`, cardNum: card.num, name: card.name, parallel: 'Base', starTier: card.starTier, startingBid: startBid, reserve, buyItNow: buyNow, marketPrice: mc.currentPrice, durationDays: [1, 3, 7][Math.floor(RNG() * 3)], seller: npc.name, startedAt: Date.now() - RNG() * 48 * 60 * 60 * 1000, bids: [{ bidder: 'CardKing_Mike', amount: startBid, time: Date.now() - RNG() * 24 * 60 * 60 * 1000, style: 'genuine' }], highestBid: startBid, isRare, hot: false, status: 'active' });
  }
  saveAuctions(auctions);
}

// ─── Provenance / Origin ───────────────────────────────────────────
const ORIGIN_PRESETS = [
  { type: 'retail-blaster', label: 'Pulled from retail blaster', mult: 1.0, emoji: '\u{1F3EA}' },
  { type: 'hobby-box', label: 'Pulled from hobby box', mult: 1.05, emoji: '\u{1F4E6}' },
  { type: 'hobby-pack', label: 'Pulled from hobby pack', mult: 1.0, emoji: '\u{1F0CF}' },
  { type: 'jumbo-box', label: 'Pulled from jumbo box', mult: 1.02, emoji: '\u{1F381}' },
  { type: 'store-bought', label: 'Store bought (LCS)', mult: 1.05, emoji: '\u{1F3EA}' },
  { type: 'auction-won', label: 'Won at auction', mult: 1.0, emoji: '\u{1F3F7}\uFE0F' },
  { type: 'trade', label: 'Acquired via trade', mult: 0.98, emoji: '\u{1F91D}' },
  { type: 'lot-pull', label: 'Pulled from collection lot', mult: 0.97, emoji: '\u{1F381}' },
  { type: 'first-pack', label: 'First pack of set (collector premium!)', mult: 1.15, emoji: '\u2B50' },
  { type: 'viral-break', label: 'Pulled during viral break', mult: 1.20, emoji: '\u{1F525}' },
  { type: 'marketplace', label: 'Purchased from marketplace', mult: 1.0, emoji: '\u{1F6D2}' },
];

function assignOrigin(card, source) {
  const preset = ORIGIN_PRESETS.find(p => p.type === source) || ORIGIN_PRESETS[0];
  if (RNG() < 0.02) return ORIGIN_PRESETS.find(p => p.type === 'viral-break');
  if (RNG() < 0.01) return ORIGIN_PRESETS.find(p => p.type === 'first-pack');
  return preset;
}

module.exports = {
  STORES_DIR, SCALPERS_DIR, SUPPLIES, SALE_TYPES, ORIGIN_PRESETS, NPC_BIDDERS,
  loadDefaultStores, loadStoreState, saveStoreState,
  loadDefaultScalpers, loadScalperState, saveScalperState,
  isSetHot, getDemandFactor,
  getRelationshipTier, getRelationshipDiscount, getRecentScalperBuyQty,
  getStoreInventoryProfile, calcStoreInventoryQty, ensureStoreInventory,
  calcStorePrice, restockIfNeeded,
  loadStoreSales, saveStoreSales, generateStoreSales, getStoreSaleDiscount,
  ensureFullInventory,
  simulateScalpersEnhanced, simulateScalpers,
  loadListings, saveListings, loadLots, saveLots,
  loadAuctions, saveAuctions, loadTraders, loadTradeHistory, saveTradeHistory,
  tickListings, tickAuctionsEnhanced, tickAuctions, ensureNpcAuctions,
  MARKETPLACE_DIR, NPCS_DIR, assignOrigin,
};
