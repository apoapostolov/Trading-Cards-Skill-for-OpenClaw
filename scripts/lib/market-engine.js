// ─── MARKET ENGINE — Secondary market simulation, pricing, events ──
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');

const {
  getDataDir, PARALLELS, GRADES, PACKS, TIERS, TIER_EMOJI, RNG, ri, mulberry32,
} = require('./constants');
const {
  rJ, wJ, fm$, pR, loadCfg, saveCfg, loadSet, loadCol, saveCol, rebuildPulls,
} = require('./helpers');

// ─── Market Data I/O ───────────────────────────────────────────────
function loadMarket(setKey) {
  return rJ(path.join(getDataDir(), 'sets', setKey, 'market.json')) || null;
}
function getMarketCardList(market) {
  return market.cardList || Object.values(market.cards || {});
}
function saveMarket(setKey, m) {
  const dir = path.join(getDataDir(), 'sets', setKey);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  wJ(path.join(dir, 'market.json'), m);
}

function normalizeMarketEvents(market) {
  if (!market || !Array.isArray(market.events)) return market;
  const normalized = [];
  const sorted = [...market.events].sort((a, b) => (a.tick || 0) - (b.tick || 0));
  for (const event of sorted) {
    const existing = normalized.find(prev => {
      if (prev.type !== event.type) return false;
      const prevEnd = (prev.tick || 0) + (prev.duration || 14);
      const nextEnd = (event.tick || 0) + (event.duration || 14);
      return (event.tick || 0) <= prevEnd && (prev.tick || 0) <= nextEnd;
    });
    if (existing) {
      existing.stackCount = (existing.stackCount || 1) + 1;
      existing.baseDesc = existing.baseDesc || existing.desc || event.desc;
      existing.magnitude = Math.round((existing.magnitude + event.magnitude) * 1000) / 1000;
      existing.duration = Math.max(existing.duration || 0, event.duration || 0, (event.tick || 0) - (existing.tick || 0) + 1);
      existing.desc = formatMarketEventDesc(getMarketEventProfile(existing.type), existing.stackCount);
      continue;
    }
    const stackCount = event.stackCount || 1;
    normalized.push({
      ...event,
      stackCount,
      baseDesc: event.baseDesc || event.desc,
      desc: formatMarketEventDesc(getMarketEventProfile(event.type), stackCount),
    });
  }
  market.events = normalized;
  return market;
}

// ─── Macro State ───────────────────────────────────────────────────
const MACRO_FILE = path.join(getDataDir(), 'market-macro.json');

function loadMacroState() {
  return rJ(MACRO_FILE) || { lastFetch: 0, source: 'FRED SP500', label: 'neutral', signal: 0, weekPct: 0, monthPct: 0, compositePct: 0 };
}
function saveMacroState(state) { wJ(MACRO_FILE, state); }

function fetchMacroState() {
  let raw = '';
  try {
    const fetchScript = `
const https = require('https');
const url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500';
const req = https.get(url, (res) => {
  if (res.statusCode !== 200) { res.resume(); process.exit(1); return; }
  res.setEncoding('utf8');
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => process.stdout.write(data));
});
req.setTimeout(2000, () => req.destroy(new Error('timeout')));
req.on('error', () => process.exit(1));
    `.trim();
raw=execFileSync(process.execPath,['-e',fetchScript],{encoding:'utf8',timeout:3000,maxBuffer:1024*1024,stdio:['ignore','pipe','ignore']});
  } catch { return null; }
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length < 3) return null;
  const points = [];
  for (const line of lines.slice(1)) {
    const [date, value] = line.split(',');
    const num = parseFloat(value);
    if (date && Number.isFinite(num)) points.push({ date, value: num });
  }
  if (points.length < 6) return null;
  const latest = points[points.length - 1];
  const week = points[Math.max(0, points.length - 6)];
  const month = points[Math.max(0, points.length - 21)];
  const weekPct = ((latest.value - week.value) / week.value) * 100;
  const monthPct = ((latest.value - month.value) / month.value) * 100;
  const compositePct = monthPct * 0.7 + weekPct * 0.3;
  const signal = Math.max(-1, Math.min(1, compositePct / 15));
  const label = signal > 0.35 ? 'bullish' : signal < -0.35 ? 'bearish' : 'neutral';
  return { lastFetch: Date.now(), source: 'FRED SP500', updatedAt: new Date().toISOString(), latest, week, month, weekPct, monthPct, compositePct, signal, label };
}

