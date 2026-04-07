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
  resolveSetPath,
  buildPromptBundle,
  writePromptBundleToSet,
} = require('./card-image-system.js');

function main() {
  const setPath = resolveSetPath('BOC-2026');
  const set = JSON.parse(fs.readFileSync(setPath, 'utf8'));
  const bundleByCardNum = new Map();

  for (const card of set.cards || []) {
    const bundle = buildPromptBundle(card, set, 'both', { includeSource: true });
    bundleByCardNum.set(String(card.num).padStart(3, '0'), bundle);
  }

  const updated = writePromptBundleToSet(set, bundleByCardNum);
  fs.writeFileSync(setPath, JSON.stringify(updated, null, 2));
  console.log(`✅ Updated ${updated.cards.length} cards with modular prompt payloads`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

