// ─── FLOPPS ENGINE — Corporate simulation, stock, bulletins ────────
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');

const {
  getDataDir, FLOPPS_BULLETINS, FLOPPS_EXECUTIVES, FLOPPS_PRODUCT_LINES,
  FLOPPS_PARTNERS, FLOPPS_PHASES, FLOPPS_TREND_CANDIDATES, RNG, ri, mulberry32,
} = require('./constants');
const {
  rJ, wJ, fm$, loadCfg, loadSet, FLOPPS_DIR, FLOPPS_STATE_FILE, FLOPPS_WILDCARD_DIR,
} = require('./helpers');
const { getMacroState, isBullishMarketEvent, isBearishMarketEvent, getSimulationDay, clamp01, hashStringSeed, isSetHot, getDemandFactor } = require('./market-engine');
// Note: isSetHot and getDemandFactor now come from market-engine (no circular dep).
// loadStoreState, loadScalperState, loadDefaultStores are lazy-required below.

// ─── Corporation State ─────────────────────────────────────────────
function floppsDefaultCorporation() {
  return {
    scarcityIndex: 0.58, hypeIndex: 0.54, extractionIndex: 0.61, collectorStress: 0.57,
    retailerStress: 0.46, laborStress: 0.41, lobbyingHeat: 0.28, trustMask: 0.44,
    allocationTightness: 0.52, releasePace: 0.74, partnerHeat: 0.38,
    guidance: 'disciplined growth through elevated collector engagement',
    activePhase: 'planning', executiveFocus: 'portfolio',
  };
}

function ensureFloppsStateShape(state) {
  const next = state || {};
  if (!next.stock) next.stock = { price: 100, history: [] };
  if (!Array.isArray(next.stock.history)) next.stock.history = [];
  if (!Array.isArray(next.newsHistory)) next.newsHistory = [];
  if (typeof next.lastNewsDay !== 'number') next.lastNewsDay = -1;
  if (typeof next.lastStockDay !== 'number') next.lastStockDay = -1;
  if (typeof next.lastSeenDay !== 'number') next.lastSeenDay = -1;
  if (!next.corporation) next.corporation = floppsDefaultCorporation();
  next.corporation = { ...floppsDefaultCorporation(), ...next.corporation };
  if (!Array.isArray(next.calendar)) next.calendar = [];
  if (!Array.isArray(next.dayHistory)) next.dayHistory = [];
  if (!next.trendDesk) next.trendDesk = { lastRefreshDay: -1, lastCommitteeCycle: -1, watchlist: [], chosenHistory: [] };
  if (!Array.isArray(next.trendDesk.watchlist)) next.trendDesk.watchlist = [];
  if (!Array.isArray(next.trendDesk.chosenHistory)) next.trendDesk.chosenHistory = [];
  if (!Array.isArray(next.announcementHistory)) next.announcementHistory = [];
  return next;
}

function loadFloppsState() { return ensureFloppsStateShape(rJ(FLOPPS_STATE_FILE())); }
function saveFloppsState(state) { wJ(FLOPPS_STATE_FILE(), ensureFloppsStateShape(state)); }

function slugifyFloppsText(value) {
  return String(value || 'wildcard').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'wildcard';
}

function getFloppsPriceForDay(state, day) {
  const history = state?.stock?.history || [];
  if (!history.length) return state?.stock?.price || 100;
  const exact = history.find((p) => p.day === day);
  if (exact) return exact.price;
  const prior = [...history].filter((p) => p.day <= day).sort((a, b) => b.day - a.day)[0];
  if (prior) return prior.price;
  return history[0].price;
}

function getSimulationDate(day) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + day); return d; }

// ─── Release Calendar ──────────────────────────────────────────────
function buildFloppsReleaseCalendar(set, startDay = 0) {
  const baseCode = set?.code || 'FLP';
  const baseName = set?.name || 'Flagship';
  const entries = [];
  for (let i = 0; i < 9; i++) {
    const launchDay = startDay + (i * 45);
    const line = FLOPPS_PRODUCT_LINES[i % FLOPPS_PRODUCT_LINES.length];
    const partner = FLOPPS_PARTNERS[i % FLOPPS_PARTNERS.length];
    const seasonTag = `${new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}`;
    entries.push({
      code: `${baseCode}-${seasonTag}`, title: i === 0 ? `${baseName} ${line}` : `${line} ${seasonTag}`,
      day: launchDay, partner, category: i % 3 === 0 ? 'sports' : i % 3 === 1 ? 'entertainment' : 'premium',
      channel: i % 4 === 0 ? 'hobby' : i % 4 === 1 ? 'retail' : i % 4 === 2 ? 'dutch-auction' : 'instant-drop', cadenceDays: 45,
    });
  }
  return entries;
}

