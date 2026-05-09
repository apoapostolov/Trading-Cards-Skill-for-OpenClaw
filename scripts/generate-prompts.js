#!/usr/bin/env node
'use strict';

/**
 * Legacy compatibility wrapper.
 *
 * The new modular prompt builder lives in `card-image-prompts.js` and
 * `card-image-system.js`. This wrapper preserves the old workflow of
 * writing prompt data into the set JSON while still using the modular
 * prompt payload generator.
 */

const fs = require('fs');
const {
  createTradingLogger,
  summarize,
} = require('./trading-logger.js');
const {
  resolveSetPath,
  buildPromptBundle,
  writePromptBundleToSet,
} = require('./card-image-system.js');

function main() {
  const logger = createTradingLogger({
    script: 'generate-prompts',
    argv: process.argv.slice(2),
    verbose: process.argv.includes('--verbose') || process.env.TRADING_CARDS_VERBOSE === '1',
  });
  const setPath = resolveSetPath('BOC-2026');
  logger.log('process.start', { command: 'generate-prompts', setPath });
  const set = JSON.parse(fs.readFileSync(setPath, 'utf8'));
  const bundleByCardNum = new Map();

  for (const card of set.cards || []) {
    const bundle = buildPromptBundle(card, set, 'both', { includeSource: true });
    bundleByCardNum.set(String(card.num).padStart(3, '0'), bundle);
  }

  const updated = writePromptBundleToSet(set, bundleByCardNum);
  fs.writeFileSync(setPath, JSON.stringify(updated, null, 2));
  logger.debug('set.write', { setPath, cards: updated.cards.length, payload: summarize(updated.cards.slice(0, 3)) });
  console.log(`✅ Updated ${updated.cards.length} cards with modular prompt payloads`);
  logger.log('process.end', { command: 'generate-prompts', status: 'ok' });
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    try {
      const logger = createTradingLogger({ script: 'generate-prompts', argv: process.argv.slice(2) });
      logger.error('process.fail', {
        message: error.message,
        stack: error.stack,
      });
    } catch {}
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}