function getMacroState(force = false) {
  const cached = loadMacroState();
  const ageMs = Date.now() - (cached.lastFetch || 0);
  const maxAgeMs = 48 * 60 * 60 * 1000;
  if (!force && cached.lastFetch && ageMs < maxAgeMs) return cached;
  const fresh = fetchMacroState();
  if (fresh) { saveMacroState(fresh); return fresh; }
  // Write fallback state to avoid retrying the failing fetch every call
  cached.lastFetch = Date.now();
  saveMacroState(cached);
  return cached;
}

// ─── Utilities ─────────────────────────────────────────────────────
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function hashStringSeed(str) { let h = 0; for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i); return Math.abs(h | 0); }
function weightedPick(items) { const total = items.reduce((s, i) => s + i.w, 0); let r = RNG() * total; for (const i of items) { r -= i.w; if (r <= 0) return i.t } return items[0].t; }
function getSpeculationWeight(starTier) { if (starTier === 'Legendary') return 1; if (starTier === 'Superstar') return 0.85; if (starTier === 'Star') return 0.65; if (starTier === 'Uncommon') return 0.45; return 0.3; }

// ─── Event Profiles ────────────────────────────────────────────────
const MARKET_EVENT_PROFILES = {
  break_flood: { label: 'Large case break floods the market', duration: [7, 13], magnitude: [0.05, 0.15], demandMult: 0.95, sentimentDelta: 0, icon: '\u{1F4E6}', effect: 'supply surge' },
  retailer_surge: { label: 'Retailer restock wave hits the market', duration: [6, 12], magnitude: [0.04, 0.10], demandMult: 0.97, sentimentDelta: 0.01, icon: '\u{1F3EC}', effect: 'fresh supply' },
  hobby_boom: { label: 'Collector hype sends premium cards flying', duration: [18, 40], magnitude: [0.18, 0.42], demandMult: 1.06, sentimentDelta: 0.20, icon: '\u{1F4C8}', effect: 'bullish demand' },
  correction: { label: 'Market correction as buyers step back', duration: [18, 42], magnitude: [0.14, 0.28], demandMult: 0.92, sentimentDelta: -0.20, icon: '\u{1F4C9}', effect: 'bearish demand' },
  nostalgia_wave: { label: 'Nostalgia wave brings old collectors back', duration: [30, 72], magnitude: [0.50, 1.00], demandMult: 1.10, sentimentDelta: 0.06, icon: '\u{1F550}', effect: 'nostalgic revival' },
  rookie_chase: { label: 'Rookie chase sparks a sudden run', duration: [10, 22], magnitude: [0.10, 0.24], demandMult: 1.04, sentimentDelta: 0.08, icon: '\u2B50', effect: 'rookie chase' },
  injury_report: { label: 'Injury report cools player demand', duration: [4, 10], magnitude: [0.06, 0.14], demandMult: 0.94, sentimentDelta: -0.03, icon: '\u{1F3E5}', effect: 'player uncertainty' },
  hot_streak: { label: 'Hot streak news lifts the room', duration: [5, 14], magnitude: [0.08, 0.18], demandMult: 1.05, sentimentDelta: 0.04, icon: '\u{1F525}', effect: 'hot streak' },
  scandal: { label: 'Off-field scandal rattles buyers', duration: [8, 18], magnitude: [0.10, 0.22], demandMult: 0.91, sentimentDelta: -0.07, icon: '\u26A0\uFE0F', effect: 'reputation shock' },
  award_buzz: { label: 'Award buzz pushes demand higher', duration: [8, 18], magnitude: [0.08, 0.18], demandMult: 1.05, sentimentDelta: 0.05, icon: '\u{1F3C6}', effect: 'award buzz' },
  livestream_hype: { label: 'Livestream breaker hype spikes short-term demand', duration: [4, 12], magnitude: [0.06, 0.14], demandMult: 1.03, sentimentDelta: 0.03, icon: '\u{1F3A5}', effect: 'live break hype' },
  grading_rush: { label: 'Grading backlog tightens supply', duration: [14, 30], magnitude: [0.08, 0.16], demandMult: 1.02, sentimentDelta: 0.02, icon: '\u{1F9FE}', effect: 'grading choke' },
  auction_comp: { label: 'Auction competition pushes comps upward', duration: [10, 24], magnitude: [0.08, 0.18], demandMult: 1.04, sentimentDelta: 0.02, icon: '\u{1F528}', effect: 'auction pressure' },
  stream_dump: { label: 'Stream dump puts fresh copies into circulation', duration: [5, 10], magnitude: [0.06, 0.14], demandMult: 0.96, sentimentDelta: -0.01, icon: '\u{1F4C9}', effect: 'supply dump' },
  championship: { label: 'Championship chatter drives a premium surge', duration: [18, 36], magnitude: [0.14, 0.30], demandMult: 1.06, sentimentDelta: 0.09, icon: '\u{1F947}', effect: 'title buzz' },
  media_spotlight: { label: 'Media spotlight drags new eyes into the market', duration: [12, 24], magnitude: [0.10, 0.20], demandMult: 1.03, sentimentDelta: 0.05, icon: '\u{1F4E3}', effect: 'media attention' },
  supply_chain: { label: 'Supply chain friction slows restocks', duration: [14, 28], magnitude: [0.06, 0.16], demandMult: 1.02, sentimentDelta: -0.02, icon: '\u{1F69A}', effect: 'tight supply' },
  grading_pop: { label: 'Grading pop report surprises collectors', duration: [10, 20], magnitude: [0.06, 0.12], demandMult: 1.01, sentimentDelta: 0.02, icon: '\u{1F50D}', effect: 'pop report' },
  meme_spike: { label: 'Meme spike drags a niche card into the spotlight', duration: [3, 9], magnitude: [0.05, 0.12], demandMult: 1.02, sentimentDelta: 0.01, icon: '\u{1F602}', effect: 'viral meme' },
  drought: { label: 'A quiet market drought reduces trading volume', duration: [12, 26], magnitude: [0.06, 0.14], demandMult: 0.97, sentimentDelta: -0.03, icon: '\u{1F32B}\uFE0F', effect: 'quiet market' },
};