function ensureFloppsReleaseCalendar(state, set, currentDay) {
  if (!state.calendar.length) state.calendar = buildFloppsReleaseCalendar(set, Math.max(0, currentDay - (currentDay % 45)));
  const lastDay = state.calendar[state.calendar.length - 1]?.day ?? 0;
  if (lastDay < currentDay + 240) { const ext = buildFloppsReleaseCalendar(set, lastDay + 45).slice(0, 4); state.calendar = state.calendar.concat(ext); }
  if (state.calendar.length > 16) state.calendar = state.calendar.slice(-16);
}

function getFloppsReleaseWindow(state, day) {
  const cal = Array.isArray(state?.calendar) ? state.calendar : [];
  if (!cal.length) return { phase: FLOPPS_PHASES[0], current: null, next: null, offset: 0 };
  let current = cal[0], next = cal[cal.length - 1];
  for (let i = 0; i < cal.length; i++) { if (cal[i].day <= day) current = cal[i]; if (cal[i].day > day) { next = cal[i]; break; } }
  const offset = day - (current?.day || 0);
  let phase = FLOPPS_PHASES[0];
  if (offset < 0) phase = FLOPPS_PHASES[1];
  else if (offset <= 5) phase = FLOPPS_PHASES[3];
  else if (offset <= 18) phase = FLOPPS_PHASES[4];
  else if (offset <= 32) phase = FLOPPS_PHASES[5];
  else phase = FLOPPS_PHASES[2];
  return { phase, current, next, offset };
}

// ─── Trend Desk ────────────────────────────────────────────────────
function scoreFloppsTrendCandidate(candidate, day, corp) {
  const simDate = getSimulationDate(day);
  const month = simDate.getMonth();
  const nearestWindow = Math.min(...candidate.windowMonths.map((m) => { const d = Math.abs(month - m); return Math.min(d, 12 - d); }));
  const proximityBonus = Math.max(0, 0.24 - (nearestWindow * 0.05));
  const seeded = mulberry32(hashStringSeed(`${candidate.name}:${day}:${corp.activePhase}`));
  const trendProxy = 0.35 + (seeded() * 0.45);
  const formatBonus = candidate.formatBias === 'premium' ? corp.extractionIndex * 0.12 : candidate.formatBias === 'chrome' ? corp.hypeIndex * 0.1 : candidate.formatBias === 'heritage' ? (1 - corp.releasePace) * 0.08 : 0.05;
  const marketability = clamp01(candidate.base * 0.45 + trendProxy * 0.3 + proximityBonus + formatBonus + corp.partnerHeat * 0.08);
  return { ...candidate, trendProxy: Math.round(trendProxy * 1000) / 1000, proximityBonus: Math.round(proximityBonus * 1000) / 1000, marketability: Math.round(marketability * 1000) / 1000 };
}

function ensureFloppsTrendDesk(state, day) {
  const corp = state.corporation || floppsDefaultCorporation();
  if (!state.trendDesk.watchlist.length || day - state.trendDesk.lastRefreshDay >= 14) {
    state.trendDesk.watchlist = FLOPPS_TREND_CANDIDATES.map((c) => scoreFloppsTrendCandidate(c, day, corp)).sort((a, b) => b.marketability - a.marketability);
    state.trendDesk.lastRefreshDay = day;
  }
  const committeeCycle = Math.floor(day / 45);
  if (state.trendDesk.lastCommitteeCycle !== committeeCycle) {
    const chosen = state.trendDesk.watchlist[0];
    if (chosen) {
      state.trendDesk.chosenHistory.push({ day, cycle: committeeCycle, name: chosen.name, partner: chosen.partner, category: chosen.category, marketability: chosen.marketability });
      const target = state.calendar.find((entry) => entry.day >= day + 30 && entry.selectionCycle == null);
      if (target) { target.selectionCycle = committeeCycle; target.licenseName = chosen.name; target.partner = chosen.partner; target.marketability = chosen.marketability; target.title = `${chosen.name} ${target.channel === 'instant-drop' ? 'Instant' : 'Collectors'} Set`; }
    }
    state.trendDesk.lastCommitteeCycle = committeeCycle;
  }
  if (state.trendDesk.chosenHistory.length > 24) state.trendDesk.chosenHistory = state.trendDesk.chosenHistory.slice(-24);
}

