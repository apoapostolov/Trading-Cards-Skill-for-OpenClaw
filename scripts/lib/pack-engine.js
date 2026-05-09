// ─── PACK ENGINE — Card pulling, rolling, pricing ───────────────────
'use strict';
const CAT = require('../categories.js');
const {
  resolveParallels, resolveCardTypes, RNG, PLATES, PARALLELS,
  CARD_FORMATS, composeAuto, composeRelic, SUBS, GRADES,
  TIER_EMOJI, PAR_EMOJI, SUB_EMOJI, PACKS,
} = require('./constants');
const {
  fm$, rollGrade, generateQuality, generateCondition, annotateAcquiredCard,
  loadSet, ri,
} = require('./helpers');

function rollParallel(maxT, set) {
  const parallels = resolveParallels(set);
  const allowed = parallels.filter(p => p.tier <= maxT);
  for (let i = allowed.length - 1; i >= 0; i--) {
    const p = allowed[i];
    const pm = p.pm || p.priceMultiplier || 1;
    const odds = p.odds;
    if (p.tier === 1) return { parallel: p, sn: null, plate: null };
    if (RNG() < 1 / odds) {
      let sn = null, plate = null;
      const ser = p.ser || p.serial;
      if (ser === 1 && p.name === 'Printing Plate') { plate = PLATES[ri(null, 0, 3)] }
      else if (ser === 1) { sn = 1 }
      else if (ser && ser > 1) { sn = ri(null, 1, typeof ser === 'object' ? ser.max : ser) }
      return { parallel: { ...p, pm: pm }, sn, plate };
    }
  }
  return { parallel: { ...allowed[0], pm: allowed[0].pm || allowed[0].priceMultiplier || 1 }, sn: null, plate: null };
}

function rollSpecial(set) {
  const types = resolveCardTypes(set);
  const total = types.reduce((s, x) => s + x.rarity, 0);
  let r = RNG() * total;
  for (const t of types) { r -= t.rarity; if (r <= 0) return t }
  return types[0];
}

function rollCardType(set, card) {
  const globalTypes = resolveCardTypes(set);
  const hasPerCard = card && Array.isArray(card.cardTypes) && card.cardTypes.length > 0;
  if (!hasPerCard) {
    const type = rollSpecial(set);
    return composeCardTypeResult(type, globalTypes);
  }
  const allowed = card.cardTypes.map(name => {
    const def = globalTypes.find(t => t.name === name || t.id === name);
    return def || { id: 'base', name: name, rarity: 0.85, priceMultiplier: 1, format: 'standard', desc: '\u{1F83F}' + name };
  });
  const total = allowed.reduce((s, t) => s + (t.rarity || 1), 0);
  let r = RNG() * total;
  let picked = allowed[0];
  for (const t of allowed) { r -= (t.rarity || 1); if (r <= 0) { picked = t; break } }
  return composeCardTypeResult(picked, globalTypes);
}

function composeCardTypeResult(type, globalTypes) {
  const result = { ...type };
  if (type.id === 'autograph' || type.id === 'dual-auto' || type.id === 'auto-patch') {
    result.auto = composeAuto();
    if (type.id === 'dual-auto') { result.auto.autoVariant = 'dual'; result.auto.name = 'Dual ' + result.auto.name }
    if (type.id === 'auto-patch') { result.relic = composeRelic(); result.priceMultiplier = (result.auto.mult * result.relic.mult) }
    if (!result.format) result.format = 'standard';
  }
  if (type.id === 'relic') {
    result.relic = composeRelic();
    result.priceMultiplier = result.relic.mult;
  }
  if (result.format && CARD_FORMATS[result.format]) {
    result.formatMult = CARD_FORMATS[result.format].mult;
    result.priceMultiplier = (result.priceMultiplier || 1) * CARD_FORMATS[result.format].mult;
  } else {
    result.formatMult = 1;
    if (!result.format) result.format = 'standard';
  }
  return result;
}

function selectCard(set, forHit) {
  const w = set.cards.map(c => {
    switch (c.starTier) {
      case 'Common': return forHit ? 0.5 : 3;
      case 'Uncommon': return forHit ? 1 : 2;
      case 'Star': return forHit ? 2 : 1.5;
      case 'Superstar': return forHit ? 4 : 0.8;
      case 'Legendary': return forHit ? 8 : 0.3;
      default: return 1;
    }
  });
  const t = w.reduce((s, v) => s + v, 0); let r = RNG() * t;
  for (let i = 0; i < set.cards.length; i++) { r -= w[i]; if (r <= 0) return set.cards[i] }
  return set.cards[0];
}

function calcPrice(card, par, sp, cond, sn) {
  const subMod = SUBS.find(s => s.name === card.subset)?.m || 1;
  let sb = 1; if (sn !== null) { if (sn <= 5) sb = 2; else if (sn <= 10) sb = 1.8; else if (sn <= 25) sb = 1.5 }
  const gradeMult = cond.mult || GRADES.find(g => g.grade === cond.grade)?.mult || 1;
  const spMult = sp.priceMultiplier || sp.mult || 1;
  return card.basePrice * subMod * par.pm * spMult * gradeMult * sb;
}