const MARKET_EVENT_TYPES = Object.keys(MARKET_EVENT_PROFILES);

function formatMarketEventDesc(profile, stackCount = 1) {
  const count = Math.max(1, stackCount | 0);
  if (count === 1) return profile.label;
  const copy = { 2: `${profile.label} intensifies`, 3: `${profile.label} compounds`, 4: `${profile.label} overwhelms the market` };
  return copy[count] || `${profile.label} x${count}`;
}
function getMarketEventProfile(type) { return MARKET_EVENT_PROFILES[type] || MARKET_EVENT_PROFILES.break_flood; }
function isBullishMarketEvent(type) { const p = getMarketEventProfile(type); return (p.demandMult || 1) > 1 || (p.sentimentDelta || 0) > 0; }
function isBearishMarketEvent(type) { const p = getMarketEventProfile(type); return (p.demandMult || 1) < 1 || (p.sentimentDelta || 0) < 0; }

function pickMarketEventType(excludeTypes = []) {
  const blocked = new Set(excludeTypes.map((t) => String(t || '')));
  const pool = MARKET_EVENT_TYPES.filter((type) => !blocked.has(type));
  const source = pool.length ? pool : MARKET_EVENT_TYPES;
  const weighted = source.map(type => {
    const profile = MARKET_EVENT_PROFILES[type];
    const weight =
      type === 'break_flood' ? 5 : type === 'retailer_surge' ? 3 : type === 'hobby_boom' ? 2 : type === 'correction' ? 2 :
      type === 'nostalgia_wave' ? 1.5 : type === 'hot_streak' ? 1.6 : type === 'rookie_chase' ? 1.4 : type === 'injury_report' ? 1.2 :
      type === 'livestream_hype' ? 1.3 : type === 'grading_rush' ? 1.1 : type === 'auction_comp' ? 1.1 : type === 'award_buzz' ? 1.0 :
      type === 'media_spotlight' ? 1.0 : type === 'supply_chain' ? 0.9 : type === 'grading_pop' ? 0.9 : type === 'meme_spike' ? 0.8 :
      type === 'stream_dump' ? 0.8 : type === 'championship' ? 1.0 : type === 'scandal' ? 0.9 : type === 'drought' ? 0.8 : 1;
    return { t: type, w: weight * (profile?.weight || 1) };
  });
  return weightedPick(weighted);
}