// ─── Ecosystem Snapshot ────────────────────────────────────────────
// NOTE: isSetHot, getDemandFactor, loadStoreState, loadScalperState will be imported later
function getFloppsEcosystemSnapshot(setKey) {
  // These are lazy-required to avoid circular imports with economy-engine
  const { loadStoreState, loadDefaultStores } = require('./economy-engine');
  const { loadScalperState } = require('./economy-engine');
  const storeState = loadStoreState();
  const scalperState = loadScalperState();
  const defaults = loadDefaultStores();
  const { PACKS } = require('./constants');
  const inventories = defaults.map((store) => {
    const inv = storeState.stores?.[store.id]?.inventory?.[setKey] || {};
    let total = 0;
    for (const type of Object.keys(PACKS)) total += (inv[type] || 0);
    return { store, total };
  });
  const stockTotal = inventories.reduce((sum, entry) => sum + entry.total, 0);
  const avgStock = inventories.length ? stockTotal / inventories.length : 0;
  const recentScalperBuys = (scalperState.activityLog || []).filter((e) => e.action === 'buy' && Date.now() - e.timestamp < 7 * 24 * 60 * 60 * 1000);
  const recentScalperListings = (scalperState.activityLog || []).filter((e) => e.action === 'list' && Date.now() - e.timestamp < 7 * 24 * 60 * 60 * 1000);
  return { avgStock, stockTotal, scalperBuys: recentScalperBuys.reduce((sum, e) => sum + (e.qty || 0), 0), scalperListings: recentScalperListings.length, storeCount: inventories.length };
}

// ─── Executive Picking ─────────────────────────────────────────────
function pickFloppsExecutive(corp, release) {
  const dominant = [['allocationTightness', 'allocation'], ['retailerStress', 'allocation'], ['laborStress', 'labor'], ['lobbyingHeat', 'lobbying'], ['hypeIndex', 'hype'], ['extractionIndex', 'margin'], ['releasePace', 'cadence']].sort((a, b) => (corp[b[0]] || 0) - (corp[a[0]] || 0))[0]?.[1] || 'portfolio';
  const phaseDomain = release?.phase?.id === 'launch' ? 'hype' : release?.phase?.id === 'licensing' ? 'portfolio' : dominant;
  return FLOPPS_EXECUTIVES.find((exec) => exec.domain === phaseDomain) || FLOPPS_EXECUTIVES[0];
}

// ─── Corporation State Advance ─────────────────────────────────────
function advanceFloppsCorporationState(state, set, market, day) {
  ensureFloppsReleaseCalendar(state, set, day);
  ensureFloppsTrendDesk(state, day);
  const corp = state.corporation || floppsDefaultCorporation();
  const eco = getFloppsEcosystemSnapshot(market?.setKey || `${set?.code}-${set?.year}`);
  const release = getFloppsReleaseWindow(state, day);
  const hot = isSetHot(market?.setKey || `${set?.code}-${set?.year}`);
  const demand = getDemandFactor(market?.setKey || `${set?.code}-${set?.year}`);
  const sentiment = market?.sentiment || 1;
  corp.hypeIndex = clamp01(0.28 + Math.max(0, demand - 1) * 0.38 + (hot ? 0.12 : 0) + (release.phase.id === 'launch' ? 0.12 : 0));
  corp.scarcityIndex = clamp01(0.28 + (eco.avgStock < 8 ? 0.18 : eco.avgStock < 14 ? 0.1 : 0) + Math.min(0.22, eco.scalperBuys / 160) + (release.phase.id === 'sellthrough' ? 0.08 : 0));
  corp.extractionIndex = clamp01(0.32 + corp.scarcityIndex * 0.24 + corp.hypeIndex * 0.18 + (release.phase.id === 'launch' ? 0.06 : 0));
  corp.collectorStress = clamp01(0.22 + corp.hypeIndex * 0.25 + corp.scarcityIndex * 0.2 + corp.releasePace * 0.14);
  corp.retailerStress = clamp01(0.18 + (eco.avgStock < 8 ? 0.22 : eco.avgStock < 14 ? 0.12 : 0) + corp.allocationTightness * 0.22 + Math.min(0.18, eco.scalperBuys / 220));
  corp.laborStress = clamp01(0.2 + corp.releasePace * 0.18 + corp.extractionIndex * 0.14 + (release.phase.id === 'launch' ? 0.1 : 0));
  corp.lobbyingHeat = clamp01(0.18 + Math.max(0, sentiment - 1) * 0.15 + (corp.extractionIndex * 0.12));
  corp.trustMask = clamp01(0.52 - corp.extractionIndex * 0.18 + (release.phase.id === 'launch' ? 0.08 : 0));
  corp.allocationTightness = clamp01(0.35 + corp.scarcityIndex * 0.4 + corp.retailerStress * 0.18);
  corp.releasePace = clamp01(0.55 + (release.phase.id === 'prelaunch' ? 0.08 : 0) + (release.phase.id === 'launch' ? 0.12 : 0) + (corp.hypeIndex * 0.08));
  corp.partnerHeat = clamp01(0.28 + (release.phase.id === 'licensing' ? 0.18 : 0) + (release.next ? 0.06 : 0));
  corp.activePhase = release.phase.id;
  corp.executiveFocus = pickFloppsExecutive(corp, release).domain;
  corp.guidance = corp.extractionIndex > 0.72 ? 'premiumizing the collector funnel while defending disciplined scarcity' : corp.hypeIndex > 0.7 ? 'leaning into engagement velocity across the release calendar' : corp.retailerStress > 0.65 ? 'rebalancing partner allocation with operational clarity' : 'maintaining disciplined growth through steady release sequencing';
  state.corporation = corp;
  const snapshot = { day, phase: release.phase.id, title: release.current?.title || null, scarcityIndex: corp.scarcityIndex, hypeIndex: corp.hypeIndex, extractionIndex: corp.extractionIndex, collectorStress: corp.collectorStress, retailerStress: corp.retailerStress, laborStress: corp.laborStress, executiveFocus: corp.executiveFocus };
  const existingIdx = state.dayHistory.findIndex((entry) => entry.day === day);
  if (existingIdx >= 0) state.dayHistory[existingIdx] = snapshot; else state.dayHistory.push(snapshot);
  if (state.dayHistory.length > 180) state.dayHistory = state.dayHistory.slice(-180);
  return { corp, eco, release, executive: pickFloppsExecutive(corp, release) };
}