function fmtCard(c, idx, set, dupCount) {
  const te = TIER_EMOJI[c.starTier] || '';
  const pe = PAR_EMOJI[c.parallel] || '';
  const se = SUB_EMOJI[c.subset] || '\u{1F83F}';
  const hitTag = c.isHit ? ' \u{1F48E}HIT' : '';
  const dupTag = dupCount > 1 ? ` [x${dupCount}]` : '';
  let variantTag = '';
  if (c.acquiredIsBestVariant) {
    variantTag = ' \u{1F31F} New Best Variant!!';
  } else if (c.acquiredIsVariant) {
    variantTag = ' \u2728 New Variant!';
  }
  const serTag = c.serStr ? ' ' + c.serStr : '';
  const stats = c.stats ? `\u2694${c.stats.power} ${c.stats.speed} ${c.stats.technique} ${c.stats.endurance} ${c.stats.charisma}` : '';
  const catLine = c._categoryLine || '';
  const parDisplay = pe ? pe + ' ' + c.parallel : c.parallel;
  const quality = c.quality || c.condition || 'Unknown';
  const gradeLabel = c.graded ? `G${c.grade}` : '';
  const hintStr = typeof quality === 'string' ? quality : quality.hints.slice(0, 2).join('; ');
  const condLine = gradeLabel ? `${gradeLabel} \u2502 ${hintStr}` : hintStr;
  const typeTag = c.cardTypeName ? ` \u2502 ${c.cardTypeName}` : '';
  const priceSep = typeTag ? ' \u2502 ' : ' \u2502 ';
  return `  ${String(idx).padStart(2)}. ${te}${set.code}-${c.cardNum} ${c.name}${dupTag}${variantTag}\n` +
    `     ${parDisplay}${serTag} | ${se} ${c.subset} | ${condLine}\n` +
    (catLine ? `     ${catLine}\n` : '') +
    `     ${stats}${typeTag}${priceSep}${fm$(c.price)}${hitTag}`;
}

function pullCards(set, col, packType, openCtx = {}) {
  const pt = PACKS[packType]; const pack = []; let hc = 0;
  for (let si = 0; si < pt.cpp; si++) {
    const slot = pt.slots[si % pt.slots.length];
    let sp = { name: 'None', mult: 1, desc: '', priceMultiplier: 1, format: 'standard', formatMult: 1 }, bc, isHit = false;
    if (slot.hit) {
      if (RNG() < (PACKS[packType].hitRate || 0)) {
        bc = selectCard(set, true); sp = rollCardType(set, bc); isHit = true; hc++;
      } else { bc = selectCard(set, false) }
    } else bc = selectCard(set, false);
    const { parallel, sn, plate } = rollParallel(slot.mt || 15, set);
    const cond = rollGrade(); const quality = generateQuality(cond); const price = calcPrice(bc, parallel, sp, cond, sn);
    const serStr = parallel.num ? (plate ? `${plate} #1/1` : `#${sn}/${parallel.ser || parallel.serial}`) : '';
    const id = `${set.code}-${bc.num}-${parallel.name}${plate ? '-' + plate : ''}-${sn || '0'}-G${cond.grade}`;
    const baseCard = set.cards.find(sc => sc.num === bc.num);
    const catLine = CAT.fmtCardCategoryLine(baseCard, set.setCategory);
    const condition = generateCondition(bc.starTier);
    const c = {
      id, cardNum: bc.num, name: bc.name, subset: bc.subset, starTier: bc.starTier, stats: bc.stats || {},
      parallel: parallel.name, sn, serStr, plate, special: sp.name, specialDesc: sp.desc,
      quality, grade: cond.grade, gradeName: cond.name, price, isHit,
      marketPrice: price, popScore: 0, demandScore: 0,
      cardFormat: sp.format || 'standard', cardTypeId: sp.id || null,
      cardTypeName: (sp.name === 'Base' || sp.name === 'None') ? null : sp.name,
      condition,
      gradingResult: null,
      _categoryLine: catLine,
    };
    annotateAcquiredCard(c, openCtx);
    pack.push(c);
    if (col) {
      col.cards.push(c); col.pulls[bc.num] = (col.pulls[bc.num] || 0) + 1;
      col.stats.total++; col.stats.value += price; col.parallelCounts[parallel.name] = (col.parallelCounts[parallel.name] || 0) + 1;
      if (isHit) col.stats.hits++; if ((parallel.ser || parallel.serial) === 1 && sn === 1) col.stats.oneOfOnes++;
      if (!col.bestPull || price > col.bestPull.price) col.bestPull = c;
    }
  }
  return { pack, hc };
}

function ensureSet() {
  const s = loadSet();
  if (!s) console.log('\n  \u274C No active set. Generate one first with `generate-set` or `generate-set-ai`.\n');
  return s;
}

module.exports = {
  rollParallel, rollSpecial, rollCardType, composeCardTypeResult,
  selectCard, calcPrice, fmtCard, pullCards, ensureSet,
};