function buildMarketEvent(type, tick, stackCount = 1) {
  const profile = getMarketEventProfile(type);
  const stack = Math.max(1, stackCount | 0);
  return { type, tick, duration: ri(null, profile.duration[0], profile.duration[1]), magnitude: Math.round((profile.magnitude[0] + RNG() * (profile.magnitude[1] - profile.magnitude[0])) * 1000) / 1000 * stack, label: profile.label, icon: profile.icon, effect: profile.effect, stackCount: stack, baseDesc: profile.label, desc: formatMarketEventDesc(profile, stack) };
}

function applyMarketEvent(market, type, tick) {
  const profile = getMarketEventProfile(type);
  const event = buildMarketEvent(type, tick, 1);
  const applied = addMarketEvent(market, event);
  market.sentiment = Math.max(0.5, Math.min(1.5, (market.sentiment || 1) + (profile.sentimentDelta || 0)));
  return applied;
}

function marketEventDemandMultiplier(type) { return getMarketEventProfile(type).demandMult || 1; }

function addMarketEvent(market, event) {
  market.events = market.events || [];
  const active = market.events.find(e => e.type === event.type && market.tick - e.tick < (e.duration || 14));
  if (active) {
    active.stackCount = (active.stackCount || 1) + 1;
    active.baseDesc = active.baseDesc || active.desc || event.desc;
    active.magnitude = Math.round((active.magnitude + event.magnitude) * 1000) / 1000;
    active.duration = Math.max(active.duration || 0, event.duration || 0);
    active.desc = formatMarketEventDesc(getMarketEventProfile(active.type), active.stackCount);
    active.lastStackTick = event.tick;
    return active;
  }
  const next = { ...event, stackCount: 1, baseDesc: event.desc };
  market.events.push(next);
  market.eventLog = market.eventLog || [];
  market.eventLog.push({ tick: event.tick, type: event.type, desc: event.desc });
  return next;
}

function activeMarketEvents(market) { return (market?.events || []).filter(e => market.tick - e.tick < (e.duration || 14)); }

// ─── Market Tick Simulation ────────────────────────────────────────
const MARKET_TICK_MS = 12 * 60 * 60 * 1000; // 1 tick = 12 real hours
const MAX_MARKET_CATCHUP_TICKS = 365;

function calcPendingTicks(market) {
  const anchor = market?.lastTickAt || market?.lastPackOpened || market?.createdAt || 0;
  if (!anchor) return 0;
  return Math.max(0, Math.floor((Date.now() - anchor) / MARKET_TICK_MS));
}