// ─── Simulation Context ────────────────────────────────────────────
function getFloppsSimulationContext(set, market, stateOverride) {
  const macro = getMacroState();
  const state = ensureFloppsStateShape(stateOverride || loadFloppsState());
  const sentiment = market?.sentiment || 1;
  const changePct = market?.setAggregates?.totalChangePct || 0;
  const activeEvents = (market?.events || []).filter(e => market.tick - e.tick < (e.duration || 14));
  const bullish = activeEvents.filter(e => isBullishMarketEvent(e.type)).length;
  const bearish = activeEvents.filter(e => isBearishMarketEvent(e.type)).length;
  const hypeBoost = Math.max(-0.12, Math.min(0.12, (sentiment - 1) * 0.18 + changePct * 0.0025));
  const macroTilt = Math.max(-0.08, Math.min(0.08, (macro.signal || 0) * 0.08));
  const eventTilt = Math.max(-0.12, Math.min(0.12, (bullish - bearish) * 0.02));
  const setHeat = Math.max(-0.06, Math.min(0.06, ((set?.cards?.length || 0) / 150 - 1) * 0.015));
  const day = getSimulationDay(market);
  const corpState = advanceFloppsCorporationState(state, set, market, day);
  const corp = corpState.corp;
  return { macro, sentiment, changePct, activeEvents, bullish, bearish, hypeBoost, macroTilt, eventTilt, setHeat, corporation: corp, release: corpState.release, executive: corpState.executive, ecosystem: corpState.eco };
}

// ─── Bulletins ─────────────────────────────────────────────────────
function pickFloppsBulletin(state, ctx, day) {
  const pool = [...FLOPPS_BULLETINS];
  if (ctx.sentiment > 1.08 || ctx.hypeBoost > 0.02) pool.sort((a, b) => b.stockDelta - a.stockDelta);
  else if (ctx.sentiment < 0.95 || ctx.changePct < 0) pool.sort((a, b) => a.stockDelta - b.stockDelta);
  else pool.sort(() => RNG() - 0.5);
  const weighted = pool.map((item, idx) => ({ item, w: Math.max(0.2, item.weight * (idx < 8 ? 1.3 : 1)) }));
  const total = weighted.reduce((sum, entry) => sum + entry.w, 0);
  let roll = RNG() * total;
  for (const entry of weighted) { roll -= entry.w; if (roll <= 0) return entry.item; }
  return weighted[0].item;
}

function pickFloppsBulletinByCategory(ctx, category) {
  const pool = FLOPPS_BULLETINS.filter((item) => item.category === category);
  if (!pool.length) return pickFloppsBulletin(null, ctx, 0);
  const weighted = pool.map((item) => ({ item, w: Math.max(0.2, item.weight || 1) }));
  const total = weighted.reduce((sum, entry) => sum + entry.w, 0);
  let roll = RNG() * total;
  for (const entry of weighted) { roll -= entry.w; if (roll <= 0) return entry.item; }
  return weighted[0].item;
}

