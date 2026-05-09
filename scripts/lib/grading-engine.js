// ─── GRADING ENGINE — Grading system logic ─────────────────────────
'use strict';
const {
  GRADES, RNG,
} = require('./constants');
const {
  loadCompanies, loadGradingState, saveGradingState, loadPopulation, savePopulation,
  psaTierForValue, conditionToGrade, isBlackLabel, gradeMultiplier,
  estimateGradeProbability, gradeLabel, bumpPopulation,
  simNpcPopulationGrowth, rollGrade, generateQuality, clamp,
  rebuildPulls, saveCol,
} = require('./helpers');

// ─── Grade Rarity ──────────────────────────────────────────────────
function gradeRarityBonus(cardNum, starTier, grade, set) {
  const pop = loadPopulation();
  const setKey = set.code + '-' + set.year;
  const cardPop = pop[setKey]?.[cardNum];
  if (!cardPop || cardPop.totalGraded === 0) return { bonus: 1.5, label: 'First graded!' };
  const gradeCount = cardPop.PSA?.[grade] || 0;
  const total = cardPop.totalGraded;
  if (grade === 10) {
    if (gradeCount === 0) return { bonus: starTier === 'Legendary' ? 5.0 : starTier === 'Superstar' ? 3.5 : starTier === 'Star' ? 2.5 : 1.8, label: 'First PSA 10!' };
    if (gradeCount <= 3) return { bonus: starTier === 'Legendary' ? 4.0 : starTier === 'Superstar' ? 3.0 : starTier === 'Star' ? 2.2 : 1.5, label: 'Ultra rare (\u22643)' };
    if (gradeCount <= 10) return { bonus: starTier === 'Legendary' ? 3.0 : starTier === 'Superstar' ? 2.0 : 1.3, label: 'Rare (\u226410)' };
    if (gradeCount <= 30) return { bonus: 1.5, label: 'Uncommon (\u226430)' };
    const dilution = Math.max(1.1, 2.0 - gradeCount / 100);
    return { bonus: dilution, label: `Diluted (${gradeCount} exist)` };
  }
  if (grade === 9) {
    if (gradeCount <= 5) return { bonus: 1.3, label: 'Low pop 9' };
    const dilution = Math.max(1.05, 1.3 - gradeCount / 200);
    return { bonus: dilution, label: `${gradeCount} PSA 9s exist` };
  }
  return { bonus: 1.0, label: 'Common grade' };
}

function gradeflationPressure(cardNum, company, grade, set) {
  const pop = loadPopulation();
  const setKey = set.code + '-' + set.year;
  const cardPop = pop[setKey]?.[cardNum];
  if (!cardPop) return { pressure: 'none', premium: 0 };
  const total = cardPop.totalGraded;
  if (total < 10) return { pressure: 'none', premium: 100 };
  const highGrades = (cardPop[company]?.[10] || 0) + (cardPop[company]?.[9.5] || 0) + (cardPop[company]?.[9] || 0);
  const ratio = highGrades / total;
  if (ratio > 0.3) return { pressure: 'high', premium: Math.round((1 - ratio) * 100) };
  if (ratio > 0.15) return { pressure: 'medium', premium: Math.round((1 - ratio) * 100) };
  return { pressure: 'low', premium: Math.round((1 - ratio) * 100) };
}

// ─── Process Completed Submissions ─────────────────────────────────
function processCompletedSubmissions(state, col, set) {
  let newCompletions = false;
  const cardByNum = Object.fromEntries(col.cards.map((c, i) => [c.cardNum, { card: c, idx: i }]));
  for (const sub of state.submissions) {
    if (sub.completed) continue;
    const elapsed = (Date.now() - sub.submittedAt) / (1000 * 60 * 60 * 24);
    if (elapsed >= sub.daysToComplete) {
      sub.completed = true;
      sub.completedAt = Date.now();
      const grade = conditionToGrade(sub.condition, sub.company);
      const cond = sub.condition;
      const blackLabel = sub.company === 'BGS' && grade === 10 && isBlackLabel(cond);
      const mult = gradeMultiplier(grade, sub.company, cond);
      const newPrice = Math.round(sub.rawValue * mult * 100) / 100;
      sub.result = { grade, blackLabel, mult, newPrice };
      const entry = cardByNum[sub.cardNum];
      if (entry) {
        const card = entry.card;
        card.gradingResult = { company: sub.company, tier: sub.tier, grade, blackLabel, condition: { ...cond }, gradedAt: Date.now(), originalPrice: sub.rawValue, newPrice, mult, cracked: false };
        card.price = newPrice;
      }
      if (col.setKey) bumpPopulation(col.setKey, sub.cardNum, sub.company, grade);
      state.history.push({ cardNum: sub.cardNum, name: sub.name, company: sub.company, tier: sub.tier, grade, blackLabel, rawValue: sub.rawValue, newPrice, mult, submittedAt: sub.submittedAt, completedAt: Date.now() });
      newCompletions = true;
    }
  }
  if (newCompletions) { rebuildPulls(col); saveCol(col); }
  return newCompletions;
}

module.exports = {
  gradeRarityBonus, gradeflationPressure, processCompletedSubmissions,
};