function runMarketTicks(set, market, col, nTicks) {
  const cards = market.cardList || Object.values(market.cards);
  const pullChance = { Common: 0.6, Uncommon: 0.5, Star: 0.35, Superstar: 0.2, Legendary: 0.1 };
  const tierDemand = { Common: 0.05, Uncommon: 0.15, Star: 0.40, Superstar: 0.70, Legendary: 0.90 };
  const meanPop = { Common: 0.12, Uncommon: 0.25, Star: 0.45, Superstar: 0.6, Legendary: 0.7 };
  const tierVol = { Common: 0.3, Uncommon: 0.5, Star: 0.7, Superstar: 1.0, Legendary: 1.2 };
  const macro = getMacroState();
  for (let t = 0; t < nTicks; t++) {
    market.tick++;
    const tick = market.tick;
    market.sentiment += (RNG() - 0.48) * 0.04;
    market.sentiment = Math.max(0.5, Math.min(1.5, market.sentiment));

    for (let idx = 0; idx < cards.length; idx++) {
      const mc = cards[idx];
      if (RNG() < (pullChance[mc.starTier] || 0.5)) { mc.totalPulled++; mc.supplyInMarket++; }
      if (mc.supplyInMarket > 0 && RNG() < 0.008) mc.supplyInMarket--;
      let demand = tierDemand[mc.starTier] || 0.1;
      const ageMonths = tick / 30;
      demand *= Math.max(0.4, 1 - ageMonths * 0.003);
      demand *= (0.6 + mc.popScore * 0.4);
      demand *= 0.85 + market.sentiment * 0.15;
      if (ageMonths > 12) demand *= Math.min(1.2, 1 + (ageMonths - 12) * 0.01);
      for (const e of market.events) demand *= marketEventDemandMultiplier(e.type);
      demand = Math.min(1, Math.max(0.03, demand));
      mc.demandScore = demand;
      if (RNG() < 0.05) {
        const ev = weightedPick([{ t: 'hot', w: 3 }, { t: 'viral', w: 1 }, { t: 'injury', w: 1 }, { t: 'milestone', w: 0.5 }]);
        if (ev === 'hot') mc.popScore = Math.min(1, mc.popScore + 0.03 + RNG() * 0.06);
        else if (ev === 'viral') mc.popScore = Math.min(1, mc.popScore + 0.1 + RNG() * 0.1);
        else if (ev === 'injury') mc.popScore = Math.max(0.05, mc.popScore - 0.05 - RNG() * 0.05);
        else mc.popScore = Math.min(1, mc.popScore + 0.05);
      }
      mc.popScore += (meanPop[mc.starTier] - mc.popScore) * 0.01;
      const intrinsic = mc.basePrice * (0.8 + mc.demandScore * 0.4);
      const momentum = mc.avgSold7d > 0 ? 1 + (mc.avgSold7d - mc.currentPrice) / mc.currentPrice * 0.08 : 1;
      const macroMove = (macro.signal || 0) * 0.025 * getSpeculationWeight(mc.starTier);
      const fairValue = intrinsic * momentum * (1 + macroMove);
      const vol = 0.008 * (tierVol[mc.starTier] || 1);
      const noise = (RNG() - 0.5) * 2 * vol;
      const target = Math.max(mc.basePrice * 0.3, fairValue + noise);
      mc.trendVelocity = (target - mc.currentPrice) * 0.08;
      mc.currentPrice = Math.max(mc.basePrice * 0.3, mc.currentPrice + mc.trendVelocity);
      mc.floorPrice = Math.min(mc.floorPrice, mc.currentPrice);
      mc.peakPrice = Math.max(mc.peakPrice, mc.currentPrice);
      mc.sales24h = Math.floor(RNG() * 3 * mc.demandScore);
      if (mc.sales24h > 0) {
        const salePrice = mc.currentPrice * (0.95 + RNG() * 0.1);
        mc.salesHistory.push({ tick, price: salePrice, parallel: 'Base' });
        if (mc.salesHistory.length > 20) mc.salesHistory = mc.salesHistory.slice(-20);
        const recent = mc.salesHistory.slice(-7);
        mc.avgSold7d = recent.reduce((s, x) => s + x.price, 0) / recent.length;
      }
      if (tick % 7 === 0) {
        if (!market.history[mc.num]) market.history[mc.num] = [];
        market.history[mc.num].push({ tick, price: mc.currentPrice });
        if (market.history[mc.num].length > 52) market.history[mc.num] = market.history[mc.num].slice(-52);
      }
    }
    if (RNG() < 0.08) applyMarketEvent(market, pickMarketEventType(), tick);
    if (RNG() < 0.03) {
      const firstType = market.events[market.events.length - 1]?.type;
      applyMarketEvent(market, pickMarketEventType(firstType ? [firstType] : []), tick);
    }
    market.events = market.events.filter(e => tick - e.tick < e.duration);
  }
  computeSetAggregates(market);
  market.lastTickAt = Date.now();
  if (col) syncMarketToCollection(market, col);
  saveMarket(market.setKey, market);
  return market;
}

function computeSetAggregates(market) {
  if (!market.setAggregates) market.setAggregates = {};
  const agg = market.setAggregates;
  agg.tick = market.tick;
  agg.sentiment = market.sentiment;
  const allCards = market.cardList || Object.values(market.cards);
  let baseSum = 0, mktSum = 0;
  const tierBuckets = { Legendary: { count: 0, bookValue: 0, marketValue: 0, velSum: 0 }, Superstar: { count: 0, bookValue: 0, marketValue: 0, velSum: 0 }, Star: { count: 0, bookValue: 0, marketValue: 0, velSum: 0 }, Uncommon: { count: 0, bookValue: 0, marketValue: 0, velSum: 0 }, Common: { count: 0, bookValue: 0, marketValue: 0, velSum: 0 } };
  for (const mc of allCards) {
    baseSum += mc.basePrice; mktSum += mc.currentPrice;
    const bucket = tierBuckets[mc.starTier];
    if (bucket) { bucket.count++; bucket.bookValue += mc.basePrice; bucket.marketValue += mc.currentPrice; bucket.velSum += (mc.trendVelocity || 0); }
  }
  agg.totalBaseValue = Math.round(baseSum * 100) / 100;
  agg.totalMarketValue = Math.round(mktSum * 100) / 100;
  agg.totalChangePct = agg.totalBaseValue > 0 ? Math.round((agg.totalMarketValue - agg.totalBaseValue) / agg.totalBaseValue * 10000) / 100 : 0;
  agg.totalCards = allCards.length;
  agg.tiers = {};
  for (const tier of ['Legendary', 'Superstar', 'Star', 'Uncommon', 'Common']) {
    const bucket = tierBuckets[tier];
    const book = bucket.bookValue, mkt = bucket.marketValue;
    const change = book > 0 ? Math.round((mkt - book) / book * 10000) / 100 : 0;
    const avgVel = bucket.count > 0 ? Math.round(bucket.velSum / bucket.count * 10000) / 10000 : 0;
    agg.tiers[tier] = { count: bucket.count, bookValue: Math.round(book * 100) / 100, marketValue: Math.round(mkt * 100) / 100, changePct: change, avgTrendVelocity: avgVel };
  }
  agg.activeEvents = activeMarketEvents(market).map(e => ({ type: e.type, desc: e.desc, magnitude: e.magnitude, remaining: e.duration - (market.tick - e.tick) }));
  if (!agg.priceIndex) agg.priceIndex = [];
  const sampleCards = allCards.slice(0, 50);
  let idxVal = 0;
  for (const mc of sampleCards) idxVal += mc.currentPrice;
  const lastTick = agg.priceIndex.length > 0 ? agg.priceIndex[agg.priceIndex.length - 1].tick : -1;
  if (market.tick !== lastTick) agg.priceIndex.push({ tick: market.tick, value: Math.round(idxVal * 100) / 100 });
  if (agg.priceIndex.length > 365) agg.priceIndex = agg.priceIndex.slice(-365);
}