function buildAnnouncementFromBulletin(bulletin, ctx, day, kindOverride) {
  const executiveByCategory = {
    labor: { name: 'Dana Sloane', role: 'Chief People Officer' },
    allocation: { name: 'Marcus Reed', role: 'VP of Allocation' },
    pricing: { name: 'Lillian Mercer', role: 'CFO' },
    investor: { name: 'Mira North', role: 'Investor Relations' },
    lobbying: { name: 'Reed Harlan', role: 'Head of Government Affairs' },
    licensing: { name: 'Grant Bell', role: 'President of Product' },
    community: { name: 'Elena Cross', role: 'Chief Marketing Officer' },
    marketplace: { name: 'Lillian Mercer', role: 'CFO' },
    operations: { name: 'Marcus Reed', role: 'VP of Allocation' },
    cadence: { name: 'Grant Bell', role: 'President of Product' },
  };
  const exec = executiveByCategory[bulletin.category] || { name: ctx.executive?.name || 'Management', role: ctx.executive?.role || 'Executive Office' };
  return { kind: kindOverride || bulletin.category || 'corporate', id: `${bulletin.id}-${day}`, title: bulletin.title, summary: bulletin.summary, paraphrase: bulletin.paraphrase, executive: exec.name, executiveRole: exec.role, stockDelta: bulletin.stockDelta };
}

function buildQuarterlyFloppsAnnouncement(state, ctx, day) {
  const quarter = Math.floor(day / 90) + 1;
  const corp = ctx.corporation || floppsDefaultCorporation();
  const guidance = corp.guidance;
  return { kind: 'quarterly', id: `quarterly-${quarter}`, title: `Quarter ${quarter} Collector Shareholder Update`, summary: `Flopps reaffirmed ${guidance} while highlighting disciplined allocation, premium demand, and durable collector engagement.`, paraphrase: 'They are doing quarterly earnings theater and translating pressure into polished investor language.', executive: ctx.executive?.name || 'Mira North', executiveRole: 'Investor Relations' };
}

function buildScheduledFloppsAnnouncement(state, ctx, day) {
  const focusRelease = (ctx.release?.phase?.id === 'prelaunch' || ctx.release?.phase?.id === 'licensing') ? (ctx.release?.next || ctx.release?.current) : ctx.release?.current;
  if (!focusRelease) return null;
  const offset = day - (focusRelease.day ?? day);
  const licenseLabel = focusRelease.licenseName || focusRelease.title;
  if (offset === -21) return { kind: 'licensing', id: `licensing-${focusRelease.code || focusRelease.day}`, title: `Flopps Signs ${licenseLabel} for a Future Release Window`, summary: `Flopps quietly locked a ${licenseLabel} product window after internal marketability testing tied to search interest, release timing, and crossover spend potential.`, paraphrase: 'They used trend data and release timing to decide what fandom to monetize next.', executive: 'Grant Bell', executiveRole: 'President of Product' };
  if (offset === -7) return { kind: 'consumer-blog', id: `teaser-${focusRelease.code || focusRelease.day}`, title: `Coming Next: ${licenseLabel}`, summary: `Flopps published a controlled teaser for ${licenseLabel}, positioning the set as a cultural moment rather than another entry in the calendar.`, paraphrase: 'They started the prelaunch hype cycle one week out.', executive: 'Elena Cross', executiveRole: 'Chief Marketing Officer' };
  if (offset === 0) return { kind: 'launch', id: `launch-${focusRelease.code || focusRelease.day}`, title: `${licenseLabel} Launches Across Priority Channels`, summary: `Flopps announced the release of ${licenseLabel} with premium language around allocations, chase depth, and collector excitement.`, paraphrase: 'Launch day. They are opening the buying funnel as hard as possible.', executive: 'Marcus Reed', executiveRole: 'VP of Allocation' };
  if (offset === 14) return { kind: 'sellthrough', id: `sellthrough-${focusRelease.code || focusRelease.day}`, title: `${licenseLabel} Sell-Through Update`, summary: `Flopps says ${licenseLabel} outperformed internal demand expectations and validated its premium release discipline.`, paraphrase: 'Two weeks after launch, they are using sell-through numbers to justify the next squeeze.', executive: 'Lillian Mercer', executiveRole: 'CFO' };
  return null;
}

function buildExceptionalFloppsAnnouncement(state, ctx, day) {
  const corp = ctx.corporation || floppsDefaultCorporation();
  const daysSinceLast = Math.min(daysSinceLastFloppsAnnouncement(state), state.announcementHistory.length ? day - state.announcementHistory[state.announcementHistory.length - 1].day : Infinity);
  if (daysSinceLast < 10) return null;
  if (corp.retailerStress > 0.72) return buildAnnouncementFromBulletin(pickFloppsBulletinByCategory(ctx, 'allocation'), ctx, day, 'operations');
  if (corp.laborStress > 0.68) return buildAnnouncementFromBulletin(pickFloppsBulletinByCategory(ctx, 'labor'), ctx, day, 'corporate');
  if (corp.extractionIndex > 0.72 && RNG() < 0.25) return buildAnnouncementFromBulletin(pickFloppsBulletinByCategory(ctx, 'pricing'), ctx, day, 'pricing');
  if (corp.lobbyingHeat > 0.58 && RNG() < 0.2) return buildAnnouncementFromBulletin(pickFloppsBulletinByCategory(ctx, 'lobbying'), ctx, day, 'policy');
  if (corp.hypeIndex > 0.66 && RNG() < 0.2) return buildAnnouncementFromBulletin(pickFloppsBulletinByCategory(ctx, 'community'), ctx, day, 'consumer-blog');
  const wildcard = maybeGenerateFloppsWildcardBulletin(state, ctx, day, { daysSinceLast });
  if (wildcard) return wildcard;
  return null;
}

function daysSinceLastFloppsAnnouncement(state, kindFilter = null) {
  const items = (state.announcementHistory || []).filter((item) => !kindFilter || item.kind === kindFilter);
  if (!items.length) return Infinity;
  return (state.lastSeenDay >= 0 ? state.lastSeenDay : items[items.length - 1].day) - items[items.length - 1].day;
}

// ─── Stock Price ───────────────────────────────────────────────────
function updateFloppsStockPrice(state, ctx, bulletin, day) {
  const prev = state.stock?.price || 100;
  const corp = ctx.corporation || floppsDefaultCorporation();
  const currentPrice = Math.max(12, Math.min(2000, prev * (1 + ctx.macroTilt + ctx.hypeBoost + ctx.eventTilt + ctx.setHeat + (corp.extractionIndex - 0.5) * 0.03 + (corp.hypeIndex - 0.5) * 0.025 + (bulletin?.stockDelta || 0))));
  state.stock = state.stock || { price: 100, history: [] };
  state.stock.price = Math.round(currentPrice * 100) / 100;
  state.stock.history = Array.isArray(state.stock.history) ? state.stock.history : [];
  const point = { day, price: state.stock.price, macro: ctx.macro?.signal || 0, sentiment: ctx.sentiment, phase: ctx.release?.phase?.id || null, bulletin: bulletin?.id || null };
  const last = state.stock.history[state.stock.history.length - 1];
  if (last && last.day === day) state.stock.history[state.stock.history.length - 1] = point;
  else state.stock.history.push(point);
  if (state.stock.history.length > 120) state.stock.history = state.stock.history.slice(-120);
}

// ─── Wildcards ─────────────────────────────────────────────────────
function getFloppsWildcardChance(state, ctx, daysSinceLast) {
  if (daysSinceLast < 18) return 0;
  const corp = ctx.corporation || floppsDefaultCorporation();
  let chance = 0.006;
  if (['prelaunch', 'launch', 'sellthrough'].includes(ctx.release?.phase?.id)) chance += 0.012;
  chance += Math.max(0, corp.hypeIndex - 0.66) * 0.06;
  chance += Math.max(0, corp.extractionIndex - 0.7) * 0.05;
  chance += Math.max(0, corp.collectorStress - 0.68) * 0.04;
  const trendTop = state.trendDesk?.watchlist?.[0];
  if ((trendTop?.marketability || 0) > 0.84) chance += 0.01;
  return Math.max(0, Math.min(0.07, chance));
}

function normalizeFloppsWildcardEvent(raw, ctx, day) {
  const title = String(raw?.title || 'Flopps Wildcard Corporate Update').slice(0, 100);
  const id = raw?.id || `wildcard-${day}-${slugifyFloppsText(title)}`;
  return { kind: 'wildcard', id, title, summary: String(raw?.summary || 'Flopps published a surprise corporate update with immediate market implications.').slice(0, 320), paraphrase: String(raw?.paraphrase || 'Something strange just hit the collector funnel and nobody was ready for it.').slice(0, 320), executive: String(raw?.executive || ctx.executive?.name || 'Management').slice(0, 80), executiveRole: String(raw?.executiveRole || ctx.executive?.role || 'Executive Office').slice(0, 80), stockDelta: Math.max(-0.08, Math.min(0.08, Number(raw?.stockDelta || 0))), marketImpact: String(raw?.marketImpact || 'The secondary market is repricing the news in real time.').slice(0, 220), collectorImpact: String(raw?.collectorImpact || 'Collectors, stores, and flippers are all trying to decode the implication.').slice(0, 220), source: 'openrouter:kimi-k2.5' };
}