function resimulateMarketSnapshot(set, market, col, pending) {
  const cards = market.cardList || Object.values(market.cards || {});
  const macro = getMacroState();
  const tick = market.tick + pending;
  market.tick = tick;
  market.sentiment = Math.max(0.5, Math.min(1.5, (market.sentiment || 1) + ((RNG() - 0.5) * 0.25 * Math.min(1, pending / 12))));
  market.events = (market.events || []).filter(e => tick - e.tick < (e.duration || 14));
  const pullChance = { Common: 0.6, Uncommon: 0.5, Star: 0.35, Superstar: 0.2, Legendary: 0.1 };
  const tierDemand = { Common: 0.05, Uncommon: 0.15, Star: 0.40, Superstar: 0.70, Legendary: 0.90 };
  const meanPop = { Common: 0.12, Uncommon: 0.25, Star: 0.45, Superstar: 0.6, Legendary: 0.7 };
  const tierVol = { Common: 0.3, Uncommon: 0.5, Star: 0.7, Superstar: 1.0, Legendary: 1.2 };
  for (const mc of cards) {
    const basePrice = mc.basePrice || 0;
    const starTier = mc.starTier || 'Common';
    const currentPrice = mc.currentPrice || basePrice;
    const popScore = typeof mc.popScore === 'number' ? mc.popScore : 0.2;
    let demand = tierDemand[starTier] || 0.1;
    const ageMonths = tick / 30;
    demand *= Math.max(0.4, 1 - ageMonths * 0.003);
    demand *= (0.6 + popScore * 0.4);
    demand *= 0.85 + market.sentiment * 0.15;
    if (ageMonths > 12) demand *= Math.min(1.2, 1 + (ageMonths - 12) * 0.01);
    for (const e of market.events) demand *= marketEventDemandMultiplier(e.type);
    demand = Math.min(1, Math.max(0.03, demand));
    mc.demandScore = demand;
    mc.popScore += (meanPop[starTier] - popScore) * Math.min(0.2, pending * 0.005);
    mc.popScore = Math.min(1, Math.max(0.05, mc.popScore));
    const intrinsic = basePrice * (0.8 + demand * 0.4);
    const momentum = mc.avgSold7d > 0 ? 1 + (mc.avgSold7d - currentPrice) / Math.max(currentPrice, 0.01) * 0.08 : 1;
    const macroMove = (macro.signal || 0) * 0.025 * getSpeculationWeight(starTier);
    const fairValue = intrinsic * momentum * (1 + macroMove);
    const vol = 0.008 * (tierVol[starTier] || 1);
    const noise = (RNG() - 0.5) * 2 * vol;
    const target = Math.max(basePrice * 0.3, fairValue + noise);
    mc.trendVelocity = target - currentPrice;
    mc.currentPrice = target;
    mc.floorPrice = Math.min(mc.floorPrice || target, mc.currentPrice);
    mc.peakPrice = Math.max(mc.peakPrice || target, mc.currentPrice);
    mc.sales24h = Math.floor(RNG() * 3 * demand);
    if (mc.sales24h > 0) {
      const salePrice = mc.currentPrice * (0.95 + RNG() * 0.1);
      mc.salesHistory.push({ tick, price: salePrice, parallel: 'Base' });
      if (mc.salesHistory.length > 20) mc.salesHistory = mc.salesHistory.slice(-20);
      const recent = mc.salesHistory.slice(-7);
      mc.avgSold7d = recent.reduce((s, x) => s + x.price, 0) / recent.length;
    }
    if (tick % 7 === 0) {
      if (!market.history[mc.num]) market.history[mc.num] = [];
      market.history[mc.num].push({ tick, price: mc.currentPrice });
      if (market.history[mc.num].length > 52) market.history[mc.num] = market.history[mc.num].slice(-52);
    }
  }
  if (RNG() < 0.08) applyMarketEvent(market, pickMarketEventType(), tick);
  if (RNG() < 0.03) {
    const firstType = market.events[market.events.length - 1]?.type;
    applyMarketEvent(market, pickMarketEventType(firstType ? [firstType] : []), tick);
  }
  market.events = market.events.filter(e => tick - e.tick < e.duration);
  market.eventLog = (market.eventLog || []).slice(-100);
  market.eventLog.push({ tick, type: 'resimulate', desc: `Market resimulated after ${pending} elapsed ticks` });
  computeSetAggregates(market);
  if (market.setAggregates?.priceIndex) market.setAggregates.priceIndex = market.setAggregates.priceIndex.slice(-365);
  if (col) syncMarketToCollection(market, col);
}