function saveFloppsWildcardArtifact(bulletin, day, ctx) {
  wJ(path.join(FLOPPS_WILDCARD_DIR(), `day-${String(day).padStart(4, '0')}-${slugifyFloppsText(bulletin.title)}.json`), { day, createdAt: new Date().toISOString(), bulletin, releasePhase: ctx.release?.phase?.id || null, currentRelease: ctx.release?.current?.title || null, nextRelease: ctx.release?.next?.title || null, stockPrice: ctx.stockPrice || null });
}

function maybeGenerateFloppsWildcardBulletin(state, ctx, day, { daysSinceLast = null, force = false } = {}) {
  const since = daysSinceLast == null ? daysSinceLastFloppsAnnouncement(state) : daysSinceLast;
  const chance = getFloppsWildcardChance(state, ctx, since);
  if (!force && (chance <= 0 || RNG() >= chance)) return null;
  const trendTop = state.trendDesk?.watchlist?.[0] || null;
  const outputFile = path.join(FLOPPS_WILDCARD_DIR(), `tmp-${process.pid}-${Date.now()}.json`);
  const context = { day, stockPrice: state.stock?.price || 100, executive: ctx.executive || null, trendDeskTop: trendTop ? { name: trendTop.name, marketability: trendTop.marketability } : null, release: { phase: ctx.release?.phase?.id || null, phaseLabel: ctx.release?.phase?.label || null, currentTitle: ctx.release?.current?.title || null, nextTitle: ctx.release?.next?.title || null }, corporation: ctx.corporation || null };
  try {
    const raw = execFileSync(process.execPath, [path.join(__dirname, '../ai-set-generator.js'), '--flopps', '--flopps-mode', 'wildcard-event', '--flopps-model', 'moonshotai/kimi-k2.5', '--wildcard-context', JSON.stringify(context), '--wildcard-output-file', outputFile], { cwd: getDataDir(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!fs.existsSync(outputFile)) return null;
    const parsed = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    try { fs.unlinkSync(outputFile) } catch { }
    const bulletin = normalizeFloppsWildcardEvent(parsed, ctx, day);
    saveFloppsWildcardArtifact(bulletin, day, { ...ctx, stockPrice: context.stockPrice });
    return bulletin;
  } catch { try { if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile) } catch { } return null; }
}

// ─── Recording ─────────────────────────────────────────────────────
function recordFloppsBulletin(state, ctx, bulletin, currentDay, commandName) {
  updateFloppsStockPrice(state, ctx, bulletin, currentDay);
  state.lastNewsDay = Math.max(state.lastNewsDay, currentDay);
  state.latestNews = { day: currentDay, command: commandName || null, id: bulletin.id, title: bulletin.title, summary: bulletin.summary, paraphrase: bulletin.paraphrase, executive: bulletin.executive || ctx.executive?.name || null, executiveRole: bulletin.executiveRole || ctx.executive?.role || null, phase: ctx.release?.phase?.id || null, releaseTitle: ctx.release?.current?.title || null, kind: bulletin.kind || 'bulletin', stock: state.stock.price, marketImpact: bulletin.marketImpact || null, collectorImpact: bulletin.collectorImpact || null, source: bulletin.source || 'simulation', createdAt: new Date().toISOString() };
  if (bulletin.quarter != null) state.latestNews.quarter = bulletin.quarter;
  state.newsHistory.push(state.latestNews);
  state.announcementHistory.push({ day: currentDay, kind: bulletin.kind || 'bulletin', quarter: bulletin.quarter, id: bulletin.id, title: bulletin.title });
  if (state.newsHistory.length > 60) state.newsHistory = state.newsHistory.slice(-60);
  if (state.announcementHistory.length > 120) state.announcementHistory = state.announcementHistory.slice(-120);
  saveFloppsState(state);
}

function formatFloppsNewsBlast(bulletin, state, ctx) {
  const price = state.stock?.price || 100;
  const mood = ctx.sentiment > 1.05 ? 'upbeat' : ctx.sentiment < 0.95 ? 'tense' : 'measured';
  const execName = bulletin.executive || ctx.executive?.name || 'Management';
  const phase = ctx.release?.phase?.label || 'Operating Window';
  const lines = [
    `\u{1F4F0} Flopps desk note: ${bulletin.title}`,
    `The company says ${bulletin.summary}`,
    `Translation: ${bulletin.paraphrase}`,
    `${execName} is carrying this one for ${phase}.`,
    `FLPS now trades at ${fm$(price)} in the fake market, which management is describing as "${mood}".`,
    `Check the corporate blog if you want the official version.`,
  ];
  if (bulletin.marketImpact) lines.splice(4, 0, `Market effect: ${bulletin.marketImpact}`);
  if (bulletin.collectorImpact) lines.splice(5, 0, `Collector effect: ${bulletin.collectorImpact}`);
  return lines.join('\n');
}

function formatFloppsNewsSuffix(state) {
  const latest = state?.latestNews;
  if (!latest) return '';
  const note = latest.paraphrase || latest.summary || latest.title || 'Flopps had news';
  return `\nP.S. Flopps just moved: ${note}`;
}

function maybeAnnounceFloppsNews(set, market, commandName) {
  if (!set || !market) return;
  const state = loadFloppsState();
  const day = getSimulationDay(market);
  const currentDay = Number.isFinite(day) ? day : 0;
  ensureFloppsReleaseCalendar(state, set, currentDay);
  const ctx = getFloppsSimulationContext(set, market, state);
  const dayChanged = currentDay > state.lastSeenDay;
  if (dayChanged) { state.lastSeenDay = currentDay; state.lastStockDay = currentDay; updateFloppsStockPrice(state, ctx, null, currentDay); }
  if (currentDay <= state.lastNewsDay) { saveFloppsState(state); return; }
  let bulletin = null;
  const quarter = Math.floor(currentDay / 90);
  const hasQuarterlyThisQuarter = (state.announcementHistory || []).some((item) => item.kind === 'quarterly' && item.quarter === quarter);
  if (currentDay > 0 && currentDay % 90 === 0 && !hasQuarterlyThisQuarter) { bulletin = buildQuarterlyFloppsAnnouncement(state, ctx, currentDay); bulletin.quarter = quarter; }
  else { bulletin = buildScheduledFloppsAnnouncement(state, ctx, currentDay) || buildExceptionalFloppsAnnouncement(state, ctx, currentDay); }
  if (!bulletin) { saveFloppsState(state); return null; }
  recordFloppsBulletin(state, ctx, bulletin, currentDay, commandName);
  return bulletin;
}

// ─── Overlay ───────────────────────────────────────────────────────
function getFloppsOverlayLines(set, market, { compact = false } = {}) {
  if (!set || !market) return [];
  const state = loadFloppsState();
  const ctx = getFloppsSimulationContext(set, market, state);
  const latest = state.latestNews || state.newsHistory?.slice(-1)[0] || null;
  const price = state.stock?.price || 100;
  const day = getSimulationDay(market);
  const dayLabel = Number.isFinite(day) ? day : (state.lastSeenDay >= 0 ? state.lastSeenDay : 'n/a');
  const lines = [`FLPS ${fm$(price)} | simulation day ${dayLabel}`];
  lines.push(`  Phase: ${ctx.release?.phase?.label || 'Unknown'} | Exec focus: ${ctx.executive?.name || 'Management'}`);
  if (state.trendDesk?.watchlist?.[0]) lines.push(`  Trend desk: ${state.trendDesk.watchlist[0].name} (${Math.round(state.trendDesk.watchlist[0].marketability * 100)}% marketability)`);
  if (latest) {
    lines.push(`  Latest bulletin: ${latest.title}`);
    if (!compact) { lines.push(`  ${latest.summary}`); lines.push(`  Translation: ${latest.paraphrase}`); lines.push(`  Corporate stress: collectors ${(ctx.corporation?.collectorStress * 100 || 0).toFixed(0)}% | retailers ${(ctx.corporation?.retailerStress * 100 || 0).toFixed(0)}% | labor ${(ctx.corporation?.laborStress * 100 || 0).toFixed(0)}%`); }
  } else lines.push(`  Latest bulletin: none recorded yet`);
  return lines;
}

module.exports = {
  floppsDefaultCorporation, ensureFloppsStateShape, loadFloppsState, saveFloppsState,
  slugifyFloppsText, getFloppsPriceForDay, getSimulationDate,
  buildFloppsReleaseCalendar, ensureFloppsReleaseCalendar, getFloppsReleaseWindow,
  scoreFloppsTrendCandidate, ensureFloppsTrendDesk, getFloppsEcosystemSnapshot,
  pickFloppsExecutive, advanceFloppsCorporationState, getFloppsSimulationContext,
  pickFloppsBulletin, pickFloppsBulletinByCategory, buildAnnouncementFromBulletin,
  buildQuarterlyFloppsAnnouncement, buildScheduledFloppsAnnouncement,
  buildExceptionalFloppsAnnouncement, daysSinceLastFloppsAnnouncement,
  updateFloppsStockPrice, getFloppsWildcardChance, normalizeFloppsWildcardEvent,
  saveFloppsWildcardArtifact, maybeGenerateFloppsWildcardBulletin,
  recordFloppsBulletin, formatFloppsNewsBlast, formatFloppsNewsSuffix,
  maybeAnnounceFloppsNews, getFloppsOverlayLines,
};