function catchUpMarketToNow(set, market, col) {
  const pending = calcPendingTicks(market);
  if (pending > MAX_MARKET_CATCHUP_TICKS) resimulateMarketSnapshot(set, market, col, pending);
  else if (pending > 0) runMarketTicks(set, market, col, pending);
  else if (col) syncMarketToCollection(market, col);
  market.lastTickAt = Date.now();
  return pending;
}

function getSimulationDay(market) {
  if (!market) return 0;
  const createdAt = market.createdAt || market.lastPackOpened || 0;
  if (!createdAt) return market.tick || 0;
  return Math.max(0, Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24)));
}

// ─── Collection Sync ───────────────────────────────────────────────
function enforceTierOrdering(col, priceField) {
  const tierMap = Object.fromEntries(PARALLELS.map(p => [p.name, p.tier || 0]));
  const byNum = {};
  for (const c of col.cards) { (byNum[c.cardNum] || (byNum[c.cardNum] = [])).push(c); }
  for (const cards of Object.values(byNum)) {
    cards.sort((a, b) => { const tA = tierMap[a.parallel] || 0; const tB = tierMap[b.parallel] || 0; return tA - tB; });
    let floor = 0;
    for (const c of cards) { const p = c[priceField] || 0; if (p < floor) c[priceField] = Math.round(floor * 100) / 100; floor = Math.max(floor, p); }
  }
}

function syncMarketToCollection(market, col) {
  const cfg = loadCfg();
  const parMap = Object.fromEntries(PARALLELS.map(p => [p.name, p]));
  for (const c of col.cards) {
    const mc = market.cards[c.cardNum];
    if (!mc) continue;
    const par = parMap[c.parallel] || PARALLELS[0];
    const gradeMult = c.grade ? (GRADES.find(g => g.grade === c.grade)?.mult || 1) : 1;
    c.marketPrice = Math.round(mc.currentPrice * par.pm * gradeMult * 100) / 100;
  }
  enforceTierOrdering(col, 'marketPrice');
  enforceTierOrdering(col, 'price');
  col.stats.value = col.cards.reduce((s, c) => s + (c.marketPrice || c.price), 0);
  col.wallet = cfg.wallet;
}

function tickMarketOnChange(set, col, soldCards) {
  const market = initMarket(set);
  catchUpMarketToNow(set, market, col);
  if (soldCards && soldCards.length > 0) {
    for (const sc of soldCards) {
      const mc = market.cards[sc.cardNum];
      if (!mc) continue;
      mc.supplyInMarket++;
      mc.sales24h++;
      const salePrice = sc.price || mc.currentPrice;
      mc.salesHistory.push({ tick: market.tick, price: salePrice, parallel: sc.parallel || 'Base' });
      if (mc.salesHistory.length > 20) mc.salesHistory = mc.salesHistory.slice(-20);
      const recent = mc.salesHistory.slice(-7);
      mc.avgSold7d = recent.reduce((s, x) => s + x.price, 0) / recent.length;
    }
  }
  runMarketTicks(set, market, col, 1);
  saveMarket(market.setKey, market);
  return market;
}

// ─── Init Market ───────────────────────────────────────────────────
function assignChaseScore(card) {
  let s = 0.2;
  if (card.num === '001') s = 0.75;
  if (card.starTier === 'Legendary') s = Math.max(s, 0.7);
  else if (card.starTier === 'Superstar') s = Math.max(s, 0.55);
  else if (card.starTier === 'Star') s = Math.max(s, 0.4);
  const st = card.stats;
  if (st) { const avg = (st.power + st.speed + st.technique + st.endurance + (st.charisma || 0)) / (st.charisma ? 5 : 4); if (avg > 85) s = Math.max(s, 0.6); else if (avg > 75) s = Math.max(s, 0.45); }
  if (RNG() < 0.08) s = 0.4 + RNG() * 0.25;
  return Math.min(1, s);
}

function initMarket(set) {
  getMacroState();
  const key = set.code + '-' + set.year;
  let m = loadMarket(key);
  if (m) {
    if (!m.setAggregates) { computeSetAggregates(m); saveMarket(key, m); }
    normalizeMarketEvents(m);
    if (!m.lastTickAt) { m.lastTickAt = m.lastPackOpened || m.createdAt || Date.now(); saveMarket(key, m); }
    if (!m.cardList) m.cardList = Object.values(m.cards);
    saveMarket(key, m);
    return m;
  }
  const now = Date.now();
  m = { setKey: key, tick: 0, lastPackOpened: now, createdAt: now, lastTickAt: now, sentiment: 1.0, events: [], eventLog: [], history: {}, cardList: [], cards: {} };
  for (const c of set.cards) {
    const mc = { num: c.num, name: c.name, starTier: c.starTier, basePrice: c.basePrice, popScore: assignChaseScore(c), totalPulled: 0, supplyInMarket: 0, currentPrice: c.basePrice, floorPrice: c.basePrice, peakPrice: c.basePrice, demandScore: 0.5, trendVelocity: 0, sales24h: 0, avgSold7d: c.basePrice, salesHistory: [] };
    m.cards[c.num] = mc;
    m.cardList.push(mc);
  }
  saveMarket(key, m);
  return m;
}

// ─── Set Heat / Demand ────────────────────────────────────────────
function isSetHot(setKey) {
  const { loadCfg } = require('./helpers');
  const cfg = loadCfg();
  if (!cfg.activeSet) return false;
  const market = loadMarket(setKey);
  if (!market) return false;
  const hasBullishEvent = market.events?.some(e => isBullishMarketEvent(e.type));
  return market.sentiment > 1.15 || hasBullishEvent;
}
function getDemandFactor(setKey) {
  const market = loadMarket(setKey);
  if (!market) return 1.0;
  const cards = getMarketCardList(market);
  const hotCards = cards.filter(c => c.starTier === 'Superstar' || c.starTier === 'Legendary');
  const avgDemand = hotCards.length > 0 ? hotCards.reduce((s, c) => s + c.demandScore, 0) / hotCards.length : 0;
  const macro = getMacroState();
  const macroTilt = Math.max(-0.03, Math.min(0.03, (macro.signal || 0) * 0.03));
  return 1.0 + avgDemand * 0.5 + macroTilt;
}

module.exports = {
  loadMarket, getMarketCardList, saveMarket, normalizeMarketEvents,
  getMacroState, loadMacroState, saveMacroState, fetchMacroState,
  MARKET_EVENT_TYPES, MARKET_EVENT_PROFILES,
  formatMarketEventDesc, getMarketEventProfile, isBullishMarketEvent, isBearishMarketEvent,
  pickMarketEventType, buildMarketEvent, applyMarketEvent, addMarketEvent,
  marketEventDemandMultiplier, activeMarketEvents,
  calcPendingTicks, runMarketTicks, resimulateMarketSnapshot, catchUpMarketToNow,
  getSimulationDay, computeSetAggregates, syncMarketToCollection,
  enforceTierOrdering, tickMarketOnChange,
  initMarket, assignChaseScore,
  weightedPick, getSpeculationWeight, clamp01, hashStringSeed,
  isSetHot, getDemandFactor,
};
